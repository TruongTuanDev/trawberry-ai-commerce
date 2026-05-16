"use client";

import { create } from "zustand";
import type { PublicProduct } from "@/lib/public-api";

const CART_STORAGE_KEY = "strawberry-next-cart";

export type CartItem = {
  productId: string;
  variantId: string;
  shopId: string;
  shopName: string;
  productName: string;
  imageUrl: string | null;
  variantName: string;
  unitPrice: string;
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
  removeItem: (productId: string, variantId: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
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

function save(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items }));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { items?: CartItem[] };
      set({ items: parsed.items ?? [], hydrated: true });
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      set({ items: [], hydrated: true });
    }
  },
  addItem: (product, variant, quantity) => {
    const nextItem: CartItem = {
      productId: product.id,
      variantId: variant.id,
      shopId: product.shop.id,
      shopName: product.shop.name,
      productName: product.name,
      imageUrl: product.images[0]?.url ?? null,
      variantName: variantLabel(variant),
      unitPrice: variant.price ?? product.price ?? "0",
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
        ...existing,
        ...nextItem,
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
