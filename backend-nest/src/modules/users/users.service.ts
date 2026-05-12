import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException(`User ${email} was not found.`);
    }

    return user;
  }

  async getCurrentUserProfileById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: {
          select: {
            id: true,
            currentShopId: true,
            approvalStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      sellerProfileId: user.sellerProfile?.id ?? null,
      currentShopId: user.sellerProfile?.currentShopId ?? null,
      sellerApprovalStatus: user.sellerProfile?.approvalStatus ?? null,
    };
  }

  async getCurrentUserProfileByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        sellerProfile: {
          select: {
            id: true,
            currentShopId: true,
            approvalStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${email} was not found.`);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      sellerProfileId: user.sellerProfile?.id ?? null,
      currentShopId: user.sellerProfile?.currentShopId ?? null,
      sellerApprovalStatus: user.sellerProfile?.approvalStatus ?? null,
    };
  }
}
