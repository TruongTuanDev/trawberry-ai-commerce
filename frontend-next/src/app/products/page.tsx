"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/public/product-card";
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
  const hydrateCart = useCartStore((state) => state.hydrate);
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>(initialMeta);
  const [filters, setFilters] = useState({
    q: searchParams.get("q") ?? searchParams.get("search") ?? "",
    categorySlug: searchParams.get("categorySlug") ?? "",
    brand: searchParams.get("brand") ?? "",
    color: searchParams.get("color") ?? "",
    gender: searchParams.get("gender") ?? "",
    inStock: searchParams.get("inStock") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    sort: searchParams.get("sort") ?? "newest",
  });
  const [facets, setFacets] = useState<PaginatedPublicProducts["filters"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") ?? "1");

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
  }, [filters, meta.size, page]);

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
    setFilters({
      q: "",
      categorySlug: "",
      brand: "",
      color: "",
      gender: "",
      inStock: "",
      minPrice: "",
      maxPrice: "",
      sort: "newest",
    });
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
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="card-panel overflow-hidden rounded-[2.25rem]">
            <div className="grid gap-8 bg-[linear-gradient(135deg,rgba(182,49,75,0.08),rgba(47,107,73,0.08))] px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Public marketplace</p>
                <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
                  Browse active products ready for checkout in the new stack.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">Search and filter by category, brand, color, gender, stock, and price. Prices are sorted by the lowest sellable variant price.</p>
              </div>

              <form onSubmit={handleSearch} className="public-muted-card grid gap-3 rounded-[1.5rem] p-4 sm:grid-cols-2">
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
            <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
              {error}
            </div>
          ) : null}

          {loading ? (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="products-grid">
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
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="products-grid">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          ) : (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">No products found</p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                No products found for these filters.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                Try a different keyword or publish more products from the seller workspace.
              </p>
              <button type="button" onClick={clearFilters} className="public-button-primary mt-5 px-5 py-3 text-sm">Clear filters</button>
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
