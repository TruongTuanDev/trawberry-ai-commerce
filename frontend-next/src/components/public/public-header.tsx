"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { useCartStore } from "@/stores/cart-store";

const links = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/orders/track", label: "Track Order" },
  { href: "/login", label: "Seller Login" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const hydrateCart = useCartStore((state) => state.hydrate);
  const cartCount = useCartStore((state) => state.getItemCount());

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[rgba(249,243,234,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3"
          data-testid="public-logo"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#b6314b,#8f1731)] font-[family-name:var(--font-mono-app)] text-sm font-bold text-white shadow-[0_16px_30px_rgba(182,49,75,0.28)]">
            SA
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Marketplace
            </p>
            <p className="font-[family-name:var(--font-mono-app)] text-lg font-bold text-[var(--foreground)]">
              Strawberry AI Commerce
            </p>
          </div>
        </Link>

        <nav
          className="hidden items-center gap-2 md:flex"
          aria-label="Public navigation"
          data-testid="public-nav"
        >
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold",
                  active
                    ? "bg-[var(--foreground)] text-white"
                    : "text-[var(--foreground)] hover:bg-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/products"
          className="public-button-primary px-4 py-2 text-sm shadow-[0_14px_28px_rgba(182,49,75,0.2)]"
        >
          Shop now
        </Link>
        <Link
          href="/cart"
          className="public-button-secondary px-4 py-2 text-sm"
          data-testid="public-cart-link"
        >
          Cart {cartCount ? `(${cartCount})` : ""}
        </Link>
      </div>

      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 md:hidden sm:px-6">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
                active
                  ? "bg-[var(--foreground)] text-white"
                  : "bg-white text-[var(--foreground)]",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
