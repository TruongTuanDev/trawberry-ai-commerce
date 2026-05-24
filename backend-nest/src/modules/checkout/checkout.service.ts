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
import {
  buildYandexAddressComment,
  buildYandexAddressFullname,
  computeAddressGeoReadiness,
  formatCustomerAddressSnapshot,
  validateYandexManualAddress,
} from '../../common/utils/customer-address.util';
import { resolveShopPaymentPanel } from '../../common/utils/shop-payment.util';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PAYMENT_METHOD_LABELS,
  isPayOnDeliverySellerQrMethod,
  isPrepaidLikePaymentMethod,
  type CheckoutPaymentMethod,
} from '../../common/constants/payment-methods.constant';
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
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  itemsCount: number;
};

type ResolvedCheckoutCustomer = {
  country: string;
  fullName: string;
  phone: string;
  email: string | null;
  address: string;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  street: string | null;
  building: string | null;
  entrance: string | null;
  noEntrance: boolean;
  intercom: string | null;
  floor: string | null;
  noFloor: boolean;
  apartment: string | null;
  noApartment: boolean;
  geoPrecision: string | null;
  addressFullName: string | null;
  yandexComment: string | null;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartValidationService: CartValidationService,
    private readonly notificationsService: NotificationsService,
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
          this.buildValidationErrorPayload(firstInvalid),
        );
      }
      throw new BadRequestException(
        this.buildValidationErrorPayload(firstInvalid),
      );
    }

    const normalizedItems = validation.items.map((item) =>
      this.toValidatedCheckoutItem(item),
    );

    if (user?.role === USER_ROLES.CUSTOMER && !dto.addressId) {
      throw new BadRequestException({
        code: 'CUSTOMER_ADDRESS_REQUIRED',
        message:
          'You must configure a delivery-ready saved customer address before placing the order.',
        missingFields: ['addressId'],
      });
    }

    const checkoutCustomer = await this.resolveCheckoutCustomer(dto, user);
    const addressGeoReadiness = computeAddressGeoReadiness({
      country: checkoutCustomer.country,
      city: checkoutCustomer.city ?? '',
      street: checkoutCustomer.street ?? '',
      building: checkoutCustomer.building ?? '',
      entrance: checkoutCustomer.entrance,
      noEntrance: checkoutCustomer.noEntrance,
      intercom: checkoutCustomer.intercom,
      floor: checkoutCustomer.floor,
      noFloor: checkoutCustomer.noFloor,
      apartment: checkoutCustomer.apartment,
      noApartment: checkoutCustomer.noApartment,
      latitude: checkoutCustomer.latitude,
      longitude: checkoutCustomer.longitude,
      geoPrecision: checkoutCustomer.geoPrecision,
      addressFullName: checkoutCustomer.addressFullName,
      comment: checkoutCustomer.note,
      phone: checkoutCustomer.phone,
    });
    const manualAddressValidation = validateYandexManualAddress({
      country: checkoutCustomer.country,
      city: checkoutCustomer.city ?? '',
      street: checkoutCustomer.street ?? '',
      building: checkoutCustomer.building ?? '',
      entrance: checkoutCustomer.entrance,
      noEntrance: checkoutCustomer.noEntrance,
      intercom: checkoutCustomer.intercom,
      floor: checkoutCustomer.floor,
      noFloor: checkoutCustomer.noFloor,
      apartment: checkoutCustomer.apartment,
      noApartment: checkoutCustomer.noApartment,
      latitude: checkoutCustomer.latitude,
      longitude: checkoutCustomer.longitude,
      geoPrecision: checkoutCustomer.geoPrecision,
      addressFullName: checkoutCustomer.addressFullName,
      comment: checkoutCustomer.note,
      fullName: checkoutCustomer.fullName,
      phone: checkoutCustomer.phone,
    });
    if (dto.addressId && !manualAddressValidation.valid) {
      throw new BadRequestException({
        code: 'CUSTOMER_ADDRESS_NOT_YANDEX_READY',
        message: 'Saved address is not ready for Yandex manual delivery.',
        missingFields: manualAddressValidation.missingFields,
      });
    }
    const addressWarnings = [
      ...(!manualAddressValidation.valid
        ? [
            `Address needs more Yandex delivery detail: ${manualAddressValidation.missingFields.join(', ')}.`,
          ]
        : []),
      ...(manualAddressValidation.yandexManualReady &&
      !addressGeoReadiness.hasCoordinates
        ? [
            'Coordinates missing; seller may need to verify address manually before using Yandex.',
          ]
        : []),
    ];
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
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message:
              'Product stock changed during checkout. Please refresh and try again.',
          });
        }
      }

      const createdOrders: CreatedCheckoutOrder[] = [];
      for (const [, shopItems] of itemsByShop) {
        const shop = shopItems[0].product.shop;
        const paymentPanel = resolveShopPaymentPanel(shop);
        const totalAmount = this.sumLineTotals(shopItems);
        this.assertSupportedPaymentMethod(
          dto.paymentMethod,
          totalAmount,
          shop.name,
          paymentPanel,
        );

        const order = await tx.order.create({
          data: {
            id: randomUUID(),
            marketplaceCheckoutId: marketplaceCheckout.id,
            customerId,
            shopId: shop.id,
            orderNumber: this.buildOrderNumber(),
            status: 'PENDING',
            paymentStatus: this.resolveInitialPaymentStatus(dto.paymentMethod),
            totalAmount,
            shippingAddress: checkoutCustomer.address,
            shippingLatitude:
              checkoutCustomer.latitude !== null
                ? new Prisma.Decimal(checkoutCustomer.latitude)
                : null,
            shippingLongitude:
              checkoutCustomer.longitude !== null
                ? new Prisma.Decimal(checkoutCustomer.longitude)
                : null,
            dropoffAddressFullName: checkoutCustomer.addressFullName,
            dropoffCity: checkoutCustomer.city,
            dropoffStreet: checkoutCustomer.street,
            dropoffBuilding: checkoutCustomer.building,
            dropoffEntrance: checkoutCustomer.entrance,
            dropoffNoEntrance: checkoutCustomer.noEntrance,
            dropoffIntercom: checkoutCustomer.intercom,
            dropoffFloor: checkoutCustomer.floor,
            dropoffNoFloor: checkoutCustomer.noFloor,
            dropoffApartment: checkoutCustomer.apartment,
            dropoffNoApartment: checkoutCustomer.noApartment,
            dropoffLatitude:
              checkoutCustomer.latitude !== null
                ? new Prisma.Decimal(checkoutCustomer.latitude)
                : null,
            dropoffLongitude:
              checkoutCustomer.longitude !== null
                ? new Prisma.Decimal(checkoutCustomer.longitude)
                : null,
            dropoffGeoPrecision: checkoutCustomer.geoPrecision,
            dropoffComment: checkoutCustomer.yandexComment,
            customerName: checkoutCustomer.fullName,
            customerPhone: checkoutCustomer.phone,
            customerEmail: checkoutCustomer.email,
            customerNote: checkoutCustomer.note,
            shippingCost: new Prisma.Decimal(0),
            shippingMethodName: dto.paymentMethod,
            paymentMethod: dto.paymentMethod,
            paymentMethodLabel: PAYMENT_METHOD_LABELS[dto.paymentMethod],
            paymentFlowStage: this.resolveInitialPaymentFlowStage(
              dto.paymentMethod,
            ),
            depositPercentSnapshot: paymentPanel.capabilities.depositPercent,
            depositRequiredAboveAmountSnapshot: paymentPanel.capabilities
              .depositRequiredAboveAmount
              ? new Prisma.Decimal(
                  paymentPanel.capabilities.depositRequiredAboveAmount,
                )
              : null,
            codMaxOrderAmountSnapshot: paymentPanel.capabilities
              .codMaxOrderAmount
              ? new Prisma.Decimal(paymentPanel.capabilities.codMaxOrderAmount)
              : null,
            yandexCardOnDeliveryStatusSnapshot:
              paymentPanel.capabilities.yandexCardOnDeliveryStatus,
            cashCourierCollectionStatusSnapshot:
              paymentPanel.capabilities.cashCourierCollectionStatus,
            paymentModeSnapshot: paymentPanel.mode,
            paymentBankNameSnapshot: paymentPanel.bankName,
            paymentRecipientNameSnapshot: paymentPanel.recipientName,
            paymentRecipientPhoneSnapshot: paymentPanel.recipientPhone,
            paymentRecipientAccountSnapshot: paymentPanel.recipientAccount,
            paymentSbpPhoneSnapshot: paymentPanel.sbpPhone,
            paymentQrImageUrlSnapshot: paymentPanel.staticQrImageUrl,
            paymentInstructionSnapshot: paymentPanel.paymentInstruction,
            paymentReviewLogs: {
              create: {
                id: randomUUID(),
                action: isPayOnDeliverySellerQrMethod(dto.paymentMethod)
                  ? 'pay_on_delivery_selected'
                  : dto.paymentMethod === 'YANDEX_CARD_ON_DELIVERY'
                    ? 'yandex_payment_on_delivery_config_checked'
                    : 'payment_method_selected',
                fromStatus: null,
                toStatus: this.resolveInitialPaymentStatus(dto.paymentMethod),
                note: `Checkout selected ${PAYMENT_METHOD_LABELS[dto.paymentMethod]}.`,
                shop: {
                  connect: { id: shop.id },
                },
                reviewer: {
                  connect: { id: customerId },
                },
              },
            },
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
            paymentMethod: true,
            paymentMethodLabel: true,
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

    // Notify sellers of new orders
    for (const order of created.orders) {
      try {
        const shop = await this.prisma.shop.findUnique({
          where: { id: order.shop.id },
          include: {
            sellerProfile: true,
          },
        });
        if (shop?.sellerProfile?.userId) {
          await this.notificationsService.createNotification({
            recipientUserId: shop.sellerProfile.userId,
            recipientRole: 'SELLER',
            shopId: order.shop.id,
            orderId: order.id,
            type: 'ORDER_NEW',
            title: 'Có đơn hàng mới',
            message: `Bạn có đơn hàng mới ${order.orderNumber} cần xử lý.`,
            actionUrl: `/seller/orders/${order.id}`,
            severity: 'INFO',
          });
        }
      } catch (err) {
        console.error('Failed to create new order notification', err);
      }
    }

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
      paymentMethod: order.paymentMethod,
      paymentMethodLabel: order.paymentMethodLabel,
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
      addressGeoReadiness,
      addressWarnings,
    }));

    return {
      checkoutId: created.marketplaceCheckout.id,
      checkoutCode: created.marketplaceCheckout.checkoutCode,
      orderId: firstOrder.id,
      orderCode: firstOrder.orderNumber,
      status: firstOrder.status,
      paymentStatus: firstOrder.paymentStatus,
      totalAmount: firstOrder.totalAmount.toString(),
      paymentMethod: firstOrder.paymentMethod,
      paymentMethodLabel: firstOrder.paymentMethodLabel,
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
      addressGeoReadiness,
      addressWarnings,
    };
  }

  private async resolveCheckoutCustomer(
    dto: CreateCheckoutOrderDto,
    user?: AuthenticatedUser | null,
  ): Promise<ResolvedCheckoutCustomer> {
    const email = dto.customer.email?.trim().toLowerCase() || null;
    const note = dto.customer.note?.trim() || null;

    if (!dto.addressId) {
      if (
        !dto.customer.fullName.trim() ||
        !dto.customer.phone.trim() ||
        !dto.customer.address?.trim()
      ) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Full name, phone, and address are required.',
        });
      }

      return {
        country: 'Russia',
        fullName: dto.customer.fullName.trim(),
        phone: normalizePhone(dto.customer.phone, 'Customer phone'),
        email,
        address: dto.customer.address.trim(),
        note,
        latitude: dto.customer.latitude ?? null,
        longitude: dto.customer.longitude ?? null,
        city: null,
        street: null,
        building: null,
        entrance: null,
        noEntrance: false,
        intercom: null,
        floor: null,
        noFloor: false,
        apartment: null,
        noApartment: false,
        geoPrecision:
          dto.customer.latitude && dto.customer.longitude
            ? 'MANUAL_PIN'
            : 'UNKNOWN',
        addressFullName: dto.customer.address.trim(),
        yandexComment: note,
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
      country: address.country || 'Russia',
      fullName: address.fullName,
      phone: address.phone,
      email,
      address: formatCustomerAddressSnapshot(address),
      note: note ?? address.comment ?? null,
      latitude: address.latitude ? Number(address.latitude.toString()) : null,
      longitude: address.longitude
        ? Number(address.longitude.toString())
        : null,
      city: address.city,
      street: address.street,
      building: address.building,
      entrance: address.entrance,
      noEntrance: address.noEntrance,
      intercom: address.intercom,
      floor: address.floor,
      noFloor: address.noFloor,
      apartment: address.apartment,
      noApartment: address.noApartment,
      geoPrecision: address.geoPrecision,
      addressFullName:
        address.addressFullName || buildYandexAddressFullname(address),
      yandexComment: buildYandexAddressComment(address),
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

  private buildValidationErrorPayload(item: CartValidationLine) {
    const variantId = item.variant?.id ?? item.input.variantId ?? 'unknown';

    switch (item.status) {
      case 'PRODUCT_NOT_FOUND':
        return {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: `Product ${item.input.productId} was not found.`,
        };
      case 'PRODUCT_ARCHIVED':
        return {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: `Product ${item.input.productId} is archived and no longer available for checkout.`,
        };
      case 'PRODUCT_NOT_PUBLIC':
        return {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: `Product ${item.input.productId} is not available for checkout.`,
        };
      case 'VARIANT_NOT_FOUND':
        return {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: `Variant ${variantId} is not available for product ${item.input.productId}.`,
        };
      case 'OUT_OF_STOCK':
        return {
          code: 'OUT_OF_STOCK',
          message: `Product ${item.input.productId} variant ${variantId} is out of stock.`,
        };
      case 'QUANTITY_EXCEEDS_STOCK':
        return {
          code: 'VALIDATION_ERROR',
          message: `Product ${item.input.productId} variant ${variantId} does not have enough stock. Requested ${item.input.quantity}, available ${item.maxQuantity}.`,
        };
      case 'MISSING_PRICE':
        return {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: `Product ${item.input.productId} is not purchasable because its price is missing.`,
        };
      default:
        return {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: `Product ${item.input.productId} is not available for checkout.`,
        };
    }
  }

  private assertSupportedPaymentMethod(
    paymentMethod: CheckoutPaymentMethod,
    totalAmount: Prisma.Decimal,
    shopName: string,
    paymentPanel: ReturnType<typeof resolveShopPaymentPanel>,
  ) {
    const unsupported = () =>
      new BadRequestException({
        code: 'SHOP_PAYMENT_METHOD_NOT_SUPPORTED',
        message: `${shopName} does not support ${paymentMethod}.`,
      });

    switch (paymentMethod) {
      case 'PREPAID_SELLER_QR':
        if (
          !paymentPanel.capabilities.sellerQrPaymentEnabled ||
          !paymentPanel.isReady
        ) {
          throw unsupported();
        }
        return;
      case 'PAY_ON_DELIVERY_SELLER_QR':
        if (
          !paymentPanel.capabilities.payOnDeliverySellerQrEnabled ||
          !paymentPanel.isReady
        ) {
          throw unsupported();
        }
        if (
          paymentPanel.capabilities.codMaxOrderAmount &&
          totalAmount.greaterThan(
            new Prisma.Decimal(paymentPanel.capabilities.codMaxOrderAmount),
          )
        ) {
          throw new BadRequestException({
            code: 'SHOP_PAYMENT_METHOD_NOT_SUPPORTED',
            message: `${shopName} exceeds the pay-on-delivery limit.`,
          });
        }
        return;
      case 'DEPOSIT_THEN_DELIVERY_PAYMENT':
        if (
          !paymentPanel.capabilities.depositPaymentEnabled ||
          !paymentPanel.isReady
        ) {
          throw unsupported();
        }
        return;
      case 'YANDEX_CARD_ON_DELIVERY':
        if (
          paymentPanel.capabilities.yandexCardOnDeliveryStatus !== 'AVAILABLE'
        ) {
          throw unsupported();
        }
        return;
      case 'CASH_COURIER_COLLECTION':
        throw unsupported();
      default:
        throw unsupported();
    }
  }

  private resolveInitialPaymentStatus(paymentMethod: CheckoutPaymentMethod) {
    if (isPayOnDeliverySellerQrMethod(paymentMethod)) {
      return 'PAY_ON_DELIVERY_SELECTED';
    }

    if (paymentMethod === 'YANDEX_CARD_ON_DELIVERY') {
      return 'YANDEX_PAYMENT_ON_DELIVERY_PENDING';
    }

    return 'PENDING';
  }

  private resolveInitialPaymentFlowStage(paymentMethod: CheckoutPaymentMethod) {
    if (isPrepaidLikePaymentMethod(paymentMethod)) {
      return 'AWAITING_PREPAID_CONFIRMATION';
    }
    if (isPayOnDeliverySellerQrMethod(paymentMethod)) {
      return 'AWAITING_SELLER_ACCEPTANCE';
    }
    if (paymentMethod === 'YANDEX_CARD_ON_DELIVERY') {
      return 'AWAITING_PROVIDER_AVAILABILITY';
    }
    return 'CHECKOUT_CREATED';
  }
}
