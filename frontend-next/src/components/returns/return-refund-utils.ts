import type { Locale } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import { useLocaleStore } from "@/i18n/locale-store";

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

export function labelForReturnStatus(status: string, locale?: string) {
  const activeLocale = (locale ?? (typeof window !== "undefined" ? useLocaleStore.getState().cookieLocale : "ru") ?? "ru") as Locale;
  const key = `common.status.return.${status}`;
  const translated = translate(activeLocale, key);
  return translated === key ? (returnRefundStatusLabels[status] ?? status) : translated;
}

export function labelForReturnType(type: string, locale?: string) {
  const activeLocale = (locale ?? (typeof window !== "undefined" ? useLocaleStore.getState().cookieLocale : "ru") ?? "ru") as Locale;
  const key = `common.returnTypes.${type}`;
  const translated = translate(activeLocale, key);
  return translated === key ? (returnRefundTypeLabels[type] ?? type) : translated;
}

export function labelForReturnReason(reason: string, locale?: string) {
  const activeLocale = (locale ?? (typeof window !== "undefined" ? useLocaleStore.getState().cookieLocale : "ru") ?? "ru") as Locale;
  const dictKey = reason === "ITEM_NOT_AS_DESCRIBED" ? "NOT_AS_DESCRIBED" : reason === "BUYER_CHANGED_MIND" ? "CHANGED_MIND" : reason;
  const key = `common.returnReasons.${dictKey}`;
  const translated = translate(activeLocale, key);
  return translated === key ? (returnRefundReasonLabels[reason] ?? reason) : translated;
}

export function canCustomerConfirmRefund(status: string) {
  return ["REFUND_MARKED_SENT", "REFUND_PENDING", "APPROVED"].includes(status);
}

export function isReturnCaseClosed(status: string) {
  return ["CLOSED", "CANCELLED", "REJECTED", "REFUND_CONFIRMED"].includes(status);
}
