import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { ListAdminSellersQueryDto } from './dto/list-admin-sellers-query.dto';
import { SellerFinanceService } from '../seller-finance/seller-finance.service';

type SellerWithProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  createdAt: Date;
  sellerProfile: {
    id?: string;
    currentShopId?: string | null;
    approvalStatus: string;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
    legalType?: string | null;
    legalName?: string | null;
    inn?: string | null;
    ogrn?: string | null;
    kpp?: string | null;
    legalAddress?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    bik?: string | null;
    shops?: Array<{
      id: string;
      name: string;
      status: string;
      paymentConfigStatus: string;
    }>;
  } | null;
};

@Injectable()
export class AdminSellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerFinanceService: SellerFinanceService,
  ) {}

  async listSellers(query: ListAdminSellersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const trimmedQuery = query.q?.trim();
    const sellerWhere: Prisma.UserWhereInput = {
      role: USER_ROLES.SELLER,
      sellerProfile:
        query.status && query.status !== 'ALL'
          ? { approvalStatus: query.status }
          : undefined,
      ...(trimmedQuery
        ? {
            OR: [
              { email: { contains: trimmedQuery, mode: 'insensitive' } },
              { fullName: { contains: trimmedQuery, mode: 'insensitive' } },
              { phone: { contains: trimmedQuery, mode: 'insensitive' } },
              {
                sellerProfile: {
                  shops: {
                    some: {
                      name: { contains: trimmedQuery, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [sellers, total, summaryCounts] = await Promise.all([
      this.prisma.user.findMany({
        where: sellerWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          sellerProfile: {
            select: {
              id: true,
              approvalStatus: true,
              approvedAt: true,
              rejectedAt: true,
              rejectionReason: true,
              currentShopId: true,
              contactPhone: true,
              contactEmail: true,
              shops: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  paymentConfigStatus: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: sellerWhere }),
      this.prisma.sellerProfile.groupBy({
        by: ['approvalStatus'],
        _count: { _all: true },
      }),
    ]);

    const shopIds = sellers.flatMap(
      (seller) => seller.sellerProfile?.shops?.map((shop) => shop.id) ?? [],
    );
    const financeRows = shopIds.length
      ? await this.sellerFinanceService.listAdminSellerFees()
      : [];
    const financeByShop = new Map(financeRows.map((row) => [row.shopId, row]));

    return {
      items: sellers.map((seller) =>
        this.mapSellerListItem(seller as SellerWithProfile, financeByShop),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: {
        all: summaryCounts.reduce((sum, item) => sum + item._count._all, 0),
        pending:
          summaryCounts.find((item) => item.approvalStatus === 'PENDING')
            ?._count._all ?? 0,
        approved:
          summaryCounts.find((item) => item.approvalStatus === 'APPROVED')
            ?._count._all ?? 0,
        rejected:
          summaryCounts.find((item) => item.approvalStatus === 'REJECTED')
            ?._count._all ?? 0,
      },
    };
  }

  async getSeller(userId: string) {
    const seller = await this.findSellerOrThrow(userId);
    const shops = await this.prisma.shop.findMany({
      where: {
        sellerProfileId: seller.sellerProfile?.id,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        paymentConfigStatus: true,
        allowPrepaidQr: true,
        allowPayOnDeliverySellerQr: true,
        allowDepositPayment: true,
      },
    });
    const financeRows = await this.sellerFinanceService.listAdminSellerFees();
    const financeByShop = new Map(financeRows.map((row) => [row.shopId, row]));
    const recentOrders = await this.prisma.order.findMany({
      where: {
        shopId: {
          in: shops.map((shop) => shop.id),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        shop: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const shopSummaries = shops.map((shop) => {
      const finance = financeByShop.get(shop.id);
      return {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        status: shop.status,
        paymentConfigStatus: shop.paymentConfigStatus,
        allowPrepaidQr: shop.allowPrepaidQr,
        allowPayOnDeliverySellerQr: shop.allowPayOnDeliverySellerQr,
        allowDepositPayment: shop.allowDepositPayment,
        confirmedRevenueThisMonth: finance?.confirmedRevenueThisMonth ?? '0',
        pendingPlatformFees: finance?.platformFeeDue ?? '0',
      };
    });

    return {
      ...this.mapSellerBase(seller),
      contactPhone: seller.sellerProfile?.contactPhone ?? seller.phone ?? null,
      contactEmail: seller.sellerProfile?.contactEmail ?? seller.email ?? null,
      kycStatus: this.computeKycStatus(seller.sellerProfile?.approvalStatus),
      onboardingStatus: seller.sellerProfile?.approvalStatus ?? 'PENDING',
      shopCount: shopSummaries.length,
      activeShopCount: shopSummaries.filter((shop) => shop.status === 'ACTIVE')
        .length,
      shops: shopSummaries,
      financeSummary: {
        revenueThisMonth: shopSummaries
          .reduce(
            (sum, shop) =>
              sum.plus(new Prisma.Decimal(shop.confirmedRevenueThisMonth)),
            new Prisma.Decimal(0),
          )
          .toString(),
        pendingPlatformFees: shopSummaries
          .reduce(
            (sum, shop) =>
              sum.plus(new Prisma.Decimal(shop.pendingPlatformFees)),
            new Prisma.Decimal(0),
          )
          .toString(),
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderCode: order.orderNumber,
        shopId: order.shop.id,
        shopName: order.shop.name,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount.toString(),
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  async approveSeller(userId: string, adminUserId: string) {
    this.assertAdminIsNotTarget(userId, adminUserId);
    const before = await this.findSellerOrThrow(userId);
    const approvedDocuments = await this.prisma.sellerDocument.count({
      where: { userId, status: 'APPROVED' },
    });
    if (approvedDocuments < 1) {
      throw new BadRequestException(
        'At least one approved seller document is required before approving the seller.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sellerProfile.update({
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
      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: userId,
          action: 'SELLER_APPROVED',
          entityType: 'SELLER_PROFILE',
          entityId: result.id,
          oldValueJson: {
            approvalStatus: before.sellerProfile?.approvalStatus,
          },
          newValueJson: { approvalStatus: 'APPROVED' },
        },
      });
      return result;
    });

    return this.mapSeller(this.mapUpdatedProfile(updated));
  }

  async rejectSeller(userId: string, adminUserId: string, reason?: string) {
    this.assertAdminIsNotTarget(userId, adminUserId);
    const before = await this.findSellerOrThrow(userId);

    const cleanedReason = reason?.trim() || null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sellerProfile.update({
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
      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: userId,
          action: 'SELLER_REJECTED',
          entityType: 'SELLER_PROFILE',
          entityId: result.id,
          oldValueJson: {
            approvalStatus: before.sellerProfile?.approvalStatus,
          },
          newValueJson: {
            approvalStatus: 'REJECTED',
            rejectionReason: cleanedReason,
          },
          reason: cleanedReason,
        },
      });
      return result;
    });

    return this.mapSeller(this.mapUpdatedProfile(updated));
  }

  async getOnboarding(userId: string) {
    const seller = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: true,
      },
    });
    if (!seller || seller.role !== USER_ROLES.SELLER || !seller.sellerProfile) {
      throw new NotFoundException(`Seller ${userId} was not found.`);
    }
    return {
      seller: this.mapSeller(seller),
      profile: this.mapOnboardingProfile(seller.sellerProfile),
    };
  }

  async listDocuments(userId: string) {
    await this.findSellerOrThrow(userId);
    const documents = await this.prisma.sellerDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
    return documents.map((document) => this.mapDocument(document));
  }

  async approveDocument(
    userId: string,
    documentId: string,
    adminUserId: string,
  ) {
    const document = await this.findSellerDocumentOrThrow(userId, documentId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sellerDocument.update({
        where: { id: documentId },
        data: {
          status: 'APPROVED',
          rejectionReason: null,
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: userId,
          action: 'SELLER_DOCUMENT_APPROVED',
          entityType: 'SELLER_DOCUMENT',
          entityId: documentId,
          oldValueJson: { status: document.status },
          newValueJson: { status: 'APPROVED' },
        },
      });
      return result;
    });
    return this.mapDocument(updated);
  }

  async rejectDocument(
    userId: string,
    documentId: string,
    adminUserId: string,
    reason?: string,
  ) {
    const document = await this.findSellerDocumentOrThrow(userId, documentId);
    const cleanedReason = reason?.trim() || null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sellerDocument.update({
        where: { id: documentId },
        data: {
          status: 'REJECTED',
          rejectionReason: cleanedReason,
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: userId,
          action: 'SELLER_DOCUMENT_REJECTED',
          entityType: 'SELLER_DOCUMENT',
          entityId: documentId,
          oldValueJson: { status: document.status },
          newValueJson: { status: 'REJECTED', rejectionReason: cleanedReason },
          reason: cleanedReason,
        },
      });
      return result;
    });
    return this.mapDocument(updated);
  }

  async listAuditLogs(targetUserId?: string) {
    const logs = await this.prisma.adminAuditLog.findMany({
      where: targetUserId ? { targetUserId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      targetUserId: log.targetUserId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValueJson: log.oldValueJson,
      newValueJson: log.newValueJson,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  private async findSellerOrThrow(userId: string): Promise<SellerWithProfile> {
    const seller = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: {
          select: {
            id: true,
            approvalStatus: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            legalType: true,
            legalName: true,
            inn: true,
            ogrn: true,
            kpp: true,
            legalAddress: true,
            contactName: true,
            contactPhone: true,
            contactEmail: true,
            bankName: true,
            bankAccount: true,
            bik: true,
            currentShopId: true,
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
    return this.mapSellerBase(seller);
  }

  private mapSellerBase(seller: SellerWithProfile) {
    return {
      userId: seller.id,
      email: seller.email,
      name: seller.fullName,
      phone: seller.phone,
      role: seller.role,
      sellerApprovalStatus: seller.sellerProfile?.approvalStatus ?? 'PENDING',
      sellerApprovedAt: seller.sellerProfile?.approvedAt?.toISOString() ?? null,
      sellerRejectedAt: seller.sellerProfile?.rejectedAt?.toISOString() ?? null,
      sellerRejectionReason: seller.sellerProfile?.rejectionReason ?? null,
      createdAt: seller.createdAt.toISOString(),
    };
  }

  private mapSellerListItem(
    seller: SellerWithProfile,
    financeByShop: Map<
      string,
      {
        confirmedRevenueThisMonth: string;
        platformFeeDue: string;
      }
    >,
  ) {
    const shops = seller.sellerProfile?.shops ?? [];
    const financeTotals = shops.reduce(
      (totals, shop) => {
        const finance = financeByShop.get(shop.id);
        return {
          revenue: totals.revenue.plus(
            new Prisma.Decimal(finance?.confirmedRevenueThisMonth ?? '0'),
          ),
          pendingFees: totals.pendingFees.plus(
            new Prisma.Decimal(finance?.platformFeeDue ?? '0'),
          ),
        };
      },
      {
        revenue: new Prisma.Decimal(0),
        pendingFees: new Prisma.Decimal(0),
      },
    );

    return {
      ...this.mapSellerBase(seller),
      onboardingStatus: seller.sellerProfile?.approvalStatus ?? 'PENDING',
      kycStatus: this.computeKycStatus(seller.sellerProfile?.approvalStatus),
      shopCount: shops.length,
      activeShopCount: shops.filter((shop) => shop.status === 'ACTIVE').length,
      revenueThisMonth: financeTotals.revenue.toString(),
      pendingPlatformFees: financeTotals.pendingFees.toString(),
      currentShopId: seller.sellerProfile?.currentShopId ?? null,
      primaryShopName: shops[0]?.name ?? null,
    };
  }

  private computeKycStatus(approvalStatus?: string | null) {
    if (approvalStatus === 'APPROVED') return 'APPROVED';
    if (approvalStatus === 'REJECTED') return 'REJECTED';
    return 'PENDING_REVIEW';
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
      phone: null,
      role: updated.user.role,
      createdAt: new Date(),
      sellerProfile: {
        approvalStatus: updated.approvalStatus,
        approvedAt: updated.approvedAt,
        rejectedAt: updated.rejectedAt,
        rejectionReason: updated.rejectionReason,
      },
    };
  }

  private async findSellerDocumentOrThrow(userId: string, documentId: string) {
    await this.findSellerOrThrow(userId);
    const document = await this.prisma.sellerDocument.findFirst({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }
    return document;
  }

  private mapOnboardingProfile(profile: {
    userId: string;
    approvalStatus: string;
    rejectionReason: string | null;
    legalType: string | null;
    legalName: string | null;
    inn: string | null;
    ogrn: string | null;
    kpp: string | null;
    legalAddress: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bik: string | null;
    updatedAt: Date;
  }) {
    return {
      userId: profile.userId,
      sellerApprovalStatus: profile.approvalStatus,
      sellerRejectionReason: profile.rejectionReason,
      legalType: profile.legalType,
      legalName: profile.legalName,
      inn: profile.inn,
      ogrn: profile.ogrn,
      kpp: profile.kpp,
      legalAddress: profile.legalAddress,
      contactName: profile.contactName,
      contactPhone: profile.contactPhone,
      contactEmail: profile.contactEmail,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      bik: profile.bik,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapDocument(document: {
    id: string;
    userId: string;
    documentType: string;
    url: string;
    storageKey: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
    status: string;
    rejectionReason: string | null;
    uploadedAt: Date;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
  }) {
    return {
      id: document.id,
      userId: document.userId,
      documentType: document.documentType,
      url: document.url,
      storageKey: document.storageKey,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status,
      rejectionReason: document.rejectionReason,
      uploadedAt: document.uploadedAt.toISOString(),
      reviewedAt: document.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: document.reviewedByUserId,
    };
  }
}
