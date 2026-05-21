type ShopPaymentConfigSource = {
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  paymentInstructions?: string | null;
  paymentMode?: string | null;
  paymentConfigStatus?: string | null;
  recipientPhone?: string | null;
  sbpPhone?: string | null;
  staticQrImageUrl?: string | null;
};

type OrderPaymentSnapshotSource = {
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
  bankName: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAccount: string | null;
  sbpPhone: string | null;
  staticQrImageUrl: string | null;
  paymentInstruction: string | null;
  usesLegacyInstructions: boolean;
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

export function resolveShopPaymentPanel(
  source: ShopPaymentConfigSource,
): ResolvedPaymentPanel {
  const configStatus = resolveConfigStatus(source);
  const usesLegacyInstructions = configStatus === 'LEGACY_READY';

  return {
    mode: normalizeText(source.paymentMode) ?? 'STATIC_QR',
    configStatus,
    isReady: configStatus === 'READY' || configStatus === 'LEGACY_READY',
    bankName: normalizeText(source.bankName),
    recipientName: normalizeText(source.accountHolderName),
    recipientPhone: normalizeText(source.recipientPhone),
    recipientAccount: normalizeText(source.accountNumber),
    sbpPhone: normalizeText(source.sbpPhone),
    staticQrImageUrl: normalizeText(source.staticQrImageUrl),
    paymentInstruction: normalizeText(source.paymentInstructions),
    usesLegacyInstructions,
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
      bankName: normalizeText(order.paymentBankNameSnapshot),
      recipientName: normalizeText(order.paymentRecipientNameSnapshot),
      recipientPhone: normalizeText(order.paymentRecipientPhoneSnapshot),
      recipientAccount: normalizeText(order.paymentRecipientAccountSnapshot),
      sbpPhone: normalizeText(order.paymentSbpPhoneSnapshot),
      staticQrImageUrl: normalizeText(order.paymentQrImageUrlSnapshot),
      paymentInstruction: normalizeText(order.paymentInstructionSnapshot),
      usesLegacyInstructions: !normalizeText(order.paymentQrImageUrlSnapshot),
    };
  }

  return resolveShopPaymentPanel(shop ?? {});
}
