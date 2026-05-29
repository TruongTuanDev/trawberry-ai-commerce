import { Injectable } from '@nestjs/common';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductReadinessService } from '../products/product-readiness.service';
import { ValidateCartItemDto } from './dto/validate-cart.dto';

export type CartValidationStatus =
  | 'OK'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_PUBLIC'
  | 'PRODUCT_ARCHIVED'
  | 'VARIANT_NOT_FOUND'
  | 'OUT_OF_STOCK'
  | 'QUANTITY_EXCEEDS_STOCK'
  | 'MISSING_PRICE'
  | 'PRICE_CHANGED';

export type CartValidationProductRecord = {
  id: string;
  shopId: string;
  wbNmId: bigint;
  wbTitle: string;
  localTitle: string | null;
  seoSlug: string | null;
  sellerSku: string | null;
  wbVendorCode: string | null;
  visibility: string | null;
  catalogStatus: string;
  categoryId: bigint | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    id: string;
    name: string;
    paymentInstructions: string | null;
    bankName: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    recipientPhone: string | null;
    sbpPhone: string | null;
    staticQrImageUrl: string | null;
    paymentMode: string | null;
    paymentConfigStatus: string;
    allowPrepaidQr: boolean | null;
    allowPayOnDeliverySellerQr: boolean | null;
    allowDepositPayment: boolean | null;
    depositPercent: number | null;
    depositRequiredAboveAmount: Prisma.Decimal | null;
    codMaxOrderAmount: Prisma.Decimal | null;
    yandexCardOnDeliveryStatus: string | null;
    cashCourierCollectionStatus: string | null;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
};

export type NormalizedCartValidationItem = {
  productId: string;
  variantId?: string;
  quantity: number;
  clientUnitPrice?: Prisma.Decimal | null;
};

export type CartValidationLine = {
  input: NormalizedCartValidationItem;
  available: boolean;
  status: CartValidationStatus;
  product: CartValidationProductRecord | null;
  variant: ProductVariant | null;
  unitPrice: Prisma.Decimal | null;
  currentStock: number;
  maxQuantity: number;
  trackInventory: boolean;
  lineTotal: Prisma.Decimal;
  productName: string | null;
  variantName: string | null;
  imageUrl: string | null;
  shopId: string | null;
  shopName: string | null;
};

export type CartValidationResult = {
  valid: boolean;
  items: CartValidationLine[];
  summary: {
    subtotal: Prisma.Decimal;
    invalidCount: number;
    changedCount: number;
  };
};

