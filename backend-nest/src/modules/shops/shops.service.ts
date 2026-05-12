import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateShopDto } from './dto/create-shop.dto';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

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
      bik: shop.bik,
      correspondentAccount: shop.correspondentAccount,
      paymentInstructions: shop.paymentInstructions,
    };
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
      bik: shop.bik,
      correspondentAccount: shop.correspondentAccount,
      paymentInstructions: shop.paymentInstructions,
    };
  }
}
