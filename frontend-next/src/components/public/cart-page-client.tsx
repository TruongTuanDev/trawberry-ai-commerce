"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { type CartItem, useCartStore } from "@/stores/cart-store";

type ShopCartGroup = {
  shopId: string;
  shopName: string;
  items: CartItem[];
  subtotal: number;
};

function groupItemsByShop(items: CartItem[]): ShopCartGroup[] {
  const groups = new Map<string, ShopCartGroup>();
  for (const item of items) {
    const existing = groups.get(item.shopId) ?? {
      shopId: item.shopId,
      shopName: item.shopName,
      items: [],
      subtotal: 0,
    };
    existing.items.push(item);
    existing.subtotal += Number(item.unitPrice || 0) * item.quantity;
    groups.set(item.shopId, existing);
  }
  return [...groups.values()];
}

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
  const shopGroups = useMemo(() => groupItemsByShop(items), [items]);

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
                {shopGroups.map((group) => (
                  <section
                    key={group.shopId}
                    className="space-y-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-4"
                    data-testid="cart-shop-group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Shop
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                          {group.shopName}
                        </h2>
                      </div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {group.subtotal.toFixed(2)}
                      </p>
                    </div>
                    {group.items.map((item) => (
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
                            {(
                              Number(item.unitPrice || 0) * item.quantity
                            ).toFixed(2)}
                          </p>
                        </div>
                      </article>
                    ))}
                  </section>
                ))}
              </section>

              <aside className="card-panel h-fit rounded-[2rem] px-6 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Summary
                </p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Grand total</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {subtotal.toFixed(2)}
                  </span>
                </div>
                <Link
                  href="/checkout"
                  className="public-button-primary mt-5 inline-flex w-full justify-center px-5 py-3 text-sm"
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
