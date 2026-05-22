import {
  CASH_COURIER_COLLECTION_STATUSES,
  CHECKOUT_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  YANDEX_CARD_ON_DELIVERY_STATUSES,
  type CheckoutPaymentMethod,
} from '../constants/payment-methods.constant';

type ShopPaymentConfigSource = {
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  paymentInstructions?: string | null;
  paymentMode?: string | null;
  paymentConfigStatus?: string | null;
  allowPrepaidQr?: boolean | null;
  allowPayOnDeliverySellerQr?: boolean | null;
  allowDepositPayment?: boolean | null;
  depositPercent?: number | null;
  depositRequiredAboveAmount?: { toString(): string } | string | null;
  codMaxOrderAmount?: { toString(): string } | string | null;
  yandexCardOnDeliveryStatus?: string | null;
  cashCourierCollectionStatus?: string | null;
  recipientPhone?: string | null;
  sbpPhone?: string | null;
  staticQrImageUrl?: string | null;
};

type OrderPaymentSnapshotSource = {
  paymentMethod?: string | null;
  paymentMethodLabel?: string | null;
  depositPercentSnapshot?: number | null;
  depositRequiredAboveAmountSnapshot?: { toString(): string } | string | null;
  codMaxOrderAmountSnapshot?: { toString(): string } | string | null;
  yandexCardOnDeliveryStatusSnapshot?: string | null;
  cashCourierCollectionStatusSnapshot?: string | null;
  paymentModeSnapshot?: string | null;
  paymentBankNameSnapshot?: string | null;
  paymentRecipientNameSnapshot?: string | null;
  paymentRecipientPhoneSnapshot?: string | null;
  paymentRecipientAccountSnapshot?: string | null;
  paymentSbpPhoneSnapshot?: string | null;
  paymentQrImageUrlSnapshot?: string | null;
  paymentInstructionSnapshot?: string | null;
};

export type ResolvedPaymentPanel = {
  mode: string;
  configStatus: string;
  isReady: boolean;
  selectedPaymentMethod: string | null;
  selectedPaymentMethodLabel: string | null;
  bankName: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAccount: string | null;
  sbpPhone: string | null;
  staticQrImageUrl: string | null;
  paymentInstruction: string | null;
  usesLegacyInstructions: boolean;
  capabilities: {
    sellerQrPaymentEnabled: boolean;
    payOnDeliverySellerQrEnabled: boolean;
    depositPaymentEnabled: boolean;
    yandexCardOnDeliveryStatus: string;
    cashCourierCollectionStatus: string;
    availableMethods: CheckoutPaymentMethod[];
    depositPercent: number | null;
    depositRequiredAboveAmount: string | null;
    codMaxOrderAmount: string | null;
  };
};

function normalizeText(value?: string | null) {
  const next = value?.trim();
  return next ? next : null;
}

function resolveConfigStatus(source: ShopPaymentConfigSource) {
  if (source.paymentConfigStatus === 'DISABLED') {
    return 'DISABLED';
  }

  const hasExplicitQrConfig =
    normalizeText(source.staticQrImageUrl) &&
    normalizeText(source.accountHolderName) &&
    normalizeText(source.bankName) &&
    (normalizeText(source.sbpPhone) || normalizeText(source.accountNumber));

  if (source.paymentConfigStatus === 'READY' && hasExplicitQrConfig) {
    return 'READY';
  }

  if (hasExplicitQrConfig) {
    return 'READY';
  }

  if (normalizeText(source.paymentInstructions)) {
    return 'LEGACY_READY';
  }

  return source.paymentConfigStatus ?? 'PENDING_REVIEW';
}

function serializeDecimalLike(value?: { toString(): string } | string | null) {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === 'string' ? value : value.toString();
}

function resolveShopCapabilities(source: ShopPaymentConfigSource) {
  const sellerQrPaymentEnabled = source.allowPrepaidQr ?? true;
  const payOnDeliverySellerQrEnabled =
    source.allowPayOnDeliverySellerQr ?? false;
  const depositPaymentEnabled = source.allowDepositPayment ?? false;
  const yandexCardOnDeliveryStatus = YANDEX_CARD_ON_DELIVERY_STATUSES.includes(
    (source.yandexCardOnDeliveryStatus ?? '') as never,
  )
    ? (source.yandexCardOnDeliveryStatus as string)
    : 'NOT_CONFIGURED';
  const cashCourierCollectionStatus = CASH_COURIER_COLLECTION_STATUSES.includes(
    (source.cashCourierCollectionStatus ?? '') as never,
  )
    ? (source.cashCourierCollectionStatus as string)
    : 'NOT_AVAILABLE';

  const availableMethods = CHECKOUT_PAYMENT_METHODS.filter((method) => {
    switch (method) {
      case 'PREPAID_SELLER_QR':
        return sellerQrPaymentEnabled;
      case 'PAY_ON_DELIVERY_SELLER_QR':
        return payOnDeliverySellerQrEnabled;
      case 'DEPOSIT_THEN_DELIVERY_PAYMENT':
        return depositPaymentEnabled;
      case 'YANDEX_CARD_ON_DELIVERY':
        return yandexCardOnDeliveryStatus === 'AVAILABLE';
      case 'CASH_COURIER_COLLECTION':
        return false;
      default:
        return false;
    }
  });

  return {
    sellerQrPaymentEnabled,
    payOnDeliverySellerQrEnabled,
    depositPaymentEnabled,
    yandexCardOnDeliveryStatus,
    cashCourierCollectionStatus,
    availableMethods,
    depositPercent: source.depositPercent ?? null,
    depositRequiredAboveAmount: serializeDecimalLike(
      source.depositRequiredAboveAmount,
    ),
    codMaxOrderAmount: serializeDecimalLike(source.codMaxOrderAmount),
  };
}

