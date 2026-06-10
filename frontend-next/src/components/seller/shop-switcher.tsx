"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function ShopSwitcher() {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const loading = useSellerWorkspaceStore((state) => state.loading);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  return (
    <div
      className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3"
      data-testid="seller-shop-switcher"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        {t("sellerShell.shopSwitcher")}
      </p>
      <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={currentShopId ?? ""}
          onChange={(event) => selectShop(event.target.value)}
          disabled={!user || loading || shops.length === 0}
          className={clsx(
            "w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none sm:min-w-[220px]",
            "disabled:cursor-not-allowed disabled:bg-[var(--panel)] disabled:text-[var(--muted)]",
          )}
        >
          {shops.length === 0 ? (
            <option value="">
              {loading ? t("sellerShell.loadingShops") : t("sellerShell.noShopsAvailable")}
            </option>
          ) : null}
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name} {"\u00b7"} {shop.status}
            </option>
          ))}
        </select>
        <div className="min-w-0 text-sm text-[var(--muted)]">
          {currentShop
            ? t("sellerShell.productsCount", { count: currentShop.productCount })
            : t("sellerShell.chooseActiveShop")}
        </div>
      </div>
    </div>
  );
}
