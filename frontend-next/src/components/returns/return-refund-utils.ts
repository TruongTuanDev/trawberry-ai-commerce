export function formatRub(value: string | number | null | undefined) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export const returnRefundTypeLabels: Record<string, string> = {
  REFUND_ONLY: "Refund only",
  RETURN_AND_REFUND: "Return and refund",
  EXCHANGE_REQUEST: "Exchange request",
  PAYMENT_DISPUTE_ONLY: "Payment dispute",
};

export const returnRefundReasonLabels: Record<string, string> = {
  WRONG_SIZE: "Wrong size",
  ITEM_NOT_AS_DESCRIBED: "Not as described",
  DAMAGED_ITEM: "Damaged item",
  MISSING_ITEM: "Missing item",
  WRONG_ITEM: "Wrong item",
  LATE_DELIVERY: "Late delivery",
  BUYER_CHANGED_MIND: "Buyer changed mind",
  PAYMENT_DISPUTE: "Payment dispute",
  OTHER: "Other",
};

export const returnRefundStatusLabels: Record<string, string> = {
  OPENED: "Opened",
  WAITING_SELLER_RESPONSE: "Waiting seller response",
  SELLER_ACCEPTED: "Seller accepted",
  SELLER_REJECTED: "Seller rejected",
  WAITING_BUYER_EVIDENCE: "Waiting buyer evidence",
  WAITING_RETURN_SHIPMENT: "Waiting return shipment",
  RETURN_IN_TRANSIT: "Return in transit",
  RETURN_RECEIVED: "Return received",
  ADMIN_REVIEW: "Admin review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REFUND_PENDING: "Refund pending",
  REFUND_MARKED_SENT: "Refund marked sent",
  REFUND_CONFIRMED: "Refund confirmed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function labelForReturnStatus(status: string) {
  return returnRefundStatusLabels[status] ?? status;
}

export function labelForReturnType(type: string) {
  return returnRefundTypeLabels[type] ?? type;
}

export function labelForReturnReason(reason: string) {
  return returnRefundReasonLabels[reason] ?? reason;
}

export function canCustomerConfirmRefund(status: string) {
  return ["REFUND_MARKED_SENT", "REFUND_PENDING", "APPROVED"].includes(status);
}

export function isReturnCaseClosed(status: string) {
  return ["CLOSED", "CANCELLED", "REJECTED", "REFUND_CONFIRMED"].includes(status);
}
