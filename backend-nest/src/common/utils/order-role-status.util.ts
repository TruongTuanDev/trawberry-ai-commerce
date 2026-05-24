import { isPayOnDeliverySellerQrMethod } from '../constants/payment-methods.constant';

type OrderRoleStatusInput = {
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  shippingMethodName?: string | null;
  paymentProofStatus?: string | null;
  deliveryStatus?: string | null;
  sellerArchivedAt?: Date | string | null;
};

export type SellerFulfillmentBucket =
  | 'NEW'
  | 'ASSEMBLING'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type SellerOrderBucket =
  | 'ALL'
  | 'NEW'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_PROOF'
  | 'TO_PACK'
  | 'READY_FOR_YANDEX'
  | 'IN_DELIVERY'
  | 'DELIVERED'
  | 'PAYMENT_ISSUES'
  | 'CANCELLED';

export type OrderDisplayState = {
  code: string;
  label: string;
  bucket: SellerOrderBucket;
  nextAction: string | null;
};

export type SellerFulfillmentState = {
  code: string;
  label: string;
  bucket: SellerFulfillmentBucket;
  nextAction: string | null;
};

const FINAL_PAID_STATUSES = new Set([
  'PAID',
  'APPROVED',
  'SELLER_CONFIRMED_DELIVERY_PAYMENT',
  'YANDEX_PAYMENT_ON_DELIVERY_PAID',
]);

const REJECTED_PAYMENT_STATUSES = new Set([
  'REJECTED',
  'FAILED',
  'DELIVERY_PAYMENT_REJECTED',
  'YANDEX_PAYMENT_ON_DELIVERY_FAILED',
]);

const DELIVERY_ACTIVE_STATUSES = new Set([
  'YANDEX_MANUAL_CREATED',
  'CREATED_MANUALLY',
  'CREATED',
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'IN_TRANSIT',
  'SHIPPING',
]);

const DELIVERY_ASSEMBLING_STATUSES = new Set([
  'READY_TO_CREATE_YANDEX',
  'YANDEX_MANUAL_CREATED',
  'CREATED_MANUALLY',
  'CREATED',
  'ASSEMBLING',
]);

const DELIVERY_IN_TRANSIT_STATUSES = new Set([
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'IN_TRANSIT',
  'SHIPPING',
]);

function resolvePaymentMethod(input: OrderRoleStatusInput) {
  return input.paymentMethod ?? input.shippingMethodName ?? null;
}

export function computeSellerFulfillmentState(
  input: OrderRoleStatusInput,
): SellerFulfillmentState {
  const deliveryStatus = input.deliveryStatus ?? null;
  const archived = Boolean(input.sellerArchivedAt);

  if (archived) {
    return {
      code: 'ARCHIVED',
      label: 'Archived',
      bucket: 'ARCHIVED',
      nextAction: null,
    };
  }

  if (
    input.status === 'CANCELLED' ||
    deliveryStatus === 'CANCELLED' ||
    deliveryStatus === 'FAILED'
  ) {
    return {
      code: deliveryStatus === 'FAILED' ? 'DELIVERY_FAILED' : 'CANCELLED',
      label: deliveryStatus === 'FAILED' ? 'Delivery cancelled' : 'Cancelled',
      bucket: 'CANCELLED',
      nextAction: null,
    };
  }

  if (input.status === 'DELIVERED' || deliveryStatus === 'DELIVERED') {
    return {
      code: 'COMPLETED',
      label: 'Completed',
      bucket: 'COMPLETED',
      nextAction: 'archive_order',
    };
  }

  if (
    DELIVERY_IN_TRANSIT_STATUSES.has(input.status) ||
    DELIVERY_IN_TRANSIT_STATUSES.has(deliveryStatus ?? '')
  ) {
    return {
      code: 'IN_TRANSIT',
      label: 'In delivery',
      bucket: 'IN_TRANSIT',
      nextAction: 'complete_or_cancel_delivery',
    };
  }

  if (
    input.status === 'READY_TO_CREATE_YANDEX' ||
    DELIVERY_ASSEMBLING_STATUSES.has(input.status) ||
    DELIVERY_ASSEMBLING_STATUSES.has(deliveryStatus ?? '')
  ) {
    return {
      code: 'ASSEMBLING',
      label: 'Assembling',
      bucket: 'ASSEMBLING',
      nextAction: 'handoff_to_delivery',
    };
  }

  return {
    code: 'NEW',
    label: 'New',
    bucket: 'NEW',
    nextAction: 'create_delivery_order',
  };
}

