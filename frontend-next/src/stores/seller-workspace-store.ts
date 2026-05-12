"use client";

import { create } from "zustand";
import { getSellerShops, type ShopSummary } from "@/lib/seller-api";

const STORAGE_KEY = "strawberry-next-seller-workspace";

type SellerWorkspaceState = {
  shops: ShopSummary[];
  currentShopId: string | null;
  loading: boolean;
  hydrated: boolean;
  hydrate: () => void;
  loadShops: (token: string) => Promise<void>;
  selectShop: (shopId: string) => void;
  clear: () => void;
};

function saveCurrentShopId(currentShopId: string | null) {
  if (typeof window === "undefined") return;

  if (!currentShopId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentShopId }));
}

export const useSellerWorkspaceStore = create<SellerWorkspaceState>((set, get) => ({
  shops: [],
  currentShopId: null,
  loading: false,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { currentShopId?: string };
      set({
        currentShopId: parsed.currentShopId ?? null,
        hydrated: true,
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      set({ currentShopId: null, hydrated: true });
    }
  },
  loadShops: async (token: string) => {
    set({ loading: true });

    try {
      const shops = await getSellerShops(token);
      const currentShopId = get().currentShopId;
      const fallbackShopId = shops[0]?.id ?? null;
      const nextShopId = shops.some((shop) => shop.id === currentShopId) ? currentShopId : fallbackShopId;

      saveCurrentShopId(nextShopId);
      set({
        shops,
        currentShopId: nextShopId,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
  selectShop: (shopId: string) => {
    saveCurrentShopId(shopId);
    set({ currentShopId: shopId });
  },
  clear: () => {
    saveCurrentShopId(null);
    set({
      shops: [],
      currentShopId: null,
      loading: false,
      hydrated: false,
    });
  },
}));
