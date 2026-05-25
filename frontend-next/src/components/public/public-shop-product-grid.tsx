"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/public/product-card";
import { useI18n } from "@/i18n/use-i18n";
import {
  getPublicProducts,
  type PaginatedPublicProducts,
  type PublicProduct,
} from "@/lib/public-api";

type SortKey = "newest" | "price_asc" | "price_desc";

export function PublicShopProductGrid({
  shopSlug,
  shopName,
}: {
  shopSlug: string;
  shopName: string;
}) {
  const { t } = useI18n("customer");
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<PaginatedPublicProducts["meta"]>({
    page: 1,
    size: 12,
    total: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicProducts({
          shopSlug,
          q: query.trim() || undefined,
          sort,
          page: 1,
          size: 12,
        });
        if (!mounted) {
          return;
        }
        setItems(response.items);
        setMeta(response.meta);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t("public.shop.loadProductsFailed"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [query, shopSlug, sort, t]);

  const sectionTitle = useMemo(
    () => t("public.shop.productsFromShop", { shop: shopName }),
    [shopName, t],
  );

  return (
    <section className="space-y-5" data-testid="public-shop-products-section">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("public.shop.products")}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)]">
            {sectionTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("public.shop.productCount", { count: meta.total })}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="public-shop-search">
            {t("public.shop.searchPlaceholder")}
          </label>
          <input
            id="public-shop-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("public.shop.searchPlaceholder")}
            className="min-w-[220px] rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
            data-testid="public-shop-search"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
            data-testid="public-shop-sort"
          >
            <option value="newest">{t("public.shop.sortNewest")}</option>
            <option value="price_asc">{t("public.shop.sortPriceAsc")}</option>
            <option value="price_desc">{t("public.shop.sortPriceDesc")}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <section className="card-panel rounded-[2rem] px-6 py-10 text-sm text-[var(--muted)]">
          {t("public.shop.loadingProducts")}
        </section>
      ) : error ? (
        <section className="card-panel rounded-[2rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-6 py-10 text-sm text-[var(--accent-strong)]">
          {error}
        </section>
      ) : items.length ? (
        <section
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="public-shop-products-grid"
        >
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <section
          className="card-panel rounded-[2rem] px-6 py-10 text-center sm:px-8"
          data-testid="public-shop-empty-state"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("public.shop.products")}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
            {t("public.shop.emptyProducts")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            {t("public.shop.emptyProductsSubtitle")}
          </p>
        </section>
      )}
    </section>
  );
}
