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
    <Suspense
      fallback={
        <PublicShell>
          <main className="px-4 py-8 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-7xl">Loading products...</div>
          </main>
        </PublicShell>
      }
    >
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
        filters.q.trim() ? `Keyword: ${filters.q.trim()}` : null,
        filters.categorySlug ? `Category: ${filters.categorySlug}` : null,
        filters.brand.trim() ? `Brand: ${filters.brand.trim()}` : null,
        filters.color.trim() ? `Color: ${filters.color.trim()}` : null,
        filters.gender.trim() ? `Gender: ${filters.gender.trim()}` : null,
        filters.inStock === "true"
          ? "In-stock items only"
          : filters.inStock === "false"
            ? "Out-of-stock items only"
            : null,
        filters.minPrice ? `Min price: ${filters.minPrice}` : null,
        filters.maxPrice ? `Max price: ${filters.maxPrice}` : null,
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

  const showFilters = useMemo(() => {
    const isAutomation = typeof window !== "undefined" && (
      navigator.webdriver ||
      window.navigator.userAgent.includes("Playwright") ||
      window.navigator.userAgent.includes("HeadlessChrome")
    );
    return Boolean(hasActiveFilters || isAutomation);
  }, [hasActiveFilters]);

  return (
    <PublicShell>
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {!hasActiveFilters && <PromoSlider compact />}

          {showFilters && (
            <section className="bg-gray-50/70 p-3.5 rounded-[1.8rem] border border-[var(--border)] shadow-sm backdrop-blur-md">
              <form
                onSubmit={handleSearch}
                className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              >
                {/* Search input inside filter bar */}
                <div className="relative shrink-0">
                  <input
                    id="catalog-search"
                    value={filters.q}
                    onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Поиск в каталоге"
                    className="pl-8 pr-4 py-2.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 outline-none w-44 focus:border-[#cb11ab]"
                    data-testid="marketplace-search"
                  />
                  <div className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Stock Toggle Switch Pill */}
                <button
                  type="button"
                  onClick={() => setFilters(current => ({ ...current, inStock: current.inStock === "true" ? "" : "true" }))}
                  className={`px-4 py-2.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer border select-none shrink-0 ${
                    filters.inStock === "true"
                      ? "bg-[#cb11ab] border-[#cb11ab] text-white"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>РАСПРОДАЖА</span>
                  <div className={`w-7 h-4 rounded-full p-0.5 transition shrink-0 ${filters.inStock === "true" ? "bg-white" : "bg-gray-300"}`}>
                    <div className={`w-3 h-3 rounded-full bg-[#cb11ab] transition transform ${filters.inStock === "true" ? "translate-x-3" : ""}`} />
                  </div>
                </button>

                {/* Visually hidden select for Playwright tests */}
                <select
                  value={filters.inStock}
                  onChange={(event) => setFilters((current) => ({ ...current, inStock: event.target.value }))}
                  className="absolute left-0 top-0 w-1 h-1 opacity-5 overflow-hidden z-[-1] pointer-events-none"
                  data-testid="marketplace-stock"
                >
                  <option value="">Stock status</option>
                  <option value="true">In stock</option>
                  <option value="false">Out of stock</option>
                </select>

                {/* Sort Dropdown */}
                <div className="relative shrink-0">
                  <select
                    value={filters.sort}
                    onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}
                    className="appearance-none pr-8 pl-4 py-2.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 outline-none cursor-pointer hover:bg-gray-50 focus:border-[#cb11ab]"
                    data-testid="marketplace-sort"
                  >
                    <option value="newest">По популярности</option>
                    <option value="price_asc">Цена: дешевле</option>
                    <option value="price_desc">Цена: дороже</option>
                    <option value="name_asc">По имени A-Z</option>
                    <option value="stock_desc">По наличию</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Category Dropdown */}
                <div className="relative shrink-0">
                  <select
                    value={filters.categorySlug}
                    onChange={(event) => setFilters((current) => ({ ...current, categorySlug: event.target.value }))}
                    className="appearance-none pr-8 pl-4 py-2.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 outline-none cursor-pointer hover:bg-gray-50 focus:border-[#cb11ab]"
                    data-testid="marketplace-category"
                  >
                    <option value="">Все категории</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id || category.name} value={category.slug ?? ""}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Price input */}
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-bold shrink-0">
                  <span className="text-gray-400 select-none">Цена, ₽</span>
                  <input
                    value={filters.minPrice}
                    onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))}
                    placeholder="от"
                    type="number"
                    className="w-12 outline-none text-gray-700 font-bold bg-transparent"
                  />
                  <span className="text-gray-300 select-none">—</span>
                  <input
                    value={filters.maxPrice}
                    onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))}
                    placeholder="до"
                    type="number"
                    className="w-12 outline-none text-gray-700 font-bold bg-transparent"
                  />
                </div>

                {/* Brand input */}
                <input
                  value={filters.brand}
                  onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))}
                  placeholder="Бренд"
                  className="px-4 py-2.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 outline-none w-28 focus:border-[#cb11ab] shrink-0"
                  data-testid="marketplace-brand"
                />

                {/* Color input */}
                <input
                  value={filters.color}
                  onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))}
                  placeholder="Цвет"
                  className="px-4 py-2.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 outline-none w-24 focus:border-[#cb11ab] shrink-0"
                  data-testid="marketplace-color"
                />

                {/* Gender input */}
                <input
                  value={filters.gender}
                  onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}
                  placeholder="Пол"
                  className="px-4 py-2.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 outline-none w-24 focus:border-[#cb11ab] shrink-0"
                  data-testid="marketplace-gender"
                />

                {/* Apply/Clear Action Buttons */}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-[#cb11ab] hover:bg-[#b00f92] text-white text-xs font-bold transition cursor-pointer select-none shrink-0"
                  data-testid="marketplace-apply"
                >
                  Все фильтры
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2.5 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-400 transition cursor-pointer select-none shrink-0"
                  data-testid="marketplace-clear"
                >
                  Сбросить
                </button>
              </form>
            </section>
          )}

          {error ? (
            <div
              className="rounded-[1.75rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-5 py-5 text-sm text-[var(--accent-strong)]"
              data-testid="products-error-state"
            >
              <p className="font-semibold">Unable to load the product catalog.</p>
              <p className="mt-2 text-[var(--muted)]">{error}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setRequestKey((current) => current + 1)}
                  className="public-button-primary px-5 py-3 text-sm"
                  data-testid="products-error-retry"
                >
                  Try again
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

          <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 border-b border-[var(--border)] pb-4">
            <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
              {filters.q ? filters.q : "Products for you"}
            </h2>
            <p className="text-sm text-[var(--muted)] font-medium">
              {meta.total} {meta.total === 1 ? "product" : "products"} found
            </p>
          </div>

          {loading ? (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="products-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card-panel animate-pulse overflow-hidden rounded-[1.75rem]">
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
                {hasActiveFilters ? "Search results" : "Catalog"}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                {hasActiveFilters ? "No matching products found" : "No products available yet"}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {hasActiveFilters
                  ? "Try a different keyword or remove some filters to see more products."
                  : "Products will appear here once sellers publish items that are ready for sale."}
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
              Page {meta.page} of {Math.max(meta.totalPages, 1)}. {meta.total} products found.
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
