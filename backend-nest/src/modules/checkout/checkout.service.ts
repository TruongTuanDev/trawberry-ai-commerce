import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { CreateCheckoutOrderDto } from './dto/create-checkout-order.dto';
import { ProductReadinessService } from '../products/product-readiness.service';

type CheckoutProductRecord = {
  id: string;
  shopId: string;
  wbNmId: bigint;
  wbTitle: string;
  localTitle: string | null;
  seoSlug: string | null;
  sellerSku: string | null;
  visibility: string | null;
  catalogStatus: string;
  categoryId: bigint | null;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    id: string;
    name: string;
    paymentInstructions: string | null;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
};

type NormalizedCheckoutItem = {
  productId: string;
  variantId?: string;
  quantity: number;
};

type ValidatedCheckoutItem = {
  input: NormalizedCheckoutItem;
  product: CheckoutProductRecord;
  variant: ProductVariant;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

type CreatedCheckoutOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  shop: {
    id: string;
    name: string;
    paymentInstructions: string | null;
  };
  itemsCount: number;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async createOrder(
    dto: CreateCheckoutOrderDto,
    user?: AuthenticatedUser | null,
  ) {
    const normalizedRequestItems = this.normalizeItems(dto.items);
    const distinctProductIds = [
      ...new Set(normalizedRequestItems.map((item) => item.productId)),
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

    if (products.length !== distinctProductIds.length) {
      throw new NotFoundException('One or more products were not found.');
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const normalizedItems = normalizedRequestItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} was not found.`);
      }

      if (
        (product.catalogStatus ?? 'PUBLISHED') !== 'PUBLISHED' ||
        product.visibility !== 'ACTIVE' ||
        product.shop.status !== 'ACTIVE' ||
        product.shop.sellerProfile.approvalStatus !== 'APPROVED' ||
        product.images.length < 1 ||
        !this.productReadiness.getReadiness(product).ready
      ) {
        throw new BadRequestException(
          `Product ${item.productId} is not available for checkout.`,
        );
      }

      const variant = this.resolveVariant(product, item.variantId);
      if (!variant) {
        throw new BadRequestException(
          item.variantId
            ? `Variant ${item.variantId} is not available for product ${item.productId}.`
            : `Product ${item.productId} is not purchasable because it has no active priced variant.`,
        );
      }

      const availableStock = this.resolveAvailableStock(variant);
      if (variant.trackInventory && availableStock < item.quantity) {
        throw new BadRequestException(
          `Product ${item.productId} variant ${variant.id} does not have enough stock. Requested ${item.quantity}, available ${availableStock}.`,
        );
      }

      const unitPrice = this.resolveVariantPrice(variant);
      if (!unitPrice || unitPrice.lte(0)) {
        throw new BadRequestException(
          `Product ${item.productId} is not purchasable because its price is missing.`,
        );
      }

      return {
        input: item,
        product,
        variant,
        unitPrice,
        lineTotal: new Prisma.Decimal(unitPrice.toString()).mul(item.quantity),
      };
    });

    const customerId = await this.resolveCustomerId(dto, user);
    const itemsByShop = this.groupItemsByShop(normalizedItems);
    const grandTotal = this.sumLineTotals(normalizedItems);

    const created = await this.prisma.$transaction(async (tx) => {
      const marketplaceCheckout = await tx.marketplaceCheckout.create({
        data: {
          id: randomUUID(),
          checkoutCode: this.buildCheckoutCode(),
          customerUserId: user?.userId ?? null,
          customerName: dto.customer.fullName.trim(),
          customerPhone: dto.customer.phone.trim(),
          customerEmail: dto.customer.email?.trim() || null,
          grandTotal,
          status: 'PENDING',
        },
        select: {
          id: true,
          checkoutCode: true,
        },
      });
      for (const item of normalizedItems) {
        if (!item.variant.trackInventory) {
          continue;
        }

        const updatedVariant = await tx.productVariant.updateMany({
          where: {
            id: item.variant.id,
            stockQuantity: item.variant.stockQuantity,
            reservedStock: item.variant.reservedStock,
          },
          data: {
            stockQuantity: {
              decrement: item.input.quantity,
            },
            reservedStock: {
              increment: item.input.quantity,
            },
          },
        });

        if (updatedVariant.count !== 1) {
          throw new BadRequestException(
            `Product ${item.input.productId} stock changed during checkout. Please refresh and try again.`,
          );
        }
      }

      const createdOrders: CreatedCheckoutOrder[] = [];
      for (const [, shopItems] of itemsByShop) {
        const shop = shopItems[0].product.shop;
        const totalAmount = this.sumLineTotals(shopItems);

        const order = await tx.order.create({
          data: {
            id: randomUUID(),
            marketplaceCheckoutId: marketplaceCheckout.id,
            customerId,
            shopId: shop.id,
            orderNumber: this.buildOrderNumber(),
            status: 'PENDING',
            paymentStatus:
              dto.paymentMethod === 'CASH_ON_DELIVERY' ? 'UNPAID' : 'PENDING',
            totalAmount,
            shippingAddress: dto.customer.address,
            customerName: dto.customer.fullName.trim(),
            customerPhone: dto.customer.phone.trim(),
            customerEmail: dto.customer.email?.trim() || null,
            customerNote: dto.customer.note?.trim() || null,
            shippingCost: new Prisma.Decimal(0),
            shippingMethodName: dto.paymentMethod,
            items: {
              create: shopItems.map((item) => this.buildOrderItemCreate(item)),
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            shop: {
              select: {
                id: true,
                name: true,
                paymentInstructions: true,
              },
            },
          },
        });
        createdOrders.push({
          ...order,
          itemsCount: shopItems.reduce(
            (sum, item) => sum + item.input.quantity,
            0,
          ),
        });
      }

      return {
        marketplaceCheckout,
        orders: createdOrders,
      };
    });

    const firstOrder = created.orders[0];
    const orders = created.orders.map((order) => ({
      orderId: order.id,
      orderCode: order.orderNumber,
      shopId: order.shop.id,
      shopName: order.shop.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      paymentInstructions: order.shop.paymentInstructions,
      trackingPath: `/orders/${order.id}`,
      itemsCount: order.itemsCount,
    }));

    return {
      checkoutId: created.marketplaceCheckout.id,
      checkoutCode: created.marketplaceCheckout.checkoutCode,
      orderId: firstOrder.id,
      orderCode: firstOrder.orderNumber,
      status: firstOrder.status,
      paymentStatus: firstOrder.paymentStatus,
      totalAmount: firstOrder.totalAmount.toString(),
      paymentInstructions: firstOrder.shop.paymentInstructions,
      trackingPath: `/orders/${firstOrder.id}`,
      customerPhone: dto.customer.phone.trim(),
      orders,
      orderCodes: orders.map((order) => order.orderCode),
      grandTotal: grandTotal.toString(),
    };
  }

  private async resolveCustomerId(
    dto: CreateCheckoutOrderDto,
    user?: AuthenticatedUser | null,
  ) {
    if (user?.userId) {
      return user.userId;
    }

    const passwordHash = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
    const email =
      dto.customer.email?.trim().toLowerCase() ??
      `guest-checkout-${Date.now()}-${Math.round(Math.random() * 1_000_000)}@guest.local`;

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing && dto.customer.email) {
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.customer.fullName.trim(),
        phone: dto.customer.phone.trim(),
        role: USER_ROLES.CUSTOMER,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return created.id;
  }

  private normalizeItems(
    items: CreateCheckoutOrderDto['items'],
  ): NormalizedCheckoutItem[] {
    const quantityByProductId = new Map<string, number>();

    for (const item of items) {
      const key = `${item.productId}:${item.variantId ?? ''}`;
      quantityByProductId.set(
        key,
        (quantityByProductId.get(key) ?? 0) + item.quantity,
      );
    }

    return [...quantityByProductId.entries()].map(([key, quantity]) => {
      const [productId, variantId] = key.split(':');
      return {
        productId,
        variantId: variantId || undefined,
        quantity,
      };
    });
  }

  private resolveVariant(product: CheckoutProductRecord, variantId?: string) {
    if (variantId) {
      const variant = product.variants.find((entry) => entry.id === variantId);
      if (!variant) return null;
      const price = this.resolveVariantPrice(variant);
      return price !== null && price.gt(0) ? variant : null;
    }

    return (
      product.variants.find((variant) => {
        const price = this.resolveVariantPrice(variant);
        return (
          price !== null &&
          price.gt(0) &&
          (!variant.trackInventory || this.resolveAvailableStock(variant) > 0)
        );
      }) ?? null
    );
  }

  private resolveVariantPrice(variant: ProductVariant) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveAvailableStock(variant: ProductVariant) {
    return Math.max(0, variant.stockQuantity);
  }

  private groupItemsByShop(items: ValidatedCheckoutItem[]) {
    const byShop = new Map<string, ValidatedCheckoutItem[]>();
    for (const item of items) {
      const shopItems = byShop.get(item.product.shopId) ?? [];
      shopItems.push(item);
      byShop.set(item.product.shopId, shopItems);
    }
    return byShop;
  }

  private sumLineTotals(items: ValidatedCheckoutItem[]) {
    return items.reduce(
      (sum, item) => sum.plus(item.lineTotal),
      new Prisma.Decimal(0),
    );
  }

  private buildOrderItemCreate(item: ValidatedCheckoutItem) {
    return {
      id: randomUUID(),
      productId: item.product.id,
      variantId: item.variant.id,
      quantity: item.input.quantity,
      priceAtPurchase: item.unitPrice,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      productTitleSnapshot: item.product.localTitle ?? item.product.wbTitle,
      productSlugSnapshot: item.product.seoSlug ?? item.product.id,
      variantNameSnapshot: this.buildVariantName(item.variant),
      variantAttributesSnapshot: this.buildVariantName(item.variant),
      productImageSnapshot:
        item.product.images[0]?.localUrl ??
        item.product.images[0]?.wbUrl ??
        null,
      sellerSkuSnapshot:
        item.variant.sellerSku ?? item.product.sellerSku ?? null,
      barcodeSnapshot: item.variant.wbBarcode ?? null,
      wbNmIdSnapshot: item.product.wbNmId,
    };
  }

  private buildVariantName(variant: ProductVariant) {
    return (
      [variant.sizeName, variant.russianSize, variant.techSize, variant.wbSize]
        .filter(Boolean)
        .join(' / ') || null
    );
  }

  private buildOrderNumber() {
    return `ORD-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  }

  private buildCheckoutCode() {
    return `CHK-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  }
}
