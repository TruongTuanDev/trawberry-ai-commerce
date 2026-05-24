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

export function getValidationMessage(
  input: {
    status: CartValidationStatus;
    productName: string | null;
    variantName: string | null;
    currentStock: number;
    maxQuantity: number;
    requestedQuantity: number;
    unitPrice: number | null;
    localUnitPrice?: number;
  },
  t: (key: string, args?: Record<string, string | number>) => string,
) {
  const name = input.productName ?? t("cart.validation.defaultItemName");
  const variant = input.variantName ? ` (${input.variantName})` : "";

  switch (input.status) {
    case "PRODUCT_NOT_FOUND":
      return t("cart.validation.productNotFound", { name, variant });
    case "PRODUCT_NOT_PUBLIC":
      return t("cart.validation.productNotPublic", { name, variant });
    case "PRODUCT_ARCHIVED":
      return t("cart.validation.productArchived", { name, variant });
    case "VARIANT_NOT_FOUND":
      return t("cart.validation.variantNotFound", { name, variant });
    case "OUT_OF_STOCK":
      return t("cart.validation.outOfStock", { name, variant });
    case "QUANTITY_EXCEEDS_STOCK":
      return t("cart.validation.quantityExceedsStock", {
        name,
        variant,
        maxQuantity: input.maxQuantity,
        requestedQuantity: input.requestedQuantity,
      });
    case "MISSING_PRICE":
      return t("cart.validation.missingPrice", { name, variant });
    case "PRICE_CHANGED":
      return t("cart.validation.priceChanged", {
        name,
        variant,
        oldPrice: formatMoneyNumber(input.localUnitPrice) ?? "N/A",
        newPrice: formatMoneyNumber(input.unitPrice) ?? "N/A",
      });
    default:
      return t("cart.validation.ready", { name, variant });
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
