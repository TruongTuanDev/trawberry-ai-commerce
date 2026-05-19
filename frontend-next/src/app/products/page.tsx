"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/public/product-card";
import { PromoSlider } from "@/components/public/promo-slider";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicProducts, type PaginatedPublicProducts, type PublicProduct } from "@/lib/public-api";
import { useCartStore } from "@/stores/cart-store";

type ProductsMeta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

const initialMeta: ProductsMeta = { page: 1, size: 12, total: 0, totalPages: 0 };

function readFilters(searchParams: { get(name: string): string | null }) {
  return {
    q: searchParams.get("q") ?? searchParams.get("search") ?? "",
    categorySlug: searchParams.get("categorySlug") ?? "",
    brand: searchParams.get("brand") ?? "",
    color: searchParams.get("color") ?? "",
    gender: searchParams.get("gender") ?? "",
    inStock: searchParams.get("inStock") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    sort: searchParams.get("sort") ?? "newest",
  };
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<PublicShell><main className="px-4 py-8 sm:px-6 sm:py-10"><div className="mx-auto max-w-7xl">Loading products...</div></main></PublicShell>}>
      <ProductsPageClient />
    </Suspense>
  );
}

function ProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProductsPageContent
      key={searchParams.toString()}
      searchParams={searchParams}
      router={router}
    />
  );
}

