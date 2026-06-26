import type { PublicProduct } from "@/lib/public-api";
import type { CartItem } from "@/stores/cart-store";

export function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function getVariantLabel(variant: PublicProduct["variants"][number]) {
  const clothingSize = variant.sizeName?.trim() || variant.techSize?.trim() || null;
  const russianSize =
    variant.russianSize?.trim() || variant.wbSize?.trim() || null;

  if (
    clothingSize &&
    russianSize &&
    clothingSize.toLocaleLowerCase() === russianSize.toLocaleLowerCase()
  ) {
    return clothingSize;
  }

  return [clothingSize, russianSize].filter(Boolean).join(" / ") || "Default variant";
}

export function getProductPrimaryVariant(product: PublicProduct) {
  return (
    product.variants.find((variant) => variant.inStock) ?? product.variants[0] ?? null
  );
}

export function getCartItem(
  items: CartItem[],
  productId: string,
  variantId: string | null | undefined,
) {
  if (!variantId) {
    return null;
  }

  return (
    items.find(
      (item) => item.productId === productId && item.variantId === variantId,
    ) ?? null
  );
}

export function getCartQuantity(
  items: CartItem[],
  productId: string,
  variantId: string | null | undefined,
) {
  return getCartItem(items, productId, variantId)?.quantity ?? 0;
}

export function hasSelectableVariants(product: PublicProduct) {
  return product.variants.length > 1;
}

type TranslateFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function getStockState(product: PublicProduct, t: TranslateFn) {
  if (!product.inStock) {
    return {
      label: t("productDetail.outOfStock"),
      tone: "text-rose-700 bg-rose-50 border-rose-200",
    };
  }

  const primaryVariant = getProductPrimaryVariant(product);
  const threshold = primaryVariant?.lowStockThreshold ?? 3;
  if (product.availableQuantity <= threshold) {
    return {
      label: t("productDetail.lowStockCount", {
        count: formatCount(product.availableQuantity),
      }),
      tone: "text-amber-700 bg-amber-50 border-amber-200",
    };
  }

  return {
    label: t("productDetail.inStockCount", {
      count: formatCount(product.availableQuantity),
    }),
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };
}

export function getComparableOldPrice(
  price: string | null | undefined,
  oldPrice: string | null | undefined,
) {
  const current = Number(price ?? 0);
  const previous = Number(oldPrice ?? 0);

  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= current) {
    return null;
  }

  return oldPrice ?? null;
}
