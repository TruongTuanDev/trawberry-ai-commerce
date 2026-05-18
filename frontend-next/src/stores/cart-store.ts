"use client";

import { create } from "zustand";
import type { PublicProduct } from "@/lib/public-api";

const CART_STORAGE_KEY = "strawberry-next-cart-v2";
const AUTH_STORAGE_KEY = "strawberry-next-auth";

export type CartItem = {
  productId: string;
  variantId: string;
  shopId: string;
  shopName: string;
  productName: string;
  productNameSnapshot: string;
  imageUrl: string | null;
  imageUrlSnapshot: string | null;
  variantName: string;
  unitPrice: string;
  unitPriceSnapshot: string;
  quantity: number;
  availableQuantity: number;
  trackInventory: boolean;
};

type CartState = {
  items: CartItem[];
  hydrated: boolean;
  hydrate: () => void;
  addItem: (
    product: PublicProduct,
    variant: PublicProduct["variants"][number],
    quantity: number,
  ) => void;
  updateQuantity: (
    productId: string,
    variantId: string,
    quantity: number,
  ) => void;
  patchItem: (
    productId: string,
    variantId: string,
    patch: Partial<CartItem>,
  ) => void;
  removeItem: (productId: string, variantId: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
};

type PersistedCart = {
  itemsByCustomer?: Record<string, CartItem[]>;
};

type PersistedAnonymousCart = {
  items?: CartItem[];
};

function variantLabel(variant: PublicProduct["variants"][number]) {
  return (
    [variant.sizeName, variant.russianSize, variant.techSize, variant.wbSize]
      .filter(Boolean)
      .join(" / ") || "Default variant"
  );
}

function clampQuantity(
  quantity: number,
  item: Pick<CartItem, "trackInventory" | "availableQuantity">,
) {
  const normalized = Math.max(1, Math.floor(quantity || 1));
  return item.trackInventory
    ? Math.min(normalized, Math.max(1, item.availableQuantity))
    : normalized;
}

function normalizeItems(items: CartItem[]) {
  return items.map((item) => ({
    ...item,
    productNameSnapshot: item.productNameSnapshot ?? item.productName,
    imageUrlSnapshot:
      item.imageUrlSnapshot === undefined ? item.imageUrl : item.imageUrlSnapshot,
    unitPriceSnapshot: item.unitPriceSnapshot ?? item.unitPrice,
  }));
}

function getCurrentCustomerId() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      user?: { id?: string; role?: string } | null;
    };
    return parsed.user?.role === "CUSTOMER" && parsed.user.id ? parsed.user.id : null;
  } catch {
    return null;
  }
}

function loadItems() {
  if (typeof window === "undefined") {
    return [];
  }

  const customerId = getCurrentCustomerId();
  if (customerId) {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as PersistedCart;
      return normalizeItems(parsed.itemsByCustomer?.[customerId] ?? []);
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }
  }

  const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as PersistedAnonymousCart;
    return normalizeItems(parsed.items ?? []);
  } catch {
    window.sessionStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

function save(items: CartItem[]) {
  if (typeof window === "undefined") return;

  const customerId = getCurrentCustomerId();
  if (customerId) {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    let parsed: PersistedCart = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as PersistedCart;
      } catch {
        parsed = {};
      }
    }
    const next: PersistedCart = {
      itemsByCustomer: {
        ...(parsed.itemsByCustomer ?? {}),
        [customerId]: items,
      },
    };
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    return;
  }

  window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items }));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  hydrated: false,
  hydrate: () => {
    set({ items: loadItems(), hydrated: true });
  },
  addItem: (product, variant, quantity) => {
    const nextItem: CartItem = {
      productId: product.id,
      variantId: variant.id,
      shopId: product.shop.id,
      shopName: product.shop.name,
      productName: product.name,
      productNameSnapshot: product.name,
      imageUrl: product.images[0]?.url ?? null,
      imageUrlSnapshot: product.images[0]?.url ?? null,
      variantName: variantLabel(variant),
      unitPrice: variant.price ?? product.price ?? "0",
      unitPriceSnapshot: variant.price ?? product.price ?? "0",
      quantity: Math.max(1, quantity),
      availableQuantity: variant.availableQuantity,
      trackInventory: variant.trackInventory,
    };
    const items = [...get().items];
    const existingIndex = items.findIndex(
      (item) => item.productId === product.id && item.variantId === variant.id,
    );
    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      items[existingIndex] = {
        ...nextItem,
        productNameSnapshot:
          existing.productNameSnapshot ?? nextItem.productNameSnapshot,
        imageUrlSnapshot:
          existing.imageUrlSnapshot === undefined
            ? nextItem.imageUrlSnapshot
            : existing.imageUrlSnapshot,
        unitPriceSnapshot:
          existing.unitPriceSnapshot ?? nextItem.unitPriceSnapshot,
        quantity: clampQuantity(existing.quantity + quantity, nextItem),
      };
    } else {
      nextItem.quantity = clampQuantity(quantity, nextItem);
      items.push(nextItem);
    }
    save(items);
    set({ items });
  },
  updateQuantity: (productId, variantId, quantity) => {
    const items = get().items.map((item) =>
      item.productId === productId && item.variantId === variantId
        ? { ...item, quantity: clampQuantity(quantity, item) }
        : item,
    );
    save(items);
    set({ items });
  },
  patchItem: (productId, variantId, patch) => {
    const items = [...get().items];
    const index = items.findIndex(
      (item) => item.productId === productId && item.variantId === variantId,
    );
    if (index < 0) {
      return;
    }
    const current = items[index];
    const changed = Object.entries(patch).some(([key, value]) => {
      const field = key as keyof CartItem;
      return current[field] !== value;
    });
    if (!changed) {
      return;
    }
    items[index] = {
      ...current,
      ...patch,
    };
    save(items);
    set({ items });
  },
  removeItem: (productId, variantId) => {
    const items = get().items.filter(
      (item) => item.productId !== productId || item.variantId !== variantId,
    );
    save(items);
    set({ items });
  },
  clearCart: () => {
    save([]);
    set({ items: [] });
  },
  getSubtotal: () =>
    get().items.reduce(
      (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
      0,
    ),
  getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}));