function ProductsPageContent({
  searchParams,
  router,
}: {
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
}) {
  const hydrateCart = useCartStore((state) => state.hydrate);
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>(initialMeta);
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [facets, setFacets] = useState<PaginatedPublicProducts["filters"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const page = Number(searchParams.get("page") ?? "1");
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.q.trim() ||
          filters.categorySlug ||
          filters.brand.trim() ||
          filters.color.trim() ||
          filters.gender.trim() ||
          filters.inStock ||
          filters.minPrice ||
          filters.maxPrice ||
          filters.sort !== "newest",
      ),
    [filters],
  );
  const activeFilterSummary = useMemo(
    () =>
      [
        filters.q.trim() ? `Search: ${filters.q.trim()}` : null,
        filters.categorySlug ? `Category: ${filters.categorySlug}` : null,
        filters.brand.trim() ? `Brand: ${filters.brand.trim()}` : null,
        filters.color.trim() ? `Color: ${filters.color.trim()}` : null,
        filters.gender.trim() ? `Gender: ${filters.gender.trim()}` : null,
        filters.inStock === "true"
          ? "In stock only"
          : filters.inStock === "false"
            ? "Out of stock only"
            : null,
        filters.minPrice ? `Min: ${filters.minPrice}` : null,
        filters.maxPrice ? `Max: ${filters.maxPrice}` : null,
        filters.sort !== "newest" ? `Sort: ${filters.sort}` : null,
      ].filter(Boolean) as string[],
    [filters],
  );

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicProducts({
          page,
          size: meta.size,
          q: filters.q || undefined,
          categorySlug: filters.categorySlug || undefined,
          brand: filters.brand || undefined,
          color: filters.color || undefined,
          gender: filters.gender || undefined,
          inStock: filters.inStock ? filters.inStock === "true" : undefined,
          minPrice: filters.minPrice || undefined,
          maxPrice: filters.maxPrice || undefined,
          sort: filters.sort || undefined,
        });
        if (!mounted) return;
        setItems(response.items);
        setMeta(response.meta);
        setFacets(response.filters);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load products.");
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
  }, [filters, meta.size, page, requestKey]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.categorySlug) params.set("categorySlug", filters.categorySlug);
    if (filters.brand.trim()) params.set("brand", filters.brand.trim());
    if (filters.color.trim()) params.set("color", filters.color.trim());
    if (filters.gender.trim()) params.set("gender", filters.gender.trim());
    if (filters.inStock) params.set("inStock", filters.inStock);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    params.set("page", "1");
    router.replace(`/products?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters(readFilters(new URLSearchParams()));
    if (typeof window !== "undefined") {
      window.location.assign("/products");
      return;
    }
    router.replace("/products");
  };

  const pageUrl = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/products?${params.toString()}`;
  };

  const categoryOptions = useMemo(() => facets?.categories ?? [], [facets]);

  return (
    <PublicShell>
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <PromoSlider compact />

          <section className="card-panel overflow-hidden rounded-[2.25rem]">
            <div className="grid gap-8 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,241,255,0.96))] px-6 py-8 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Marketplace catalog</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">
                  Product grid ngay dưới promo, giống nhịp marketplace thật.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  Search và filter vẫn giữ nguyên theo backend hiện tại: category, brand, color, gender, stock, price, sort. Chỉ thay đổi cấu trúc nhìn và độ ưu tiên thị giác.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                    public only
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                    backend data
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                    cart logic unchanged
                  </span>
                </div>
              </div>

              <form onSubmit={handleSearch} className="public-muted-card grid gap-3 rounded-[1.8rem] border-white/70 bg-white/92 p-4 shadow-[0_22px_46px_rgba(161,0,255,0.08)] sm:grid-cols-2">
                <div className="space-y-2 text-sm font-semibold text-[var(--foreground)] sm:col-span-2">
                  <label htmlFor="catalog-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Search catalog
                  </label>
                  <input
                    id="catalog-search"
                    value={filters.q}
                    onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Product name, article, brand, category"
                    className="public-input"
                    data-testid="marketplace-search"
                  />
                </div>
                <select value={filters.categorySlug} onChange={(event) => setFilters((current) => ({ ...current, categorySlug: event.target.value }))} className="public-input" data-testid="marketplace-category">
                  <option value="">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id || category.name} value={category.slug ?? ""}>{category.name}</option>
                  ))}
                </select>
                <input value={filters.brand} onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))} placeholder="Brand" className="public-input" data-testid="marketplace-brand" />
                <input value={filters.color} onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))} placeholder="Color" className="public-input" data-testid="marketplace-color" />
                <input value={filters.gender} onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))} placeholder="Gender" className="public-input" data-testid="marketplace-gender" />
                <select value={filters.inStock} onChange={(event) => setFilters((current) => ({ ...current, inStock: event.target.value }))} className="public-input" data-testid="marketplace-stock">
                  <option value="">Any stock</option>
                  <option value="true">In stock</option>
                  <option value="false">Out of stock</option>
                </select>
                <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} className="public-input" data-testid="marketplace-sort">
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price low to high</option>
                  <option value="price_desc">Price high to low</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="stock_desc">Stock high to low</option>
                </select>
                <input value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))} placeholder="Min price" type="number" className="public-input" />
                <input value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="Max price" type="number" className="public-input" />
                <button type="submit" className="public-button-primary px-5 py-3 text-sm" data-testid="marketplace-apply">
                  Search
                </button>
                <button type="button" onClick={clearFilters} className="public-button-secondary px-5 py-3 text-sm" data-testid="marketplace-clear">
                  Clear filters
                </button>
              </form>
            </div>
          </section>

          {error ? (
            <div
              className="rounded-[1.75rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-5 py-5 text-sm text-[var(--accent-strong)]"
              data-testid="products-error-state"
            >
              <p className="font-semibold">Unable to load public products.</p>
              <p className="mt-2 text-[var(--muted)]">{error}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setRequestKey((current) => current + 1)}
                  className="public-button-primary px-5 py-3 text-sm"
                  data-testid="products-error-retry"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="public-button-secondary px-5 py-3 text-sm"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Marketplace results
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)]">
                Сетка товаров
              </h2>
            </div>
            <p className="hidden text-sm text-[var(--muted)] md:block">
              {meta.total} public products
            </p>
          </div>

          {loading ? (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="products-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card-panel animate-pulse rounded-[1.75rem] overflow-hidden">
                  <div className="aspect-[4/3] bg-[var(--panel-strong)]" />
                  <div className="space-y-3 px-5 py-5">
                    <div className="h-3 w-28 rounded bg-[var(--panel-strong)]" />
                    <div className="h-6 w-3/4 rounded bg-[var(--panel-strong)]" />
                    <div className="h-4 w-full rounded bg-[var(--panel-strong)]" />
                    <div className="h-4 w-5/6 rounded bg-[var(--panel-strong)]" />
                  </div>
                </div>
              ))}
            </section>
          ) : items.length ? (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="products-grid">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          ) : (
            <section
              className="card-panel rounded-[2rem] px-6 py-10 text-center sm:px-10"
              data-testid={hasActiveFilters ? "products-no-results-state" : "products-empty-state"}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {hasActiveFilters ? "Search results" : "Marketplace"}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                {hasActiveFilters ? "Không tìm thấy sản phẩm phù hợp" : "Пока нет товаров"}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {hasActiveFilters
                  ? "Try another keyword, relax a filter, or return to the full public catalog."
                  : "Public products will appear here after a seller publishes marketplace-ready items."}
              </p>
              {activeFilterSummary.length ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2" data-testid="products-filter-summary">
                  {activeFilterSummary.map((summary) => (
                    <span
                      key={summary}
                      className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]"
                    >
                      {summary}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/products"
                  onClick={() => clearFilters()}
                  className="public-button-primary inline-flex px-5 py-3 text-sm"
                  data-testid="products-empty-clear"
                >
                  Clear filters
                </Link>
                <Link
                  href="/"
                  className="public-button-secondary inline-flex px-5 py-3 text-sm"
                  data-testid="products-empty-home"
                >
                  Back home
                </Link>
              </div>
            </section>
          )}

          <div className="public-muted-card flex flex-col gap-4 rounded-[1.5rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              Page {meta.page} of {Math.max(meta.totalPages, 1)}. {meta.total} public products found.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => router.replace(pageUrl(page - 1))}
                className="public-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= Math.max(meta.totalPages, 1)}
                onClick={() => router.replace(pageUrl(page + 1))}
                className="public-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
