"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect } from "react";
import clsx from "clsx";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

const links = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/orders/track", label: "Track Order" },
  { href: "/seller/register", label: "Sell on marketplace" },
  { href: "/seller/login", label: "Seller login" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrateCart = useCartStore((state) => state.hydrate);
  const cartCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const user = useAuthStore((state) => state.customerUser);
  const logoutRole = useAuthStore((state) => state.logoutRole);

  useEffect(() => {
    hydrateCart();
    hydrateAuth();
  }, [hydrateAuth, hydrateCart]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") ?? "").trim();
    const params = new URLSearchParams();
    if (query) {
      params.set("q", query);
    }
    router.push(`/products${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const customerHref = user?.role === "CUSTOMER" ? "/customer/orders" : "/customer/login";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[rgba(249,243,234,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 lg:gap-4">
          <Link href="/" className="flex items-center gap-3" data-testid="public-logo">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#b6314b,#8f1731)] font-[family-name:var(--font-mono-app)] text-sm font-bold text-white shadow-[0_16px_30px_rgba(182,49,75,0.28)]">
              SA
            </span>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Marketplace
              </p>
              <p className="font-[family-name:var(--font-mono-app)] text-lg font-bold text-[var(--foreground)]">
                Strawberry AI Commerce
              </p>
            </div>
          </Link>

          <form onSubmit={handleSearch} className="flex-1">
            <label htmlFor="public-header-search" className="sr-only">
              Search products
            </label>
            <input
              key={searchParams.get("q") ?? ""}
              id="public-header-search"
              name="q"
              defaultValue={searchParams.get("q") ?? ""}
              placeholder="Search products, brand, article, category"
              className="public-input rounded-full px-5 py-3"
              data-testid="public-header-search"
            />
          </form>

          <Link
            href="/cart"
            className="relative inline-flex h-12 min-w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 font-semibold text-[var(--foreground)]"
            data-testid="public-cart-link"
          >
            <span>Cart</span>
            {cartCount > 0 ? (
              <span
                className="absolute -right-1 -top-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-xs font-bold text-white"
                data-testid="public-cart-count"
              >
                {cartCount}
              </span>
            ) : null}
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {user?.role === "CUSTOMER" ? (
              <>
                <Link
                  href={customerHref}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                  data-testid="public-customer-link"
                >
                  My orders
                </Link>
                <button
                  type="button"
                  onClick={() => void logoutRole("customer")}
                  className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                  data-testid="public-customer-logout"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href={customerHref}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                  data-testid="public-customer-link"
                >
                  Customer login
                </Link>
                <Link
                  href="/customer/register"
                  className="public-button-primary px-4 py-3 text-sm shadow-[0_14px_28px_rgba(182,49,75,0.2)]"
                  data-testid="public-customer-register-link"
                >
                  Customer register
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
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

          {user?.role === "CUSTOMER" ? (
            <div className="flex gap-2 md:hidden">
              <Link
                href={customerHref}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                My orders
              </Link>
              <button type="button" onClick={() => void logoutRole("customer")} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2 md:hidden">
              <Link
                href={customerHref}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Login
              </Link>
              <Link href="/customer/register" className="public-button-primary px-4 py-2 text-sm">
                Register
              </Link>
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto md:hidden">
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
      </div>
    </header>
  );
}
