"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function ShopSwitcher() {
  const user = useAuthStore((state) => state.user);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const loading = useSellerWorkspaceStore((state) => state.loading);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Shop switcher</p>
      <div className="mt-2 flex items-center gap-3">
        <select
          value={currentShopId ?? ""}
          onChange={(event) => selectShop(event.target.value)}
          disabled={!user || loading || shops.length === 0}
          className={clsx(
            "min-w-[220px] rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none",
            "disabled:cursor-not-allowed disabled:bg-[var(--panel)] disabled:text-[var(--muted)]",
          )}
        >
          {shops.length === 0 ? <option value="">{loading ? "Loading shops..." : "No shops available"}</option> : null}
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name} · {shop.status}
            </option>
          ))}
        </select>
        <div className="text-sm text-[var(--muted)]">
          {currentShop ? `${currentShop.productCount} products` : "Choose active shop"}
        </div>
      </div>
    </div>
  );
}
