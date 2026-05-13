"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductGallery } from "@/components/public/product-gallery";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicProduct, type PublicProduct } from "@/lib/public-api";

export function PublicProductDetailPageClient({
  productId,
}: {
  productId: string;
}) {
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const maxQuantity = Math.max(1, product?.availableQuantity ?? 1);
  const safeQuantity = Math.min(Math.max(1, quantity), maxQuantity);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const result = await getPublicProduct(productId);
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
  }, [productId]);

  const estimatedTotal = useMemo(() => {
    if (!product?.price) {
      return null;
    }

    return (Number(product.price) * safeQuantity).toFixed(2);
  }, [product?.price, safeQuantity]);

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="public-button-secondary inline-flex px-4 py-2 text-sm">
              Back to products
            </Link>
            <Link href="/orders/track" className="public-button-secondary inline-flex px-4 py-2 text-sm">
              Track order
            </Link>
          </div>

          {loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-12 text-sm text-[var(--muted)]">Loading product...</section>
          ) : error || !product ? (
            <section className="rounded-[2rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-6 py-8 text-sm text-[var(--accent-strong)]">
              {error ?? "Product not found."}
            </section>
          ) : (
            <section className="card-panel overflow-hidden rounded-[2.25rem]">
              <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
                <div className="p-4 sm:p-5">
                  <ProductGallery name={product.name} images={product.images} />
                </div>
                <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      {product.shop.name ?? "Marketplace shop"}
                    </p>
                    <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)] sm:text-5xl">
                      {product.name}
                    </h1>
                    <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                      {product.description ?? "No description provided yet."}
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 sm:grid-cols-2">
                    <Metric label="Price" value={product.price ?? "Contact shop"} />
                    <Metric label="Estimated total" value={estimatedTotal ?? "Calculated at checkout"} />
                    <Metric label="Brand" value={product.brand ?? "Unbranded"} />
                    <Metric label="Category" value={product.categoryName ?? "General"} />
                    <Metric label="Availability" value={product.inStock ? `In stock (${product.availableQuantity})` : "Out of stock"} />
                  </div>

                  <div className="public-muted-card rounded-[1.5rem] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Shop</p>
                    <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{product.shop.name ?? "Marketplace shop"}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Slug: {product.shop.slug ?? "n/a"}</p>
                  </div>

                  <div className="rounded-[1.75rem] bg-[linear-gradient(180deg,#f0e4d1,#ead8bf)] p-5">
                    <label htmlFor="quantity" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Quantity
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                        disabled={!product.inStock}
                        className="public-button-secondary h-11 w-11 text-lg"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <input
                        id="quantity"
                        type="number"
                        min={1}
                        max={maxQuantity}
                        value={safeQuantity}
                        onChange={(event) =>
                          setQuantity(
                            Math.min(
                              Math.max(1, Number(event.target.value) || 1),
                              maxQuantity,
                            ),
                          )
                        }
                        className="public-input max-w-28 text-center"
                        data-testid="product-quantity-input"
                        disabled={!product.inStock}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((current) =>
                            Math.min(current + 1, maxQuantity),
                          )
                        }
                        disabled={!product.inStock}
                        className="public-button-secondary h-11 w-11 text-lg"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {product.inStock ? (
                        <Link
                          href={`/checkout?productId=${product.id}&quantity=${safeQuantity}`}
                          className="public-button-primary inline-flex items-center justify-center px-5 py-3 text-sm"
                          data-testid="continue-to-checkout"
                        >
                          Continue to checkout
                        </Link>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500">
                          Out of stock
                        </span>
                      )}
                      <Link href="/products" className="public-button-secondary inline-flex items-center justify-center px-5 py-3 text-sm">
                        Continue browsing
                      </Link>
                    </div>
                    <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                      Estimated totals are for browsing only. The backend recalculates the real amount before creating the order.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </PublicShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
