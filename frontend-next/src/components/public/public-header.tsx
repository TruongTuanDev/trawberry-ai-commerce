"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/orders/track", label: "Track order" },
  { href: "/seller/register", label: "Sell with trawberry" },
  { href: "/seller/login", label: "Seller login" },
  { href: "/products?q=new", label: "New arrivals" },
  { href: "/products?sort=price_desc", label: "Brands" },
  { href: "/products?inStock=true", label: "Editors' picks" },
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

  const customerHref =
    user?.role === "CUSTOMER" ? "/customer/account" : "/customer/login";
  const accountLabel = user?.role === "CUSTOMER" ? (user.fullName || "Account") : "Login";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-primary text-white shadow-md">
      <div className="mx-auto max-w-[1600px] px-4 py-2 sm:px-6">
        {/* Top bar (Row 1): Thin, text-xs */}
        <div className="hidden lg:flex items-center justify-between gap-6 border-b border-white/10 pb-2 mb-2 text-xs font-semibold text-white/80">
          <div className="flex items-center gap-1.5 text-white/90">
            <PinIcon />
            <span className="truncate">Москва</span>
          </div>
          <nav
            className="flex items-center justify-center gap-5 xl:gap-7"
            data-testid="public-nav"
            aria-label="Public navigation"
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300 uppercase tracking-wider">
              КЕШБЭК 💰
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90">
              RUB 🇷🇺
            </span>
            {!user?.role ? (
              <Link
                href="/customer/register"
                className="rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 hover:bg-white/18"
                data-testid="public-customer-register-link"
              >
                Register
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void logoutRole("customer")}
                className="rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 hover:bg-white/18 cursor-pointer"
                data-testid="public-customer-logout"
              >
                Log out
              </button>
            )}
          </div>
        </div>

        {/* Main Row (Row 2): Logo, Catalog Menu, Search, Actions */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 md:gap-6 py-1">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center shrink-0"
            data-testid="public-logo"
          >
            {/* Mobile logo icon */}
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-[family-name:var(--font-mono-app)] text-sm font-bold text-[#cb11ab] shadow-sm md:hidden">
              tr
            </span>
            {/* Desktop logo text */}
            <span className="hidden md:inline font-[family-name:var(--font-sans-app)] text-2xl font-extrabold tracking-tight text-white hover:opacity-90">
              trawberry
            </span>
          </Link>

          {/* Menu button */}
          <button
            type="button"
            className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl border border-white/18 bg-white/10 text-white hover:bg-white/15 transition cursor-pointer"
            aria-label="Open catalog menu"
          >
            <MenuIcon />
          </button>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-4xl"
          >
            <label htmlFor="public-header-search" className="sr-only">
              Search products
            </label>
            <div className="public-header-search-wrap flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[var(--foreground)] shadow-sm h-9 md:h-10">
              <span className="text-[var(--muted)] flex-shrink-0">
                <SearchIcon />
              </span>
              <input
                key={searchParams.get("q") ?? ""}
                id="public-header-search"
                name="q"
                defaultValue={searchParams.get("q") ?? ""}
                placeholder="Search products, brands, categories"
                className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-[var(--muted)] focus:outline-none focus:ring-0 focus-visible:outline-none"
                data-testid="public-header-search"
              />
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
                aria-label="Search by image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Action items */}
          <div className="flex items-center gap-3 sm:gap-5 md:gap-6 shrink-0">
            {/* Address */}
            <div className="hidden md:flex flex-col items-center justify-center text-center cursor-pointer text-white/90 hover:text-white transition">
              <span className="w-5 h-5 flex items-center justify-center">
                <PinIcon />
              </span>
              <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Address</span>
            </div>

            {/* Account */}
            <Link
              href={customerHref}
              className="flex flex-col items-center justify-center text-center text-white/90 hover:text-white transition"
              data-testid="public-customer-link"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <AccountIcon />
              </span>
              <span className="hidden md:inline text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-[80px]">
                {accountLabel}
              </span>
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative flex flex-col items-center justify-center text-center text-white/90 hover:text-white transition"
              data-testid="public-cart-link"
            >
              <div className="relative w-5 h-5 flex items-center justify-center">
                <CartIcon />
                {cartCount > 0 && (
                  <span
                    className="cart-badge-pop absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffcf33] px-1 text-[9px] font-bold text-[#5c0f59]"
                    data-testid="public-cart-count"
                  >
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden md:inline text-[10px] font-semibold mt-0.5 tracking-tight">
                Cart
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile secondary actions (Login/Register) when logged out */}
        {!user?.role && (
          <div className="flex gap-2 pt-2 pb-1 lg:hidden">
            <Link
              href={customerHref}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-white/18 bg-white/12 px-3 text-xs font-semibold text-white backdrop-blur"
            >
              Login
            </Link>
            <Link
              href="/customer/register"
              className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-white px-3 text-xs font-semibold text-[#cb11ab]"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