@Injectable()
export class CartValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async validateItems(
    rawItems: Array<
      Pick<ValidateCartItemDto, 'productId' | 'variantId' | 'quantity'> & {
        clientUnitPrice?: number | Prisma.Decimal | null;
      }
    >,
  ): Promise<CartValidationResult> {
    const items = this.normalizeItems(rawItems);
    const distinctProductIds = [
      ...new Set(items.map((item) => item.productId)),
    ];
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: distinctProductIds,
        },
      },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          where: {
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        shop: {
          select: {
            id: true,
            name: true,
            paymentInstructions: true,
            bankName: true,
            accountHolderName: true,
            accountNumber: true,
            recipientPhone: true,
            sbpPhone: true,
            staticQrImageUrl: true,
            paymentMode: true,
            paymentConfigStatus: true,
            allowPrepaidQr: true,
            allowPayOnDeliverySellerQr: true,
            allowDepositPayment: true,
            depositPercent: true,
            depositRequiredAboveAmount: true,
            codMaxOrderAmount: true,
            yandexCardOnDeliveryStatus: true,
            cashCourierCollectionStatus: true,
            status: true,
            sellerProfile: {
              select: {
                approvalStatus: true,
              },
            },
          },
        },
      },
    });

    const productMap = new Map(
      products.map((product) => [
        product.id,
        product as CartValidationProductRecord,
      ]),
    );

    const validatedItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        return this.buildUnavailableLine(item, 'PRODUCT_NOT_FOUND');
      }

      if (this.isArchivedProduct(product)) {
        return this.buildUnavailableLine(item, 'PRODUCT_ARCHIVED', product);
      }

      if (!this.hasPublicVisibilityAccess(product)) {
        return this.buildUnavailableLine(item, 'PRODUCT_NOT_PUBLIC', product);
      }

      const readiness = this.productReadiness.getReadiness(product);
      const canResolveVariantSpecificIssue = readiness.blockingReasons.every(
        (reason) =>
          reason === 'MISSING_PRICE' ||
          reason === 'MISSING_STOCK' ||
          reason === 'NO_ACTIVE_VARIANT',
      );
      if (!readiness.publicVisible && !canResolveVariantSpecificIssue) {
        return this.buildUnavailableLine(item, 'PRODUCT_NOT_PUBLIC', product);
      }

      const variant = this.resolveVariant(product, item.variantId);
      if (!variant) {
        return this.buildUnavailableLine(
          item,
          'VARIANT_NOT_FOUND',
          product,
          null,
        );
      }

      const resolvedUnitPrice = this.resolveVariantPrice(variant);
      const unitPrice = resolvedUnitPrice
        ? new Prisma.Decimal(resolvedUnitPrice.toString())
        : null;
      const currentStock = this.resolveAvailableStock(variant);
      const maxQuantity = variant.trackInventory ? currentStock : item.quantity;
      const lineTotal = unitPrice
        ? unitPrice.mul(
            this.resolveLineTotalQuantity(item.quantity, maxQuantity),
          )
        : new Prisma.Decimal(0);

      if (!unitPrice || unitPrice.lte(0)) {
        return this.buildLine({
          item,
          status: 'MISSING_PRICE',
          product,
          variant,
          unitPrice: null,
          currentStock,
          maxQuantity,
          trackInventory: variant.trackInventory,
          lineTotal: new Prisma.Decimal(0),
        });
      }

      if (variant.trackInventory && currentStock <= 0) {
        return this.buildLine({
          item,
          status: 'OUT_OF_STOCK',
          product,
          variant,
          unitPrice,
          currentStock,
          maxQuantity: 0,
          trackInventory: true,
          lineTotal: new Prisma.Decimal(0),
        });
      }

      if (variant.trackInventory && item.quantity > currentStock) {
        return this.buildLine({
          item,
          status: 'QUANTITY_EXCEEDS_STOCK',
          product,
          variant,
          unitPrice,
          currentStock,
          maxQuantity: currentStock,
          trackInventory: true,
          lineTotal,
        });
      }

      if (
        item.clientUnitPrice !== undefined &&
        item.clientUnitPrice !== null &&
        unitPrice.comparedTo(item.clientUnitPrice) !== 0
      ) {
        return this.buildLine({
          item,
          status: 'PRICE_CHANGED',
          product,
          variant,
          unitPrice,
          currentStock,
          maxQuantity,
          trackInventory: variant.trackInventory,
          lineTotal: new Prisma.Decimal(unitPrice.toString()).mul(
            item.quantity,
          ),
        });
      }

      return this.buildLine({
        item,
        status: 'OK',
        product,
        variant,
        unitPrice,
        currentStock,
        maxQuantity,
        trackInventory: variant.trackInventory,
        lineTotal: new Prisma.Decimal(unitPrice.toString()).mul(item.quantity),
      });
    });

    const invalidCount = validatedItems.filter(
      (item) => !item.available,
    ).length;
    const changedCount = validatedItems.filter(
      (item) => item.status === 'PRICE_CHANGED',
    ).length;
    const subtotal = validatedItems.reduce((sum, item) => {
      if (!item.available) {
        return sum;
      }
      return sum.plus(item.lineTotal.toString());
    }, new Prisma.Decimal(0));

    return {
      valid: invalidCount === 0,
      items: validatedItems,
      summary: {
        subtotal,
        invalidCount,
        changedCount,
      },
    };
  }

  toResponse(result: CartValidationResult) {
    return {
      valid: result.valid,
      items: result.items.map((item) => ({
        productId: item.input.productId,
        variantId: item.variant?.id ?? item.input.variantId ?? null,
        requestedQuantity: item.input.quantity,
        available: item.available,
        status: item.status,
        productName: item.productName,
        variantName: item.variantName,
        imageUrl: item.imageUrl,
        unitPrice: item.unitPrice ? Number(item.unitPrice.toString()) : null,
        currentStock: item.currentStock,
        maxQuantity: item.maxQuantity,
        trackInventory: item.trackInventory,
        lineTotal: Number(item.lineTotal.toString()),
        shopId: item.shopId,
        shopName: item.shopName,
      })),
      summary: {
        subtotal: Number(result.summary.subtotal.toString()),
        invalidCount: result.summary.invalidCount,
        changedCount: result.summary.changedCount,
      },
    };
  }

  private normalizeItems(
    items: Array<
      Pick<ValidateCartItemDto, 'productId' | 'variantId' | 'quantity'> & {
        clientUnitPrice?: number | Prisma.Decimal | null;
      }
    >,
  ): NormalizedCartValidationItem[] {
    const quantityByKey = new Map<string, NormalizedCartValidationItem>();

    for (const item of items) {
      const key = `${item.productId}:${item.variantId ?? ''}`;
      const current = quantityByKey.get(key);
      const clientUnitPrice =
        item.clientUnitPrice === undefined || item.clientUnitPrice === null
          ? null
          : item.clientUnitPrice instanceof Prisma.Decimal
            ? item.clientUnitPrice
            : new Prisma.Decimal(item.clientUnitPrice);

      if (current) {
        current.quantity += item.quantity;
        if (
          current.clientUnitPrice === undefined ||
          current.clientUnitPrice === null
        ) {
          current.clientUnitPrice = clientUnitPrice;
        }
        continue;
      }

      quantityByKey.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        clientUnitPrice,
      });
    }

    return [...quantityByKey.values()];
  }

  private buildUnavailableLine(
    item: NormalizedCartValidationItem,
    status:
      | 'PRODUCT_NOT_FOUND'
      | 'PRODUCT_NOT_PUBLIC'
      | 'PRODUCT_ARCHIVED'
      | 'VARIANT_NOT_FOUND',
    product?: CartValidationProductRecord | null,
    variant?: ProductVariant | null,
  ): CartValidationLine {
    return this.buildLine({
      item,
      status,
      product: product ?? null,
      variant: variant ?? null,
      unitPrice: null,
      currentStock: 0,
      maxQuantity: 0,
      trackInventory: true,
      lineTotal: new Prisma.Decimal(0),
    });
  }

  private buildLine(input: {
    item: NormalizedCartValidationItem;
    status: CartValidationStatus;
    product: CartValidationProductRecord | null;
    variant: ProductVariant | null;
    unitPrice: Prisma.Decimal | null;
    currentStock: number;
    maxQuantity: number;
    trackInventory: boolean;
    lineTotal: Prisma.Decimal;
  }): CartValidationLine {
    const productName = input.product
      ? (input.product.localTitle ?? input.product.wbTitle)
      : null;
    return {
      input: input.item,
      available: input.status === 'OK' || input.status === 'PRICE_CHANGED',
      status: input.status,
      product: input.product,
      variant: input.variant,
      unitPrice: input.unitPrice,
      currentStock: input.currentStock,
      maxQuantity: input.maxQuantity,
      trackInventory: input.trackInventory,
      lineTotal: input.lineTotal,
      productName,
      variantName: input.variant ? this.buildVariantName(input.variant) : null,
      imageUrl:
        input.product?.images[0]?.localUrl ??
        input.product?.images[0]?.wbUrl ??
        null,
      shopId: input.product?.shop.id ?? null,
      shopName: input.product?.shop.name ?? null,
    };
  }

  private resolveVariant(
    product: CartValidationProductRecord,
    variantId?: string,
  ) {
    if (variantId) {
      return product.variants.find((entry) => entry.id === variantId) ?? null;
    }

    return (
      product.variants.find((variant) => {
        const price = this.resolveVariantPrice(variant);
        return (
          price !== null &&
          price.gt(0) &&
          (!variant.trackInventory || this.resolveAvailableStock(variant) > 0)
        );
      }) ??
      product.variants.find((variant) => {
        const price = this.resolveVariantPrice(variant);
        return price !== null && price.gt(0);
      }) ??
      product.variants[0] ??
      null
    );
  }

  private resolveVariantPrice(variant: ProductVariant) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveAvailableStock(variant: ProductVariant) {
    return Math.max(0, variant.stockQuantity);
  }

  private resolveLineTotalQuantity(
    requestedQuantity: number,
    maxQuantity: number,
  ) {
    if (maxQuantity <= 0) {
      return 0;
    }
    return Math.min(requestedQuantity, maxQuantity);
  }

  private isArchivedProduct(product: CartValidationProductRecord) {
    return (
      product.catalogStatus === 'ARCHIVED' || product.visibility === 'ARCHIVED'
    );
  }

  private hasPublicVisibilityAccess(product: CartValidationProductRecord) {
    return (
      product.visibility === 'ACTIVE' &&
      product.shop.status === 'ACTIVE' &&
      product.shop.sellerProfile.approvalStatus === 'APPROVED' &&
      product.images.length > 0 &&
      (product.categoryId !== null ||
        product.categoryName !== null ||
        product.sourceCategoryName !== null)
    );
  }

  private buildVariantName(variant: ProductVariant) {
    return (
      [variant.sizeName, variant.russianSize, variant.techSize, variant.wbSize]
        .filter(Boolean)
        .join(' / ') || null
    );
  }
}