export function computeSellerOrderDisplayStatus(
  input: OrderRoleStatusInput,
): OrderDisplayState {
  const paymentMethod = resolvePaymentMethod(input);
  const isPayOnDelivery = isPayOnDeliverySellerQrMethod(paymentMethod);

  if (input.status === 'CANCELLED') {
    return {
      code: 'CANCELLED',
      label: 'Cancelled',
      bucket: 'CANCELLED',
      nextAction: null,
    };
  }

  if (
    REJECTED_PAYMENT_STATUSES.has(input.paymentStatus) ||
    input.deliveryStatus === 'FAILED'
  ) {
    return {
      code: 'PAYMENT_ISSUE',
      label: 'Payment issue',
      bucket: 'PAYMENT_ISSUES',
      nextAction: isPayOnDelivery
        ? 'resolve_delivery_payment_issue'
        : 'review_payment_issue',
    };
  }

  if (
    input.paymentProofStatus === 'BUYER_MARKED_PAID' &&
    input.paymentStatus !== 'BUYER_MARKED_DELIVERY_PAID'
  ) {
    return {
      code: 'PAYMENT_PROOF_SUBMITTED',
      label: 'Payment proof submitted',
      bucket: 'PAYMENT_PROOF',
      nextAction: 'review_payment_proof',
    };
  }

  if (
    input.paymentStatus === 'PAY_ON_DELIVERY_SELECTED' ||
    input.paymentStatus === 'SELLER_ACCEPTED_PAY_ON_DELIVERY'
  ) {
    return {
      code:
        input.paymentStatus === 'PAY_ON_DELIVERY_SELECTED'
          ? 'AWAITING_SELLER_ACCEPTANCE'
          : 'READY_FOR_DELIVERY_CREATION',
      label:
        input.paymentStatus === 'PAY_ON_DELIVERY_SELECTED'
          ? 'Waiting seller acceptance'
          : 'Accepted, waiting Yandex creation',
      bucket:
        input.paymentStatus === 'PAY_ON_DELIVERY_SELECTED'
          ? 'AWAITING_PAYMENT'
          : 'READY_FOR_YANDEX',
      nextAction:
        input.paymentStatus === 'PAY_ON_DELIVERY_SELECTED'
          ? 'accept_pay_on_delivery_order'
          : 'create_yandex_delivery',
    };
  }

  if (input.status === 'READY_TO_CREATE_YANDEX') {
    return {
      code: 'READY_TO_CREATE_YANDEX',
      label: 'Ready to create Yandex',
      bucket: 'READY_FOR_YANDEX',
      nextAction: 'create_yandex_delivery',
    };
  }

  if (
    DELIVERY_ACTIVE_STATUSES.has(input.deliveryStatus ?? '') ||
    DELIVERY_ACTIVE_STATUSES.has(input.status)
  ) {
    return {
      code:
        input.deliveryStatus === 'COURIER_ASSIGNED'
          ? 'COURIER_ASSIGNED'
          : input.deliveryStatus === 'PICKED_UP'
            ? 'PICKED_UP'
            : input.deliveryStatus === 'ON_THE_WAY'
              ? 'ON_THE_WAY'
              : input.deliveryStatus === 'YANDEX_MANUAL_CREATED' ||
                  input.status === 'YANDEX_MANUAL_CREATED'
                ? 'YANDEX_CREATED'
                : 'IN_DELIVERY',
      label:
        input.deliveryStatus === 'COURIER_ASSIGNED'
          ? 'Courier assigned'
          : input.deliveryStatus === 'PICKED_UP'
            ? 'Picked up'
            : input.deliveryStatus === 'ON_THE_WAY'
              ? 'On the way'
              : input.deliveryStatus === 'YANDEX_MANUAL_CREATED' ||
                  input.status === 'YANDEX_MANUAL_CREATED'
                ? 'Yandex created'
                : 'In delivery',
      bucket: 'IN_DELIVERY',
      nextAction:
        input.deliveryStatus === 'COURIER_ASSIGNED'
          ? 'mark_picked_up'
          : input.deliveryStatus === 'PICKED_UP'
            ? 'mark_on_the_way'
            : input.deliveryStatus === 'ON_THE_WAY'
              ? 'mark_delivered'
              : 'monitor_delivery',
    };
  }

  if (
    input.status === 'DELIVERED' ||
    input.deliveryStatus === 'DELIVERED' ||
    input.paymentStatus === 'DELIVERED_AWAITING_PAYMENT' ||
    input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID'
  ) {
    if (FINAL_PAID_STATUSES.has(input.paymentStatus)) {
      return {
        code: 'PAYMENT_COMPLETED',
        label: 'Payment completed',
        bucket: 'DELIVERED',
        nextAction: null,
      };
    }

    return {
      code:
        input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID'
          ? 'DELIVERED_PAYMENT_REVIEW'
          : 'DELIVERED_AWAITING_PAYMENT',
      label:
        input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID'
          ? 'Delivered, payment review pending'
          : 'Delivered, waiting payment',
      bucket: 'DELIVERED',
      nextAction:
        input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID'
          ? 'confirm_delivery_payment'
          : 'wait_for_delivery_payment',
    };
  }

  if (FINAL_PAID_STATUSES.has(input.paymentStatus)) {
    return {
      code: input.status === 'ASSEMBLING' ? 'PREPARING' : 'PAYMENT_CONFIRMED',
      label: input.status === 'ASSEMBLING' ? 'Preparing' : 'Payment confirmed',
      bucket: 'TO_PACK',
      nextAction:
        input.status === 'ASSEMBLING' ? 'continue_preparing' : 'prepare_order',
    };
  }

  if (input.status === 'NEW' || input.status === 'PENDING') {
    return {
      code: 'NEW_ORDER',
      label: 'New order',
      bucket: 'NEW',
      nextAction:
        input.paymentStatus === 'PENDING' || input.paymentStatus === 'UNPAID'
          ? 'wait_for_payment'
          : 'review_order',
    };
  }

  return {
    code: input.status,
    label: input.status,
    bucket: 'ALL',
    nextAction: null,
  };
}

