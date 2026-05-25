"use client";

import Link from "next/link";
import { ProductCard } from "@/components/public/product-card";
import { useI18n } from "@/i18n/use-i18n";
import type { PublicProduct } from "@/lib/public-api";

export function HomeCatalogSectionClient({
  items,
  total,
}: {
  items: PublicProduct[];
  total: number;
}) {
  const { t } = useI18n("customer");

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("home.catalogTitle")}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
            <span data-testid="home-catalog-title">{t("home.allProducts")}</span>
          </h2>
          <p className="mt-2 text-sm font-medium text-[var(--muted)]">
            {t("home.availableProductsCount", { count: total })}
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-[0_12px_26px_rgba(31,31,41,0.05)] transition hover:-translate-y-0.5"
          data-testid="home-open-filters-link"
        >
          {t("home.openFilters")}
        </Link>
      </div>

      {items.length ? (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="products-grid">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <section
          className="card-panel rounded-[2rem] px-6 py-10 text-center sm:px-8"
          data-testid="products-empty-state"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("home.catalogTitle")}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
            {t("home.noProductsTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            {t("home.noProductsDesc")}
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/products"
              className="public-button-primary inline-flex px-5 py-3 text-sm"
            >
              {t("home.browseCatalog")}
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}
