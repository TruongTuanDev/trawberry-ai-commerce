import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateAdminUserDto,
  ListAdminUsersQueryDto,
  UpdateAdminUserDto,
} from './dto/admin-users.dto';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { normalizePhone } from '../../common/utils/phone.util';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListAdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role && query.role !== 'ALL') {
      where.role = query.role;
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    const trimmedQuery = query.q?.trim();
    if (trimmedQuery) {
      where.OR = [
        { email: { contains: trimmedQuery, mode: 'insensitive' } },
        { fullName: { contains: trimmedQuery, mode: 'insensitive' } },
        { phone: { contains: trimmedQuery, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((user) => {
      const u = { ...user } as Partial<typeof user>;
      delete u.passwordHash;
      return u;
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    const u = { ...user } as Partial<typeof user>;
    delete u.passwordHash;
    return u;
  }

  async createUser(dto: CreateAdminUserDto, adminUserId: string) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim() ? normalizePhone(dto.phone.trim()) : null;

    // Check unique email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    // Check unique phone
    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        throw new ConflictException('PHONE_ALREADY_EXISTS');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone,
          fullName: dto.fullName?.trim() || null,
          role: dto.role,
          status: dto.status || 'ACTIVE',
          passwordHash,
        },
      });

      if (dto.role === USER_ROLES.SELLER) {
        await tx.sellerProfile.create({
          data: {
            userId: user.id,
            approvalStatus: 'PENDING',
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: user.id,
          action: 'CREATE_USER',
          entityType: 'USER',
          entityId: user.id,
          newValueJson: {
            email,
            phone,
            fullName: dto.fullName?.trim() || null,
            role: dto.role,
            status: dto.status || 'ACTIVE',
          },
        },
      });

      return user;
    });

    const u = { ...created } as Partial<typeof created>;
    delete u.passwordHash;
    return u;
  }

  async updateUser(id: string, dto: UpdateAdminUserDto, adminUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim() ? normalizePhone(dto.phone.trim()) : null;

    // Unique checks
    if (email && email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new ConflictException('EMAIL_ALREADY_EXISTS');
      }
    }

    if (phone && phone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        throw new ConflictException('PHONE_ALREADY_EXISTS');
      }
    }

    // Role / status security guards
    const isTargetAdmin = user.role === USER_ROLES.ADMIN;
    const isTargetActive = user.status === 'ACTIVE';

    const loweringRole =
      dto.role && dto.role !== USER_ROLES.ADMIN && isTargetAdmin;
    const deactivating =
      dto.status && dto.status !== 'ACTIVE' && isTargetActive && isTargetAdmin;

    if (loweringRole || deactivating) {
      const activeAdminCount = await this.prisma.user.count({
        where: { role: USER_ROLES.ADMIN, status: 'ACTIVE' },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_LOWER_LAST_ADMIN',
          message:
            'You cannot demote or disable the last active admin account.',
        });
      }
    }

    // Self guards
    if (id === adminUserId) {
      if (dto.role && dto.role !== USER_ROLES.ADMIN) {
        throw new BadRequestException({
          code: 'CANNOT_DEMOTE_SELF',
          message: 'You cannot change your own admin role.',
        });
      }
      if (dto.status && dto.status !== 'ACTIVE') {
        throw new BadRequestException({
          code: 'CANNOT_DISABLE_SELF',
          message: 'You cannot disable your own admin account.',
        });
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined)
      data.fullName = dto.fullName?.trim() || null;
    if (email !== undefined) data.email = email;
    if (dto.phone !== undefined) data.phone = phone;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.status !== undefined) data.status = dto.status;

    let isPasswordReset = false;
    if (dto.password?.trim()) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      isPasswordReset = true;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data,
      });

      // Write Audit log
      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: id,
          action: isPasswordReset ? 'RESET_USER_PASSWORD' : 'UPDATE_USER',
          entityType: 'USER',
          entityId: id,
          oldValueJson: {
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
          },
          newValueJson: {
            fullName: result.fullName,
            email: result.email,
            phone: result.phone,
            role: result.role,
            status: result.status,
          },
        },
      });

      return result;
    });

    const u = { ...updated } as Partial<typeof updated>;
    delete u.passwordHash;
    return u;
  }

  async deleteUser(id: string, adminUserId: string) {
    if (id === adminUserId) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    // Check last admin guard
    if (user.role === USER_ROLES.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: USER_ROLES.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_DELETE_LAST_ADMIN',
          message: 'You cannot delete the last admin account.',
        });
      }
    }

    // Check dependencies
    const hasOrders = await this.prisma.order.count({
      where: {
        OR: [{ customerId: id }, { shop: { sellerProfile: { userId: id } } }],
      },
    });

    const hasCheckouts = await this.prisma.marketplaceCheckout.count({
      where: { customerUserId: id },
    });

    const hasShops = await this.prisma.shop.count({
      where: { sellerProfile: { userId: id } },
    });

    const hasLedger = await this.prisma.sellerFeeLedgerEntry.count({
      where: { sellerId: id },
    });

    if (hasOrders > 0 || hasCheckouts > 0 || hasShops > 0 || hasLedger > 0) {
      throw new BadRequestException({
        code: 'USER_HAS_DEPENDENCIES',
        message:
          'This user has related data and cannot be deleted. Disable the user instead.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete user details (linked profile if any, cascade deletes if any)
      // Since schema.prisma has onDelete: Cascade for sellerProfile on userId:
      // it will delete automatically.
      await tx.user.delete({
        where: { id },
      });

      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: id,
          action: 'DELETE_USER',
          entityType: 'USER',
          entityId: id,
          oldValueJson: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            status: user.status,
          },
        },
      });
    });

    return { success: true };
  }
}
