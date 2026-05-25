"use client";

import { useI18n } from "@/i18n/use-i18n";

type ProductFiltersValue = {
  search: string;
  status: string;
  stockStatus: string;
  tab?: string;
};

export function ProductFilters({
  value,
  onChange,
  onSubmit,
}: {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n("seller");

  return (
    <div className="grid gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
      <input
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
        placeholder={t("seller.products.filters.searchPlaceholder")}
        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
        data-testid="seller-products-search-input"
      />
      <select
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value })}
        className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
        data-testid="seller-products-status-filter"
      >
        <option value="">{t("seller.products.filters.allStatuses")}</option>
        <option value="ACTIVE">{t("seller.products.filters.statusOptions.active")}</option>
        <option value="INACTIVE">{t("seller.products.filters.statusOptions.inactive")}</option>
        <option value="DRAFT">{t("seller.products.filters.statusOptions.draft")}</option>
        <option value="ARCHIVED">{t("seller.products.filters.statusOptions.archived")}</option>
      </select>
      <select
        value={value.stockStatus}
        onChange={(event) => onChange({ ...value, stockStatus: event.target.value })}
        className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
        data-testid="seller-products-stock-filter"
      >
        <option value="">{t("seller.products.filters.allStockStates")}</option>
        <option value="IN_STOCK">{t("seller.products.filters.stockOptions.inStock")}</option>
        <option value="LOW_STOCK">{t("seller.products.filters.stockOptions.lowStock")}</option>
        <option value="OUT_OF_STOCK">{t("seller.products.filters.stockOptions.outOfStock")}</option>
      </select>
      <button
        type="button"
        onClick={onSubmit}
        className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        data-testid="seller-products-apply-filters"
      >
        {t("seller.products.filters.apply")}
      </button>
    </div>
  );
}
