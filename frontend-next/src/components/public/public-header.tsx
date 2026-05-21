"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect } from "react";
import clsx from "clsx";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

const primaryLinks = [
  { href: "/", label: "Home", tone: "primary" },
  { href: "/products", label: "Shop", tone: "primary" },
  { href: "/orders/track", label: "Track order", tone: "primary" },
  { href: "/seller/register", label: "Sell with trawberry", tone: "soft" },
  { href: "/seller/login", label: "Seller login", tone: "ghost" },
];

const utilityLinks = [
  { href: "/products?q=new", label: "New arrivals" },
  { href: "/products?sort=price_desc", label: "Brands" },
  { href: "/products?inStock=true", label: "For business" },
  { href: "/seller/register", label: "Sellers" },
];

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M12 21s6-5.58 6-11a6 6 0 1 0-12 0c0 5.42 6 11 6 11Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="12" cy="10" r="2.3" fill="currentColor" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M3 4h2l2.3 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.78L20 7H7.2M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

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
  const authHydrated = useAuthStore((state) => state.hydrated);
  const customerSessionLoading = useAuthStore(
    (state) => state.sessionLoading.customer,
  );
  const customerSessionError = useAuthStore(
    (state) => state.sessionError.customer,
  );
  const refreshRole = useAuthStore((state) => state.refreshRole);
  const logoutRole = useAuthStore((state) => state.logoutRole);

  useEffect(() => {
    hydrateCart();
    hydrateAuth();
  }, [hydrateAuth, hydrateCart]);

  useEffect(() => {
    if (
      !authHydrated ||
      user ||
      customerSessionLoading ||
      customerSessionError
    ) {
      return;
    }

    void refreshRole("customer");
  }, [
    authHydrated,
    customerSessionError,
    customerSessionLoading,
    refreshRole,
    user,
  ]);

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

  const customerHref = user?.role === "CUSTOMER" ? "/customer/account" : "/customer/login";

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-gradient-primary text-white shadow-[0_18px_48px_rgba(122,0,112,0.28)]">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="hidden items-center justify-between gap-4 border-b border-white/12 pb-3 text-xs font-semibold text-white/78 md:flex">
          <div className="flex items-center gap-5">
            {utilityLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] tracking-[0.18em] text-white/72">
            marketplace
          </span>
        </div>

        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="flex flex-wrap items-center gap-3 md:flex-nowrap md:gap-4">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-3"
              data-testid="public-logo"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-white font-[family-name:var(--font-mono-app)] text-base font-bold text-[#cb11ab] shadow-[0_12px_28px_rgba(255,255,255,0.22)] md:h-14 md:w-14 md:text-lg">
                tr
              </span>
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-mono-app)] text-xl font-bold tracking-tight md:text-2xl">
                  trawberry
                </p>
                <p className="hidden text-[11px] uppercase tracking-[0.26em] text-white/72 sm:block">
                  multi-seller marketplace
                </p>
              </div>
            </Link>

            <button
              type="button"
              className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/12 text-white backdrop-blur md:inline-flex"
              aria-label="Open catalog menu"
            >
              <MenuIcon />
            </button>

            <form onSubmit={handleSearch} className="order-3 w-full md:order-none md:flex-1">
              <label htmlFor="public-header-search" className="sr-only">
                Search products
              </label>
              <div className="public-header-search-wrap flex items-center gap-3 rounded-[1.35rem] bg-white px-4 py-3 text-[var(--foreground)] shadow-[0_18px_40px_rgba(92,0,88,0.16)] md:h-14 md:rounded-full md:px-5">
                <span className="text-[var(--muted)]">
                  <SearchIcon />
                </span>
                <input
                  key={searchParams.get("q") ?? ""}
                  id="public-header-search"
                  name="q"
                  defaultValue={searchParams.get("q") ?? ""}
                  placeholder="Search products, brands, styles, categories"
                  className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-[var(--muted)] md:text-base"
                  data-testid="public-header-search"
                />
                <button
                  type="submit"
                  className="hidden rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(203,17,171,0.24)] md:inline-flex"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <div className="hidden min-w-[110px] items-center gap-2 rounded-2xl border border-white/16 bg-white/10 px-3 py-3 text-sm text-white/88 backdrop-blur lg:flex">
                <PinIcon />
                <span className="truncate">Bangkok</span>
              </div>

              {user?.role === "CUSTOMER" ? (
                <>
                  <Link
                    href={customerHref}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/18 bg-white/12 px-3 text-sm font-semibold text-white backdrop-blur md:px-4"
                    data-testid="public-customer-link"
                  >
                    <AccountIcon />
                    <span className="hidden sm:inline">{user.fullName || "Tài khoản"}</span>
                    <span className="sm:hidden">Tài khoản</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void logoutRole("customer")}
                    className="hidden h-12 items-center rounded-2xl border border-white/16 bg-white/10 px-4 text-sm font-semibold text-white/90 backdrop-blur md:inline-flex"
                    data-testid="public-customer-logout"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={customerHref}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/18 bg-white/12 px-3 text-sm font-semibold text-white backdrop-blur md:px-4"
                    data-testid="public-customer-link"
                  >
                    <AccountIcon />
                    <span className="hidden sm:inline">Login</span>
                  </Link>
                  <Link
                    href="/customer/register"
                    className="hidden h-12 items-center rounded-2xl bg-white px-4 text-sm font-semibold shadow-[0_14px_30px_rgba(255,255,255,0.18)] md:inline-flex"
                    style={{ color: "#b10d95" }}
                    data-testid="public-customer-register-link"
                  >
                    Register
                  </Link>
                </>
              )}

              <Link
                href="/cart"
                className="relative inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 font-semibold shadow-[0_12px_30px_rgba(255,255,255,0.18)] md:min-w-[114px] md:px-4"
                style={{ color: "#8f0d89" }}
                data-testid="public-cart-link"
              >
                <CartIcon />
                <span className="hidden md:inline">Cart</span>
                {cartCount > 0 ? (
                  <span
                    className="cart-badge-pop absolute -right-1.5 -top-1.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#ffcf33] px-1.5 text-xs font-bold text-[#5c0f59]"
                    data-testid="public-cart-count"
                  >
                    {cartCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <nav
              className="flex items-center gap-2 overflow-x-auto"
              aria-label="Public navigation"
              data-testid="public-nav"
            >
              {primaryLinks.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition",
                      active
                        ? "bg-white"
                        : link.tone === "soft"
                          ? "bg-white/10 text-white/92 hover:bg-white/18"
                          : link.tone === "ghost"
                            ? "text-white/88 hover:bg-white/10"
                            : "bg-white/10 text-white/92 hover:bg-white/18",
                    )}
                    style={active ? { color: "#a50f9d" } : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {!user?.role ? (
            <div className="flex gap-2 md:hidden">
              <Link
                href={customerHref}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-white/18 bg-white/12 px-4 text-sm font-semibold text-white backdrop-blur"
              >
                Login
              </Link>
              <Link
                href="/customer/register"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold"
                style={{ color: "#a90e96" }}
              >
                Register
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
