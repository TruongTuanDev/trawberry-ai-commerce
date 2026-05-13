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
