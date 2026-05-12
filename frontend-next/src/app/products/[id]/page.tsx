"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPublicProduct, type PublicProduct } from "@/lib/public-api";

export default function PublicProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const result = await getPublicProduct(params.id);
        if (!mounted) return;
        setProduct(result);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load product.");
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
  }, [params.id]);

  if (loading) {
    return <main className="grain-overlay min-h-screen px-4 py-10 text-sm text-[var(--muted)]">Loading product...</main>;
  }

  if (error || !product) {
    return (
      <main className="grain-overlay min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-5 py-6 text-sm text-[var(--accent-strong)]">
          {error ?? "Product not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="grain-overlay min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/products" className="inline-flex rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
          Back to products
        </Link>

        <section className="card-panel overflow-hidden rounded-[2rem]">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="bg-[var(--panel-strong)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.images[0]?.url ?? "https://placehold.co/960x960?text=No+Image"}
                alt={product.name}
                className="h-full w-full rounded-[1.5rem] object-cover"
              />
            </div>
            <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{product.shop.name}</p>
                <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">
                  {product.name}
                </h1>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{product.description ?? "No description provided yet."}</p>
              </div>

              <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 sm:grid-cols-2">
                <Metric label="Price" value={product.price ?? "Contact shop"} />
                <Metric label="Brand" value={product.brand ?? "Unbranded"} />
                <Metric label="Category" value={product.categoryName ?? "General"} />
                <Metric label="Shop slug" value={product.shop.slug} />
              </div>

              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
                <label htmlFor="quantity" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/checkout?productId=${product.id}&quantity=${quantity}`}
                    className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    Buy now
                  </Link>
                  <Link
                    href="/products"
                    className="rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  >
                    Continue browsing
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
