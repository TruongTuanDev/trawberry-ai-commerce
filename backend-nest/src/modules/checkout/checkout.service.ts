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
import {
  createSyntheticEmailFromPhone,
  normalizePhone,
} from '../../common/utils/phone.util';
import { formatCustomerAddressSnapshot } from '../../common/utils/customer-address.util';
import { resolveShopPaymentPanel } from '../../common/utils/shop-payment.util';
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
  };
  paymentModeSnapshot: string | null;
  paymentBankNameSnapshot: string | null;
  paymentRecipientNameSnapshot: string | null;
  paymentRecipientPhoneSnapshot: string | null;
  paymentRecipientAccountSnapshot: string | null;
  paymentSbpPhoneSnapshot: string | null;
  paymentQrImageUrlSnapshot: string | null;
  paymentInstructionSnapshot: string | null;
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

    const checkoutCustomer = await this.resolveCheckoutCustomer(dto, user);
    const customerId = await this.resolveCustomerId(dto, user);
    const itemsByShop = this.groupItemsByShop(normalizedItems);
    const grandTotal = this.sumLineTotals(normalizedItems);

    const created = await this.prisma.$transaction(async (tx) => {
      const marketplaceCheckout = await tx.marketplaceCheckout.create({
        data: {
          id: randomUUID(),
          checkoutCode: this.buildCheckoutCode(),
          customerUserId: user?.userId ?? null,
          customerName: checkoutCustomer.fullName,
          customerPhone: checkoutCustomer.phone,
          customerEmail: checkoutCustomer.email,
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
        const paymentPanel = resolveShopPaymentPanel(shop);
        const totalAmount = this.sumLineTotals(shopItems);

        if (dto.paymentMethod === 'MANUAL_TRANSFER' && !paymentPanel.isReady) {
          throw new BadRequestException(
            `Shop ${shop.name} does not have direct seller payment instructions configured yet.`,
          );
        }

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
            shippingAddress: checkoutCustomer.address,
            customerName: checkoutCustomer.fullName,
            customerPhone: checkoutCustomer.phone,
            customerEmail: checkoutCustomer.email,
            customerNote: checkoutCustomer.note,
            shippingCost: new Prisma.Decimal(0),
            shippingMethodName: dto.paymentMethod,
            paymentModeSnapshot: paymentPanel.mode,
            paymentBankNameSnapshot: paymentPanel.bankName,
            paymentRecipientNameSnapshot: paymentPanel.recipientName,
            paymentRecipientPhoneSnapshot: paymentPanel.recipientPhone,
            paymentRecipientAccountSnapshot: paymentPanel.recipientAccount,
            paymentSbpPhoneSnapshot: paymentPanel.sbpPhone,
            paymentQrImageUrlSnapshot: paymentPanel.staticQrImageUrl,
            paymentInstructionSnapshot: paymentPanel.paymentInstruction,
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
              },
            },
            paymentModeSnapshot: true,
            paymentBankNameSnapshot: true,
            paymentRecipientNameSnapshot: true,
            paymentRecipientPhoneSnapshot: true,
            paymentRecipientAccountSnapshot: true,
            paymentSbpPhoneSnapshot: true,
            paymentQrImageUrlSnapshot: true,
            paymentInstructionSnapshot: true,
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
      paymentInstructions: order.paymentInstructionSnapshot,
      paymentDetails: {
        mode: order.paymentModeSnapshot,
        bankName: order.paymentBankNameSnapshot,
        recipientName: order.paymentRecipientNameSnapshot,
        recipientPhone: order.paymentRecipientPhoneSnapshot,
        recipientAccount: order.paymentRecipientAccountSnapshot,
        sbpPhone: order.paymentSbpPhoneSnapshot,
        staticQrImageUrl: order.paymentQrImageUrlSnapshot,
        paymentInstruction: order.paymentInstructionSnapshot,
      },
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
      paymentInstructions: firstOrder.paymentInstructionSnapshot,
      paymentDetails: {
        mode: firstOrder.paymentModeSnapshot,
        bankName: firstOrder.paymentBankNameSnapshot,
        recipientName: firstOrder.paymentRecipientNameSnapshot,
        recipientPhone: firstOrder.paymentRecipientPhoneSnapshot,
        recipientAccount: firstOrder.paymentRecipientAccountSnapshot,
        sbpPhone: firstOrder.paymentSbpPhoneSnapshot,
        staticQrImageUrl: firstOrder.paymentQrImageUrlSnapshot,
        paymentInstruction: firstOrder.paymentInstructionSnapshot,
      },
      trackingPath: `/orders/${firstOrder.id}`,
      customerPhone: checkoutCustomer.phone,
      orders,
      orderCodes: orders.map((order) => order.orderCode),
      grandTotal: grandTotal.toString(),
    };
  }

  private async resolveCheckoutCustomer(
    dto: CreateCheckoutOrderDto,
    user?: AuthenticatedUser | null,
  ) {
    const email = dto.customer.email?.trim().toLowerCase() || null;
    const note = dto.customer.note?.trim() || null;

    if (!dto.addressId) {
      if (
        !dto.customer.fullName.trim() ||
        !dto.customer.phone.trim() ||
        !dto.customer.address?.trim()
      ) {
        throw new BadRequestException(
          'Full name, phone, and address are required.',
        );
      }

      return {
        fullName: dto.customer.fullName.trim(),
        phone: normalizePhone(dto.customer.phone, 'Customer phone'),
        email,
        address: dto.customer.address.trim(),
        note,
      };
    }

    if (!user?.userId || user.role !== USER_ROLES.CUSTOMER) {
      throw new BadRequestException(
        'Saved addresses require an authenticated customer account.',
      );
    }

    const address = await this.prisma.customerAddress.findFirst({
      where: {
        id: dto.addressId,
        customerId: user.userId,
      },
    });

    if (!address) {
      throw new NotFoundException('Saved customer address was not found.');
    }

    return {
      fullName: address.fullName,
      phone: address.phone,
      email,
      address: formatCustomerAddressSnapshot(address),
      note: note ?? address.comment ?? null,
    };
  }

  private async resolveCustomerId(
    dto: CreateCheckoutOrderDto,
    user?: AuthenticatedUser | null,
  ) {
    if (user?.userId) {
      return user.userId;
    }

    const normalizedPhone = normalizePhone(
      dto.customer.phone,
      'Customer phone',
    );
    const normalizedEmail = dto.customer.email?.trim().toLowerCase() ?? null;
    const passwordHash = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
    const email =
      normalizedEmail ?? createSyntheticEmailFromPhone(normalizedPhone);

    const emailMatch = normalizedEmail
      ? await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            fullName: true,
          },
        })
      : null;
    const phoneMatch = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        fullName: true,
      },
    });

    if (emailMatch || phoneMatch) {
      const matchedUser = emailMatch ?? phoneMatch;
      if (!matchedUser) {
        throw new BadRequestException(
          'Customer contact details are already in use.',
        );
      }

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
