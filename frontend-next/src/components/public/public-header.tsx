"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

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
  const { t } = useI18n("customer");
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrateCart = useCartStore((state) => state.hydrate);
  const cartCount = useCartStore((state) => state.getItemCount());
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
  const customerAddressHref =
    user?.role === "CUSTOMER"
      ? "/customer/account/addresses"
      : "/customer/login?next=%2Fcustomer%2Faccount%2Faddresses";
  const accountLabel =
    user?.role === "CUSTOMER"
      ? user.fullName || t("publicHeader.account")
      : t("publicHeader.login");
  const primaryLinks = [
    { href: "/", label: t("publicHeader.home") },
    { href: "/products", label: t("publicHeader.shop") },
    { href: "/orders/track", label: t("publicHeader.trackOrder") },
    { href: "/seller/register", label: t("publicHeader.sellWithUs") },
    { href: "/seller/login", label: t("publicHeader.sellerLogin") },
    { href: "/products?q=new", label: t("publicHeader.newArrivals") },
    { href: "/products?sort=price_desc", label: t("publicHeader.brands") },
    { href: "/products?inStock=true", label: t("publicHeader.editorsPicks") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-primary text-white shadow-md">
      <div className="mx-auto max-w-[1600px] px-4 py-2 sm:px-6">
        <div className="mb-2 hidden items-center justify-between gap-6 border-b border-white/10 pb-2 text-xs font-semibold text-white/80 lg:flex">
          <div className="flex items-center gap-1.5 text-white/90">
            <PinIcon />
            <span className="truncate">{t("publicHeader.city")}</span>
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
                prefetch={false}
                className="transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300">
              {t("publicHeader.cashback")}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90">
              {t("publicHeader.currency")}
            </span>
            <LanguageSwitcher role="customer" compact tone="dark" />
            {!user?.role ? (
              <Link
                href="/customer/register"
                prefetch={false}
                className="rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 hover:bg-white/18"
                data-testid="public-customer-register-link"
              >
                {t("publicHeader.register")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void logoutRole("customer")}
                className="cursor-pointer rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 hover:bg-white/18"
                data-testid="public-customer-logout"
              >
                {t("common.logout")}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-1 sm:gap-4 md:gap-6">
          <Link
            href="/"
            prefetch={false}
            className="flex shrink-0 items-center"
            data-testid="public-logo"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-[family-name:var(--font-mono-app)] text-sm font-bold text-[#cb11ab] shadow-sm md:hidden">
              tr
            </span>
            <span className="hidden font-[family-name:var(--font-sans-app)] text-2xl font-extrabold tracking-tight text-white hover:opacity-90 md:inline">
              strawberry
            </span>
          </Link>

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/18 bg-white/10 text-white transition hover:bg-white/15 md:h-10 md:w-10"
            aria-label={t("publicHeader.openCatalogMenu")}
          >
            <MenuIcon />
          </button>

          <form onSubmit={handleSearch} className="max-w-4xl flex-1 min-w-0">
            <label htmlFor="public-header-search" className="sr-only">
              {t("publicHeader.searchProducts")}
            </label>
            <div className="public-header-search-wrap flex h-9 items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[var(--foreground)] shadow-sm md:h-10">
              <span className="flex-shrink-0 text-[var(--muted)]">
                <SearchIcon />
              </span>
              <input
                key={searchParams.get("q") ?? ""}
                id="public-header-search"
                name="q"
                defaultValue={searchParams.get("q") ?? ""}
                placeholder={t("publicHeader.searchPlaceholder")}
                className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-[var(--muted)] focus:outline-none focus:ring-0 focus-visible:outline-none"
                data-testid="public-header-search"
              />
              <button
                type="button"
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                aria-label={t("publicHeader.searchByImage")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </form>

          <div className="flex shrink-0 items-center gap-3 sm:gap-5 md:gap-6">
            <Link
              href={customerAddressHref}
              prefetch={false}
              className="hidden cursor-pointer flex-col items-center justify-center text-center text-white/90 transition hover:text-white md:flex"
              title={t("publicHeader.manageAddress")}
              aria-label={t("publicHeader.openAddressSettings")}
              data-testid="public-address-link"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <PinIcon />
              </span>
              <span className="mt-0.5 text-[10px] font-semibold tracking-tight">
                {t("publicHeader.address")}
              </span>
            </Link>

            {user?.role === "CUSTOMER" && <NotificationBell role="customer" />}

            <Link
              href={customerHref}
              prefetch={false}
              className="flex flex-col items-center justify-center text-center text-white/90 transition hover:text-white"
              data-testid="public-customer-link"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <AccountIcon />
              </span>
              <span className="hidden max-w-[80px] truncate text-[10px] font-semibold tracking-tight md:inline">
                {accountLabel}
              </span>
            </Link>

            <Link
              href="/cart"
              prefetch={false}
              className="relative flex flex-col items-center justify-center text-center text-white/90 transition hover:text-white"
              data-testid="public-cart-link"
            >
              <div className="relative flex h-5 w-5 items-center justify-center">
                <CartIcon />
                {cartCount > 0 && (
                  <span
                    className="cart-badge-pop absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffcf33] px-1 text-[9px] font-bold text-[#5c0f59]"
                    data-testid="public-cart-count"
                  >
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden text-[10px] font-semibold tracking-tight md:inline">
                {t("publicHeader.cart")}
              </span>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-1 pt-2 lg:hidden">
          <LanguageSwitcher
            role="customer"
            compact
            tone="dark"
            testId="language-switcher-customer-mobile"
          />
          {!user?.role && (
            <>
            <Link
              href={customerHref}
              prefetch={false}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-white/18 bg-white/12 px-3 text-xs font-semibold text-white backdrop-blur"
            >
              {t("publicHeader.login")}
            </Link>
            <Link
              href="/customer/register"
              prefetch={false}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-white px-3 text-xs font-semibold text-[#cb11ab]"
            >
              {t("publicHeader.register")}
            </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
