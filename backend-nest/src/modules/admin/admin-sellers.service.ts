import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';

type SellerWithProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  sellerProfile: {
    approvalStatus: string;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
  } | null;
};

@Injectable()
export class AdminSellersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSellers(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const sellers = await this.prisma.user.findMany({
      where: {
        role: USER_ROLES.SELLER,
        sellerProfile: status ? { approvalStatus: status } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sellerProfile: {
          select: {
            approvalStatus: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
          },
        },
      },
      take: 200,
    });

    return sellers.map((seller) => this.mapSeller(seller));
  }

  async getSeller(userId: string) {
    return this.mapSeller(await this.findSellerOrThrow(userId));
  }

  async approveSeller(userId: string, adminUserId: string) {
    this.assertAdminIsNotTarget(userId, adminUserId);
    await this.findSellerOrThrow(userId);

    const updated = await this.prisma.sellerProfile.update({
      where: { userId },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewNote: 'Approved by admin.',
      },
      include: {
        user: true,
      },
    });

    return this.mapSeller(this.mapUpdatedProfile(updated));
  }

  async rejectSeller(userId: string, adminUserId: string, reason?: string) {
    this.assertAdminIsNotTarget(userId, adminUserId);
    await this.findSellerOrThrow(userId);

    const cleanedReason = reason?.trim() || null;
    const updated = await this.prisma.sellerProfile.update({
      where: { userId },
      data: {
        approvalStatus: 'REJECTED',
        approvedAt: null,
        rejectedAt: new Date(),
        rejectionReason: cleanedReason,
        reviewedAt: new Date(),
        reviewNote: cleanedReason,
      },
      include: {
        user: true,
      },
    });

    return this.mapSeller(this.mapUpdatedProfile(updated));
  }

  private async findSellerOrThrow(userId: string): Promise<SellerWithProfile> {
    const seller = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: {
          select: {
            approvalStatus: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
          },
        },
      },
    });

    if (!seller || seller.role !== USER_ROLES.SELLER || !seller.sellerProfile) {
      throw new NotFoundException(`Seller ${userId} was not found.`);
    }

    return seller;
  }

  private assertAdminIsNotTarget(userId: string, adminUserId: string) {
    if (userId === adminUserId) {
      throw new BadRequestException('Admins cannot review their own account.');
    }
  }

  private mapSeller(seller: SellerWithProfile) {
    return {
      userId: seller.id,
      email: seller.email,
      name: seller.fullName,
      role: seller.role,
      sellerApprovalStatus: seller.sellerProfile?.approvalStatus ?? 'PENDING',
      sellerApprovedAt: seller.sellerProfile?.approvedAt?.toISOString() ?? null,
      sellerRejectedAt: seller.sellerProfile?.rejectedAt?.toISOString() ?? null,
      sellerRejectionReason: seller.sellerProfile?.rejectionReason ?? null,
    };
  }

  private mapUpdatedProfile(updated: {
    approvalStatus: string;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
    user: {
      id: string;
      email: string;
      fullName: string | null;
      role: string;
    };
  }): SellerWithProfile {
    return {
      id: updated.user.id,
      email: updated.user.email,
      fullName: updated.user.fullName,
      role: updated.user.role,
      sellerProfile: {
        approvalStatus: updated.approvalStatus,
        approvedAt: updated.approvedAt,
        rejectedAt: updated.rejectedAt,
        rejectionReason: updated.rejectionReason,
      },
    };
  }
}
