"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProductCard } from "@/components/public/product-card";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicProducts, type PublicProduct } from "@/lib/public-api";

type ProductsMeta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

const initialMeta: ProductsMeta = { page: 1, size: 12, total: 0, totalPages: 0 };

export default function ProductsPage() {
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>(initialMeta);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicProducts({
          page: meta.page,
          size: meta.size,
          search: search || undefined,
        });
        if (!mounted) return;
        setItems(response.items);
        setMeta(response.meta);
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
  }, [meta.page, meta.size, search]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMeta((current) => ({ ...current, page: 1 }));
    setSearch(searchInput.trim());
  };

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
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  Search by product name or brand. This page only exposes public-safe data and still relies on backend-calculated order totals during checkout.
                </p>
              </div>

              <form onSubmit={handleSearch} className="public-muted-card flex items-end gap-3 rounded-[1.5rem] p-4">
                <div className="flex-1">
                  <label htmlFor="catalog-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Search catalog
                  </label>
                  <input
                    id="catalog-search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Product name or brand"
                    className="public-input"
                  />
                </div>
                <button type="submit" className="public-button-primary px-5 py-3 text-sm">
                  Search
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Catalog empty</p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                No public products match this search yet.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                Try a different keyword or publish more products from the seller workspace.
              </p>
            </section>
          )}

          <div className="public-muted-card flex flex-col gap-4 rounded-[1.5rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              Page {meta.page} of {Math.max(meta.totalPages, 1)}. {meta.total} public products found.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setMeta((current) => ({ ...current, page: current.page - 1 }))}
                className="public-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={meta.page >= Math.max(meta.totalPages, 1)}
                onClick={() => setMeta((current) => ({ ...current, page: current.page + 1 }))}
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
