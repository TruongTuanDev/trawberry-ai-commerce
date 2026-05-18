import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, type ProductVariant } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { CreateCheckoutOrderDto } from './dto/create-checkout-order.dto';
import {
  CartValidationLine,
  CartValidationProductRecord,
  CartValidationService,
} from './cart-validation.service';

type ValidatedCheckoutItem = {
  input: {
    productId: string;
    variantId?: string;
    quantity: number;
  };
  product: CartValidationProductRecord;
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
    private readonly cartValidationService: CartValidationService,
  ) {}

  async createOrder(
    dto: CreateCheckoutOrderDto,
    user?: AuthenticatedUser | null,
  ) {
    const validation = await this.cartValidationService.validateItems(
      dto.items,
    );
    const firstInvalid = validation.items.find((item) => !item.available);
    if (firstInvalid) {
      if (firstInvalid.status === 'PRODUCT_NOT_FOUND') {
        throw new NotFoundException(
          this.buildValidationErrorMessage(firstInvalid),
        );
      }
      throw new BadRequestException(
        this.buildValidationErrorMessage(firstInvalid),
      );
    }

    const normalizedItems = validation.items.map((item) =>
      this.toValidatedCheckoutItem(item),
    );

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

    const normalizedPhone = dto.customer.phone.trim();
    const normalizedEmail = dto.customer.email?.trim().toLowerCase() ?? null;
    const passwordHash = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
    const email =
      normalizedEmail ??
      `guest-checkout-${Date.now()}-${Math.round(Math.random() * 1_000_000)}@guest.local`;

    const existingMatches = await this.prisma.user.findMany({
      where: {
        OR: [
          normalizedEmail ? { email: normalizedEmail } : undefined,
          { phone: normalizedPhone },
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        fullName: true,
      },
    });

    if (existingMatches.length > 0) {
      const emailMatch = normalizedEmail
        ? existingMatches.find(
            (candidate) => candidate.email === normalizedEmail,
          )
        : null;
      const phoneMatch = existingMatches.find(
        (candidate) => candidate.phone === normalizedPhone,
      );
      const matchedUser = emailMatch ?? phoneMatch ?? existingMatches[0];

      if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
        throw new BadRequestException(
          'Customer contact details are already in use.',
        );
      }

      if (matchedUser.role !== USER_ROLES.CUSTOMER) {
        throw new BadRequestException(
          'Customer contact details are already in use.',
        );
      }

      const shouldBackfillName =
        !matchedUser.fullName && dto.customer.fullName.trim().length > 0;
      const shouldBackfillPhone = !matchedUser.phone;
      const shouldBackfillEmail = !matchedUser.email && !!normalizedEmail;

      if (shouldBackfillName || shouldBackfillPhone || shouldBackfillEmail) {
        await this.prisma.user.update({
          where: { id: matchedUser.id },
          data: {
            ...(shouldBackfillName
              ? { fullName: dto.customer.fullName.trim() }
              : {}),
            ...(shouldBackfillPhone ? { phone: normalizedPhone } : {}),
            ...(shouldBackfillEmail ? { email: normalizedEmail } : {}),
          },
        });
      }

      return matchedUser.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.customer.fullName.trim(),
        phone: normalizedPhone,
        role: USER_ROLES.CUSTOMER,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return created.id;
  }

  private toValidatedCheckoutItem(
    item: CartValidationLine,
  ): ValidatedCheckoutItem {
    if (!item.product || !item.variant || !item.unitPrice) {
      throw new BadRequestException(
        `Product ${item.input.productId} is not available for checkout.`,
      );
    }

    return {
      input: {
        productId: item.input.productId,
        variantId: item.variant.id,
        quantity: item.input.quantity,
      },
      product: item.product,
      variant: item.variant,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice.mul(item.input.quantity),
    };
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

  private buildValidationErrorMessage(item: CartValidationLine) {
    const variantId = item.variant?.id ?? item.input.variantId ?? 'unknown';

    switch (item.status) {
      case 'PRODUCT_NOT_FOUND':
        return `Product ${item.input.productId} was not found.`;
      case 'PRODUCT_ARCHIVED':
        return `Product ${item.input.productId} is archived and no longer available for checkout.`;
      case 'PRODUCT_NOT_PUBLIC':
        return `Product ${item.input.productId} is not available for checkout.`;
      case 'VARIANT_NOT_FOUND':
        return `Variant ${variantId} is not available for product ${item.input.productId}.`;
      case 'OUT_OF_STOCK':
        return `Product ${item.input.productId} variant ${variantId} is out of stock.`;
      case 'QUANTITY_EXCEEDS_STOCK':
        return `Product ${item.input.productId} variant ${variantId} does not have enough stock. Requested ${item.input.quantity}, available ${item.maxQuantity}.`;
      case 'MISSING_PRICE':
        return `Product ${item.input.productId} is not purchasable because its price is missing.`;
      default:
        return `Product ${item.input.productId} is not available for checkout.`;
    }
  }
}
