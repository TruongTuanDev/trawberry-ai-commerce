import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { normalizePhone } from '../../common/utils/phone.util';
import { resolveShopPaymentPanel } from '../../common/utils/shop-payment.util';
import { FilesService } from '../files/files.service';
import { CreateShopDto } from './dto/create-shop.dto';

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  async createShop(user: AuthenticatedUser, dto: CreateShopDto) {
    if (user.role !== USER_ROLES.SELLER) {
      throw new ForbiddenException('Only sellers can create shops.');
    }

    const sellerProfile = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        approvalStatus: true,
      },
    });

    if (!sellerProfile) {
      throw new NotFoundException(
        `Seller profile for user ${user.userId} was not found.`,
      );
    }

    if (sellerProfile.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Only APPROVED sellers can create a shop.');
    }

    const existingSlug = await this.prisma.shop.findUnique({
      where: {
        slug: dto.slug,
      },
      select: {
        id: true,
      },
    });

    if (existingSlug) {
      throw new BadRequestException('Shop slug is already taken.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          sellerProfileId: sellerProfile.id,
          name: dto.name,
          slug: dto.slug,
          logoUrl: dto.logoUrl ?? null,
          contactInfo: dto.contactInfo ?? null,
          bankName: dto.bankName ?? null,
          accountNumber: dto.accountNumber ?? null,
          accountHolderName: dto.accountHolderName ?? null,
          bik: dto.bik ?? null,
          correspondentAccount: dto.correspondentAccount ?? null,
          paymentInstructions: dto.paymentInstructions ?? null,
          paymentMode: 'STATIC_QR',
          paymentConfigStatus: dto.paymentInstructions
            ? 'LEGACY_READY'
            : 'PENDING_REVIEW',
          status: 'ACTIVE',
        },
        include: { _count: { select: { products: true } } },
      });

      await tx.sellerProfile.update({
        where: { id: sellerProfile.id },
        data: {
          currentShopId: shop.id,
        },
      });

      return shop;
    });

    return this.mapShop(created);
  }

  async findAccessibleShops(user: AuthenticatedUser) {
    if (user.role === USER_ROLES.ADMIN) {
      return this.mapShops(
        await this.prisma.shop.findMany({
          orderBy: { name: 'asc' },
          include: { _count: { select: { products: true } } },
          take: 100,
        }),
      );
    }

    if (user.role !== USER_ROLES.SELLER) {
      throw new ForbiddenException('Only sellers or admins can list shops.');
    }

    return this.mapShops(
      await this.prisma.shop.findMany({
        where: {
          sellerProfile: {
            userId: user.userId,
          },
        },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
    );
  }

  async findOne(shopId: string, user: AuthenticatedUser) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        _count: { select: { products: true } },
        sellerProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }

    if (
      user.role !== USER_ROLES.ADMIN &&
      shop.sellerProfile.userId !== user.userId
    ) {
      throw new ForbiddenException('You do not have access to this shop.');
    }

    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      logoUrl: shop.logoUrl,
      status: shop.status,
      sellerProfileId: shop.sellerProfileId,
      productCount: shop._count.products,
      contactInfo: shop.contactInfo,
      bankName: shop.bankName,
      accountNumber: shop.accountNumber,
      accountHolderName: shop.accountHolderName,
      paymentMode: shop.paymentMode,
      paymentConfigStatus: shop.paymentConfigStatus,
      recipientPhone: shop.recipientPhone,
      sbpPhone: shop.sbpPhone,
      staticQrImageUrl: shop.staticQrImageUrl,
      bik: shop.bik,
      correspondentAccount: shop.correspondentAccount,
      paymentInstructions: shop.paymentInstructions,
    };
  }

  async findPaymentSettings(shopId: string) {
    const shop = await this.findShopOrThrow(shopId);
    return this.toPaymentSettingsResponse(shop);
  }

  async updatePaymentSettings(
    shopId: string,
    dto: {
      paymentMode?: 'STATIC_QR';
      status?: 'READY' | 'DISABLED' | 'PENDING_REVIEW';
      bankName?: string;
      recipientName?: string;
      recipientPhone?: string;
      recipientAccount?: string;
      sbpPhone?: string;
      paymentInstruction?: string;
    },
  ) {
    const current = await this.findShopOrThrow(shopId);

    const nextStatus =
      dto.status === 'DISABLED'
        ? 'DISABLED'
        : this.resolveDesiredPaymentConfigStatus({
            bankName: dto.bankName ?? current.bankName,
            recipientName: dto.recipientName ?? current.accountHolderName,
            recipientAccount: dto.recipientAccount ?? current.accountNumber,
            sbpPhone: dto.sbpPhone ?? current.sbpPhone,
            staticQrImageUrl: current.staticQrImageUrl,
            paymentInstruction:
              dto.paymentInstruction ?? current.paymentInstructions,
            requestedStatus: dto.status ?? current.paymentConfigStatus,
          });

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        paymentMode: dto.paymentMode ?? current.paymentMode ?? 'STATIC_QR',
        paymentConfigStatus: nextStatus,
        bankName: dto.bankName?.trim() || null,
        accountHolderName: dto.recipientName?.trim() || null,
        recipientPhone: dto.recipientPhone
          ? normalizePhone(dto.recipientPhone, 'Recipient phone')
          : null,
        accountNumber: dto.recipientAccount?.trim() || null,
        sbpPhone: dto.sbpPhone
          ? normalizePhone(dto.sbpPhone, 'SBP phone')
          : null,
        paymentInstructions: dto.paymentInstruction?.trim() || null,
      },
    });

    return this.toPaymentSettingsResponse(updated);
  }

  async uploadPaymentQr(shopId: string, file: ProductImageUploadFile) {
    this.assertPaymentQrFile(file);
    const current = await this.findShopOrThrow(shopId);
    const stored = await this.filesService.storeShopPaymentQr(file, { shopId });

    if (current.staticQrStorageKey || current.staticQrImageUrl) {
      await this.filesService.deleteStoredFile({
        storageKey: current.staticQrStorageKey,
        fileUrl: current.staticQrImageUrl,
      });
    }

    const nextStatus = this.resolveDesiredPaymentConfigStatus({
      bankName: current.bankName,
      recipientName: current.accountHolderName,
      recipientAccount: current.accountNumber,
      sbpPhone: current.sbpPhone,
      staticQrImageUrl: stored.publicUrl,
      paymentInstruction: current.paymentInstructions,
      requestedStatus: current.paymentConfigStatus,
    });

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        staticQrImageUrl: stored.publicUrl,
        staticQrStorageKey: stored.storageKey,
        staticQrOriginalName: stored.originalName,
        staticQrMimeType: stored.mimeType,
        staticQrSize: stored.size,
        paymentConfigStatus: nextStatus,
      },
    });

    return this.toPaymentSettingsResponse(updated);
  }

  private mapShops(
    shops: Array<{
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      status: string;
      sellerProfileId: string;
      contactInfo: string | null;
      bankName: string | null;
      accountNumber: string | null;
      accountHolderName: string | null;
      paymentMode: string | null;
      paymentConfigStatus: string;
      recipientPhone: string | null;
      sbpPhone: string | null;
      staticQrImageUrl: string | null;
      bik: string | null;
      correspondentAccount: string | null;
      paymentInstructions: string | null;
      _count: { products: number };
    }>,
  ) {
    return shops.map((shop) => this.mapShop(shop));
  }

  private mapShop(shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    status: string;
    sellerProfileId: string;
    contactInfo: string | null;
    bankName: string | null;
    accountNumber: string | null;
    accountHolderName: string | null;
    paymentMode: string | null;
    paymentConfigStatus: string;
    recipientPhone: string | null;
    sbpPhone: string | null;
    staticQrImageUrl: string | null;
    bik: string | null;
    correspondentAccount: string | null;
    paymentInstructions: string | null;
    _count: { products: number };
  }) {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      logoUrl: shop.logoUrl,
      status: shop.status,
      sellerProfileId: shop.sellerProfileId,
      productCount: shop._count.products,
      contactInfo: shop.contactInfo,
      bankName: shop.bankName,
      accountNumber: shop.accountNumber,
      accountHolderName: shop.accountHolderName,
      paymentMode: shop.paymentMode,
      paymentConfigStatus: shop.paymentConfigStatus,
      recipientPhone: shop.recipientPhone,
      sbpPhone: shop.sbpPhone,
      staticQrImageUrl: shop.staticQrImageUrl,
      bik: shop.bik,
      correspondentAccount: shop.correspondentAccount,
      paymentInstructions: shop.paymentInstructions,
    };
  }

  private async findShopOrThrow(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }

    return shop;
  }

  private toPaymentSettingsResponse(shop: {
    id: string;
    bankName: string | null;
    accountHolderName: string | null;
    recipientPhone: string | null;
    accountNumber: string | null;
    sbpPhone: string | null;
    staticQrImageUrl: string | null;
    paymentInstructions: string | null;
    paymentMode: string | null;
    paymentConfigStatus: string;
  }) {
    const panel = resolveShopPaymentPanel(shop);
    return {
      shopId: shop.id,
      paymentMode: panel.mode,
      status: panel.configStatus,
      bankName: panel.bankName,
      recipientName: panel.recipientName,
      recipientPhone: panel.recipientPhone,
      recipientAccount: panel.recipientAccount,
      sbpPhone: panel.sbpPhone,
      staticQrImageUrl: panel.staticQrImageUrl,
      paymentInstruction: panel.paymentInstruction,
      isReady: panel.isReady,
      usesLegacyInstructions: panel.usesLegacyInstructions,
    };
  }

  private resolveDesiredPaymentConfigStatus(input: {
    bankName?: string | null;
    recipientName?: string | null;
    recipientAccount?: string | null;
    sbpPhone?: string | null;
    staticQrImageUrl?: string | null;
    paymentInstruction?: string | null;
    requestedStatus?: string | null;
  }) {
    const hasQrFoundation =
      Boolean(input.bankName?.trim()) &&
      Boolean(input.recipientName?.trim()) &&
      Boolean(input.staticQrImageUrl?.trim()) &&
      Boolean(input.sbpPhone?.trim() || input.recipientAccount?.trim());

    if (input.requestedStatus === 'DISABLED') {
      return 'DISABLED';
    }

    if (hasQrFoundation) {
      return 'READY';
    }

    if (input.paymentInstruction?.trim()) {
      return 'LEGACY_READY';
    }

    return 'PENDING_REVIEW';
  }

  private assertPaymentQrFile(file?: ProductImageUploadFile | null) {
    if (!file) {
      throw new BadRequestException('QR image file is required.');
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported QR image type. Allowed: image/png, image/jpeg, image/webp.',
      );
    }
  }
}