export function resolveShopPaymentPanel(
  source: ShopPaymentConfigSource,
): ResolvedPaymentPanel {
  const configStatus = resolveConfigStatus(source);
  const usesLegacyInstructions = configStatus === 'LEGACY_READY';
  const capabilities = resolveShopCapabilities(source);

  return {
    mode: normalizeText(source.paymentMode) ?? 'STATIC_QR',
    configStatus,
    isReady: configStatus === 'READY' || configStatus === 'LEGACY_READY',
    selectedPaymentMethod: null,
    selectedPaymentMethodLabel: null,
    bankName: normalizeText(source.bankName),
    recipientName: normalizeText(source.accountHolderName),
    recipientPhone: normalizeText(source.recipientPhone),
    recipientAccount: normalizeText(source.accountNumber),
    sbpPhone: normalizeText(source.sbpPhone),
    staticQrImageUrl: normalizeText(source.staticQrImageUrl),
    paymentInstruction: normalizeText(source.paymentInstructions),
    usesLegacyInstructions,
    capabilities,
  };
}

export function resolveOrderPaymentPanel(
  order: OrderPaymentSnapshotSource,
  shop?: ShopPaymentConfigSource | null,
): ResolvedPaymentPanel {
  const hasSnapshot =
    normalizeText(order.paymentInstructionSnapshot) ||
    normalizeText(order.paymentQrImageUrlSnapshot) ||
    normalizeText(order.paymentRecipientNameSnapshot) ||
    normalizeText(order.paymentRecipientAccountSnapshot);

  if (hasSnapshot) {
    const selectedPaymentMethod = normalizeText(order.paymentMethod);
    return {
      mode: normalizeText(order.paymentModeSnapshot) ?? 'STATIC_QR',
      configStatus: normalizeText(order.paymentQrImageUrlSnapshot)
        ? 'READY'
        : normalizeText(order.paymentInstructionSnapshot)
          ? 'LEGACY_READY'
          : 'PENDING_REVIEW',
      isReady: Boolean(
        normalizeText(order.paymentQrImageUrlSnapshot) ||
        normalizeText(order.paymentInstructionSnapshot),
      ),
      selectedPaymentMethod,
      selectedPaymentMethodLabel:
        normalizeText(order.paymentMethodLabel) ??
        (selectedPaymentMethod && selectedPaymentMethod in PAYMENT_METHOD_LABELS
          ? PAYMENT_METHOD_LABELS[
              selectedPaymentMethod as CheckoutPaymentMethod
            ]
          : null),
      bankName: normalizeText(order.paymentBankNameSnapshot),
      recipientName: normalizeText(order.paymentRecipientNameSnapshot),
      recipientPhone: normalizeText(order.paymentRecipientPhoneSnapshot),
      recipientAccount: normalizeText(order.paymentRecipientAccountSnapshot),
      sbpPhone: normalizeText(order.paymentSbpPhoneSnapshot),
      staticQrImageUrl: normalizeText(order.paymentQrImageUrlSnapshot),
      paymentInstruction: normalizeText(order.paymentInstructionSnapshot),
      usesLegacyInstructions: !normalizeText(order.paymentQrImageUrlSnapshot),
      capabilities: {
        sellerQrPaymentEnabled: true,
        payOnDeliverySellerQrEnabled: false,
        depositPaymentEnabled: false,
        yandexCardOnDeliveryStatus:
          normalizeText(order.yandexCardOnDeliveryStatusSnapshot) ??
          'NOT_CONFIGURED',
        cashCourierCollectionStatus:
          normalizeText(order.cashCourierCollectionStatusSnapshot) ??
          'NOT_AVAILABLE',
        availableMethods: [],
        depositPercent: order.depositPercentSnapshot ?? null,
        depositRequiredAboveAmount: serializeDecimalLike(
          order.depositRequiredAboveAmountSnapshot,
        ),
        codMaxOrderAmount: serializeDecimalLike(
          order.codMaxOrderAmountSnapshot,
        ),
      },
    };
  }

  return resolveShopPaymentPanel(shop ?? {});
}
