import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { normalizePhone } from '../../common/utils/phone.util';
import {
  isSellerOnboardingComplete,
  resolveSellerNextStep,
} from '../../common/utils/seller-next-step.util';
import { FilesService } from '../files/files.service';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { UpdateSellerOnboardingProfileDto } from './dto/update-seller-onboarding-profile.dto';
import { UploadSellerDocumentDto } from './dto/upload-seller-document.dto';

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class SellerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService,
  ) {}

  async getProfile(user: AuthenticatedUser) {
    this.assertSeller(user);
    const profile = await this.findProfile(user.userId);
    return this.mapProfile(profile);
  }

  async updateProfile(
    user: AuthenticatedUser,
    dto: UpdateSellerOnboardingProfileDto,
  ) {
    this.assertSeller(user);
    const profile = await this.prisma.sellerProfile.update({
      where: { userId: user.userId },
      data: {
        legalType: dto.legalType,
        legalName: dto.legalName?.trim(),
        inn: dto.inn?.trim(),
        ogrn: dto.ogrn?.trim(),
        kpp: dto.kpp?.trim(),
        legalAddress: dto.legalAddress?.trim(),
        contactName: dto.contactName?.trim(),
        contactPhone: dto.contactPhone
          ? normalizePhone(dto.contactPhone, 'Contact phone')
          : undefined,
        contactEmail: dto.contactEmail?.trim().toLowerCase(),
        bankName: dto.bankName?.trim(),
        bankAccount: dto.bankAccount?.trim(),
        bik: dto.bik?.trim(),
      },
      include: {
        documents: {
          select: { id: true },
        },
      },
    });
    return this.mapProfile(profile);
  }

  async listDocuments(user: AuthenticatedUser) {
    this.assertSeller(user);
    const documents = await this.prisma.sellerDocument.findMany({
      where: { userId: user.userId },
      orderBy: { uploadedAt: 'desc' },
    });
    return documents.map((document) => this.mapDocument(document));
  }

  async uploadDocument(
    user: AuthenticatedUser,
    dto: UploadSellerDocumentDto,
    file: ProductImageUploadFile,
  ) {
    this.assertSeller(user);
    await this.findProfile(user.userId);
    this.validateDocumentFile(file);

    const stored = await this.filesService.storeSellerDocument(file, {
      userId: user.userId,
    });

    const document = await this.prisma.sellerDocument.create({
      data: {
        userId: user.userId,
        documentType: dto.documentType,
        url: stored.publicUrl,
        storageKey: stored.storageKey,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        status: 'PENDING',
      },
    });

    return this.mapDocument(document);
  }

  async deleteDocument(user: AuthenticatedUser, documentId: string) {
    this.assertSeller(user);
    const document = await this.prisma.sellerDocument.findFirst({
      where: {
        id: documentId,
        userId: user.userId,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }

    if (document.status !== 'PENDING' || document.reviewedAt) {
      throw new BadRequestException(
        'Only unreviewed pending documents can be deleted.',
      );
    }

    await this.prisma.sellerDocument.delete({ where: { id: document.id } });
    await this.filesService.deleteStoredFile({
      storageKey: document.storageKey,
      fileUrl: document.url,
    });
  }

  private assertSeller(user: AuthenticatedUser) {
    if (user.role !== USER_ROLES.SELLER) {
      throw new ForbiddenException('Seller account is required.');
    }
  }

  private async findProfile(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        documents: {
          select: { id: true },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException(
        `Seller profile for ${userId} was not found.`,
      );
    }
    return profile;
  }

  private validateDocumentFile(file: ProductImageUploadFile) {
    if (!file) {
      throw new BadRequestException('Document file is required.');
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported document type. Allowed: PDF, JPG, PNG, WEBP.',
      );
    }

    const maxSizeMb = this.configService.get<number>(
      'MAX_KYC_DOCUMENT_SIZE_MB',
      10,
    );
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new BadRequestException(
        `Document exceeds the maximum file size of ${maxSizeMb} MB.`,
      );
    }
  }

  private mapProfile(profile: {
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
    documents?: Array<{ id: string }>;
  }) {
    const sellerOnboardingComplete = isSellerOnboardingComplete({
      approvalStatus: profile.approvalStatus,
      rejectionReason: profile.rejectionReason,
      legalType: profile.legalType,
      legalName: profile.legalName,
      inn: profile.inn,
      legalAddress: profile.legalAddress,
      contactName: profile.contactName,
      contactPhone: profile.contactPhone,
      contactEmail: profile.contactEmail,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      bik: profile.bik,
      documentCount: profile.documents?.length ?? 0,
    });

    return {
      userId: profile.userId,
      sellerApprovalStatus: profile.approvalStatus,
      sellerRejectionReason: profile.rejectionReason,
      sellerNextStep: resolveSellerNextStep({
        approvalStatus: profile.approvalStatus,
        rejectionReason: profile.rejectionReason,
        legalType: profile.legalType,
        legalName: profile.legalName,
        inn: profile.inn,
        legalAddress: profile.legalAddress,
        contactName: profile.contactName,
        contactPhone: profile.contactPhone,
        contactEmail: profile.contactEmail,
        bankName: profile.bankName,
        bankAccount: profile.bankAccount,
        bik: profile.bik,
        documentCount: profile.documents?.length ?? 0,
      }),
      sellerOnboardingComplete,
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
