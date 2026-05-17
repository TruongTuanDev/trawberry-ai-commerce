import type {
  CartValidationStatus,
  PublicCartValidationResponse,
} from "@/lib/public-api";
import type { CartItem } from "@/stores/cart-store";

export function cartItemKey(productId: string, variantId?: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

export function buildCartValidationPayload(items: CartItem[]) {
  return {
    items: items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      clientUnitPrice: Number(item.unitPrice || 0),
    })),
  };
}

export function buildValidationMap(
  validation: PublicCartValidationResponse | null,
) {
  return new Map(
    (validation?.items ?? []).map((item) => [
      cartItemKey(item.productId, item.variantId),
      item,
    ]),
  );
}

export function isBlockingCartStatus(status: CartValidationStatus) {
  return status !== "OK" && status !== "PRICE_CHANGED";
}

export function canAdjustValidatedQuantity(status: CartValidationStatus) {
  return (
    status === "OK" ||
    status === "PRICE_CHANGED" ||
    status === "QUANTITY_EXCEEDS_STOCK"
  );
}

export function getValidationMessage(input: {
  status: CartValidationStatus;
  productName: string | null;
  variantName: string | null;
  currentStock: number;
  maxQuantity: number;
  requestedQuantity: number;
  unitPrice: number | null;
  localUnitPrice?: number;
}) {
  const name = input.productName ?? "This item";
  const variant = input.variantName ? ` (${input.variantName})` : "";

  switch (input.status) {
    case "PRODUCT_NOT_FOUND":
      return `${name}${variant} no longer exists in the marketplace.`;
    case "PRODUCT_NOT_PUBLIC":
      return `${name}${variant} is no longer public and cannot be purchased.`;
    case "PRODUCT_ARCHIVED":
      return `${name}${variant} was archived by the seller and is no longer available.`;
    case "VARIANT_NOT_FOUND":
      return `${name}${variant} no longer has the selected variant.`;
    case "OUT_OF_STOCK":
      return `${name}${variant} is out of stock.`;
    case "QUANTITY_EXCEEDS_STOCK":
      return `Only ${input.maxQuantity} left for ${name}${variant}. Your cart requested ${input.requestedQuantity}.`;
    case "MISSING_PRICE":
      return `${name}${variant} is missing a valid price and cannot be purchased right now.`;
    case "PRICE_CHANGED":
      return `Price changed for ${name}${variant}: ${formatMoneyNumber(input.localUnitPrice)} -> ${formatMoneyNumber(input.unitPrice)}.`;
    default:
      return `${name}${variant} is ready for checkout.`;
  }
}

export function getValidationTone(status: CartValidationStatus) {
  switch (status) {
    case "OK":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PRICE_CHANGED":
    case "QUANTITY_EXCEEDS_STOCK":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

export function formatMoneyNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return value.toFixed(2);
}
