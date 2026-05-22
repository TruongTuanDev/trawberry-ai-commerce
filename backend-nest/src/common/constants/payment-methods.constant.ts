export const CHECKOUT_PAYMENT_METHODS = [
  'PREPAID_SELLER_QR',
  'PAY_ON_DELIVERY_SELLER_QR',
  'DEPOSIT_THEN_DELIVERY_PAYMENT',
  'YANDEX_CARD_ON_DELIVERY',
  'CASH_COURIER_COLLECTION',
] as const;

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

export const YANDEX_CARD_ON_DELIVERY_STATUSES = [
  'NOT_CONFIGURED',
  'PROVIDER_PENDING',
  'AVAILABLE',
  'DISABLED',
] as const;

export type YandexCardOnDeliveryStatus =
  (typeof YANDEX_CARD_ON_DELIVERY_STATUSES)[number];

export const CASH_COURIER_COLLECTION_STATUSES = [
  'NOT_AVAILABLE',
  'DISABLED',
] as const;

export type CashCourierCollectionStatus =
  (typeof CASH_COURIER_COLLECTION_STATUSES)[number];

export const PAYMENT_METHOD_LABELS: Record<CheckoutPaymentMethod, string> = {
  PREPAID_SELLER_QR: 'Trả trước qua QR người bán',
  PAY_ON_DELIVERY_SELLER_QR:
    'Thanh toán khi nhận hàng bằng QR/SBP cho người bán',
  DEPOSIT_THEN_DELIVERY_PAYMENT: 'Đặt cọc trước, trả phần còn lại khi nhận',
  YANDEX_CARD_ON_DELIVERY: 'Yandex card on delivery',
  CASH_COURIER_COLLECTION: 'Cash courier collection',
};

export function isPrepaidLikePaymentMethod(method: string | null | undefined) {
  return (
    method === 'PREPAID_SELLER_QR' || method === 'DEPOSIT_THEN_DELIVERY_PAYMENT'
  );
}

export function isPayOnDeliverySellerQrMethod(
  method: string | null | undefined,
) {
  return method === 'PAY_ON_DELIVERY_SELLER_QR';
}
