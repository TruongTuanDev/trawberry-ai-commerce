"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { useCartStore } from "@/stores/cart-store";

export function CartPageClient() {
  const items = useCartStore((state) => state.items);
  const hydrate = useCartStore((state) => state.hydrate);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
        0,
      ),
    [items],
  );
  const shopCount = new Set(items.map((item) => item.shopId)).size;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              Back to products
            </Link>
            {items.length ? (
              <button
                type="button"
                onClick={clearCart}
                className="public-button-secondary px-4 py-2 text-sm"
              >
                Clear cart
              </button>
            ) : null}
          </div>

          <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Cart
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">
              Shopping cart
            </h1>
          </section>

          {!items.length ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">Your cart is empty.</p>
              <Link
                href="/products"
                className="public-button-primary mt-5 inline-flex px-5 py-3 text-sm"
              >
                Open marketplace
              </Link>
            </section>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <section className="space-y-4" data-testid="cart-items">
                {items.map((item) => (
                  <article
                    key={`${item.productId}:${item.variantId}`}
                    className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[96px_1fr_180px_120px]"
                  >
                    <div className="overflow-hidden rounded-2xl bg-[var(--panel)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          item.imageUrl ??
                          "https://placehold.co/160x160?text=No+Image"
                        }
                        alt={item.productName}
                        className="h-24 w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.variantName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.shopName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Quantity
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.variantId,
                              item.quantity - 1,
                            )
                          }
                          className="public-button-secondary h-10 w-10"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <input
                          value={item.quantity}
                          min={1}
                          max={
                            item.trackInventory
                              ? item.availableQuantity
                              : undefined
                          }
                          type="number"
                          onChange={(event) =>
                            updateQuantity(
                              item.productId,
                              item.variantId,
                              Number(event.target.value),
                            )
                          }
                          className="public-input w-20 text-center"
                          data-testid="cart-quantity-input"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.variantId,
                              item.quantity + 1,
                            )
                          }
                          className="public-button-secondary h-10 w-10"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removeItem(item.productId, item.variantId)
                        }
                        className="mt-3 text-sm font-semibold text-[var(--accent)]"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="text-sm md:text-right">
                      <p className="text-[var(--muted)]">
                        Unit {Number(item.unitPrice || 0).toFixed(2)}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                        {(Number(item.unitPrice || 0) * item.quantity).toFixed(
                          2,
                        )}
                      </p>
                    </div>
                  </article>
                ))}
              </section>

              <aside className="card-panel h-fit rounded-[2rem] px-6 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Summary
                </p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Subtotal</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {subtotal.toFixed(2)}
                  </span>
                </div>
                {shopCount > 1 ? (
                  <p className="mt-5 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
                    Multi-shop checkout is coming soon. Please checkout one shop
                    at a time.
                  </p>
                ) : null}
                <Link
                  href="/checkout"
                  aria-disabled={shopCount > 1}
                  className={`mt-5 inline-flex w-full justify-center px-5 py-3 text-sm ${shopCount > 1 ? "pointer-events-none rounded-full bg-slate-200 font-semibold text-slate-500" : "public-button-primary"}`}
                  data-testid="cart-checkout"
                >
                  Checkout
                </Link>
              </aside>
            </div>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
