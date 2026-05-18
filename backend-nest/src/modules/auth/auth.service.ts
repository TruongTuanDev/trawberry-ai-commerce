import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { USER_ROLES } from '../../common/constants/roles.constant';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto) {
    const role = this.normalizeRequestedRole(dto.role);
    return this.registerForRole(dto, role);
  }

  async registerCustomer(dto: RegisterDto) {
    return this.registerForRole(dto, USER_ROLES.CUSTOMER);
  }

  async registerSeller(dto: RegisterDto) {
    return this.registerForRole(dto, USER_ROLES.SELLER);
  }

  async login(dto: LoginDto) {
    return this.loginForRoles(dto, [
      USER_ROLES.ADMIN,
      USER_ROLES.SELLER,
      USER_ROLES.CUSTOMER,
    ]);
  }

  async loginCustomer(dto: LoginDto) {
    return this.loginForRoles(dto, [USER_ROLES.CUSTOMER]);
  }

  async loginSeller(dto: LoginDto) {
    return this.loginForRoles(dto, [USER_ROLES.SELLER]);
  }

  async loginAdmin(dto: LoginDto) {
    return this.loginForRoles(dto, [USER_ROLES.ADMIN]);
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        userId: string;
        email: string;
      }>(dto.refreshToken, {
        secret: this.getJwtSecret(
          this.configService.get<string>('JWT_SECRET') ||
            this.configService.get<string>(
              'JWT_REFRESH_SECRET',
              'dev-refresh-secret',
            ),
        ),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          sellerProfile: {
            select: {
              approvalStatus: true,
            },
          },
        },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
  }

  async getCurrentUser(userId: string) {
    return this.usersService.getCurrentUserProfileById(userId);
  }

  private async registerForRole(dto: RegisterDto, role: string) {
    const email = this.normalizeOptionalEmail(dto.email);
    const phone = this.normalizeOptionalPhone(dto.phone);

    if (!email && !phone) {
      throw new BadRequestException('Email or phone is required.');
    }

    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingEmail) {
        throw new ConflictException('Email is already registered.');
      }
    }

    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });

      if (existingPhone) {
        throw new ConflictException('Phone is already registered.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const persistedEmail = email ?? this.createSyntheticEmail(phone!);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: persistedEmail,
          passwordHash,
          phone,
          fullName: dto.fullName?.trim() || null,
          role,
          status: 'ACTIVE',
        },
      });

      if (role === USER_ROLES.SELLER) {
        await tx.sellerProfile.create({
          data: {
            userId: createdUser.id,
            approvalStatus: 'PENDING',
          },
        });
      }

      return (
        (await tx.user.findUnique({
          where: { id: createdUser.id },
          include: {
            sellerProfile: {
              select: {
                approvalStatus: true,
              },
            },
          },
        })) ?? createdUser
      );
    });

    return this.buildAuthResponse(user);
  }

  private async loginForRoles(dto: LoginDto, allowedRoles: string[]) {
    const identifier = this.normalizeIdentifier(dto);
    const lookupField = identifier.includes('@') ? 'email' : 'phone';
    const user = await this.prisma.user.findUnique({
      where:
        lookupField === 'email' ? { email: identifier } : { phone: identifier },
      include: {
        sellerProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active.');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    phone: string | null;
    fullName: string | null;
    role: string;
    status: string;
    sellerProfile?: {
      approvalStatus: string;
    } | null;
  }) {
    const payload = {
      sub: user.email,
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getJwtSecret(
          this.configService.get<string>('JWT_SECRET') ||
            this.configService.get<string>(
              'JWT_ACCESS_SECRET',
              'dev-access-secret',
            ),
        ),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ||
          this.configService.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          )) as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getJwtSecret(
          this.configService.get<string>('JWT_SECRET') ||
            this.configService.get<string>(
              'JWT_REFRESH_SECRET',
              'dev-refresh-secret',
            ),
        ),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ||
          this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '7d',
          )) as never,
      }),
    ]);

    return {
      userId: user.id,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      approvalStatus: user.sellerProfile?.approvalStatus ?? null,
    };
  }

  private normalizeRequestedRole(role?: string): string {
    if (!role || role === 'CUSTOMER' || role === 'USER') {
      return USER_ROLES.CUSTOMER;
    }

    if (role === USER_ROLES.SELLER) {
      return USER_ROLES.SELLER;
    }

    throw new BadRequestException('Unsupported registration role.');
  }

  private normalizeIdentifier(dto: LoginDto) {
    const raw = dto.identifier ?? dto.email ?? '';
    const trimmed = raw.trim();

    if (!trimmed) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return trimmed.includes('@')
      ? trimmed.toLowerCase()
      : this.normalizePhone(trimmed);
  }

  private normalizeOptionalEmail(email?: string | null) {
    const normalized = email?.trim().toLowerCase() ?? '';
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  private normalizeOptionalPhone(phone?: string | null) {
    const normalized = phone?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    return this.normalizePhone(normalized);
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\s+/g, '');
  }

  private createSyntheticEmail(phone: string) {
    const safePhone = phone.replace(/[^a-zA-Z0-9]/g, '');
    return `phone-${safePhone}@customer.local`;
  }

  private getJwtSecret(rawSecret: string): string | Buffer {
    try {
      const decoded = Buffer.from(rawSecret, 'base64');
      if (
        decoded.length > 0 &&
        decoded.toString('base64') === rawSecret.replace(/\s+/g, '')
      ) {
        return decoded;
      }
    } catch {
      return rawSecret;
    }

    return rawSecret;
  }
}