export function computeAdminOrderOpsStatus(
  input: OrderRoleStatusInput,
): OrderDisplayState {
  const sellerStatus = computeSellerOrderDisplayStatus(input);

  if (sellerStatus.bucket === 'PAYMENT_PROOF') {
    return {
      code: 'PAYMENT_REVIEW_REQUIRED',
      label: 'Payment review required',
      bucket: 'PAYMENT_PROOF',
      nextAction: 'monitor_payment_review',
    };
  }

  if (input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID') {
    return {
      code: 'DELIVERY_PAYMENT_REVIEW_REQUIRED',
      label: 'Delivery payment review required',
      bucket: 'PAYMENT_ISSUES',
      nextAction: 'verify_delivery_payment',
    };
  }

  return sellerStatus;
}

export function computeCustomerOrderDisplayStatus(
  input: OrderRoleStatusInput,
): OrderDisplayState {
  const paymentMethod = resolvePaymentMethod(input);
  const isPayOnDelivery = isPayOnDeliverySellerQrMethod(paymentMethod);

  if (input.status === 'CANCELLED') {
    return {
      code: 'CANCELLED',
      label: 'Cancelled',
      bucket: 'CANCELLED',
      nextAction: null,
    };
  }

  if (
    input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID' ||
    input.paymentStatus === 'DELIVERED_AWAITING_PAYMENT'
  ) {
    return {
      code: input.paymentStatus,
      label:
        input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID'
          ? 'Payment under seller review'
          : 'Please pay the seller on delivery',
      bucket: 'DELIVERED',
      nextAction:
        input.paymentStatus === 'BUYER_MARKED_DELIVERY_PAID'
          ? 'wait_for_seller_confirmation'
          : 'mark_paid_on_delivery',
    };
  }

  if (input.paymentProofStatus === 'BUYER_MARKED_PAID') {
    return {
      code: 'PROOF_SUBMITTED',
      label: 'Payment proof submitted',
      bucket: 'PAYMENT_PROOF',
      nextAction: 'wait_for_seller_confirmation',
    };
  }

  if (FINAL_PAID_STATUSES.has(input.paymentStatus)) {
    return {
      code:
        input.status === 'DELIVERED' || input.deliveryStatus === 'DELIVERED'
          ? 'COMPLETED'
          : 'PAID',
      label:
        input.status === 'DELIVERED' || input.deliveryStatus === 'DELIVERED'
          ? 'Delivered'
          : 'Payment confirmed',
      bucket:
        input.status === 'DELIVERED' || input.deliveryStatus === 'DELIVERED'
          ? 'DELIVERED'
          : 'TO_PACK',
      nextAction: null,
    };
  }

  if (isPayOnDelivery && input.paymentStatus === 'PAY_ON_DELIVERY_SELECTED') {
    return {
      code: 'PAY_ON_DELIVERY_SELECTED',
      label: 'Pay the seller when you receive the order',
      bucket: 'AWAITING_PAYMENT',
      nextAction: 'wait_for_delivery',
    };
  }

  return {
    code: 'AWAITING_PAYMENT',
    label: 'Waiting for payment confirmation',
    bucket: 'AWAITING_PAYMENT',
    nextAction: isPayOnDelivery ? 'wait_for_delivery' : 'upload_payment_proof',
  };
}
