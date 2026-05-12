"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getPublicProducts, type PublicProduct } from "@/lib/public-api";

type ProductsMeta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export default function ProductsPage() {
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>({ page: 1, size: 12, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicProducts({ page: meta.page, size: meta.size, search: search || undefined });
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
    <main className="grain-overlay min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="card-panel overflow-hidden rounded-[2rem]">
          <div className="grid gap-8 bg-[linear-gradient(135deg,rgba(182,49,75,0.08),rgba(47,107,73,0.08))] px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Customer marketplace MVP</p>
              <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
                Browse active products and place a simple order.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                This public catalog only shows safe customer-facing data from the new NestJS stack. Checkout totals are
                still recomputed on the backend before an order is created.
              </p>
            </div>
            <form onSubmit={handleSearch} className="flex items-end gap-3 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <div className="flex-1">
                <label htmlFor="search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Search catalog
                </label>
                <input
                  id="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Product name or brand"
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Search
              </button>
            </form>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="card-panel rounded-[1.75rem] px-5 py-6 text-sm text-[var(--muted)]">Loading products...</div>
          ) : items.length ? (
            items.map((product) => (
              <article key={product.id} className="card-panel flex h-full flex-col overflow-hidden rounded-[1.75rem]">
                <div className="aspect-[4/3] bg-[var(--panel-strong)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images[0]?.url ?? "https://placehold.co/960x720?text=No+Image"}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-4 px-5 py-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{product.shop.name}</p>
                    <h2 className="text-xl font-semibold text-[var(--foreground)]">{product.name}</h2>
                    <p className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">{product.description ?? "No description yet."}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Price</p>
                      <p className="text-lg font-semibold text-[var(--foreground)]">{product.price ?? "Contact shop"}</p>
                    </div>
                    <div className="flex gap-3">
                      <Link
                        href={`/products/${product.id}`}
                        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
                      >
                        View
                      </Link>
                      <Link
                        href={`/checkout?productId=${product.id}&quantity=1`}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                      >
                        Checkout
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="card-panel rounded-[1.75rem] px-5 py-6 text-sm text-[var(--muted)]">No public products are available yet.</div>
          )}
        </section>

        <div className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
          <p className="text-sm text-[var(--muted)]">
            Page {meta.page} of {Math.max(meta.totalPages, 1)}. {meta.total} public products found.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => setMeta((current) => ({ ...current, page: current.page - 1 }))}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={meta.page >= Math.max(meta.totalPages, 1)}
              onClick={() => setMeta((current) => ({ ...current, page: current.page + 1 }))}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
