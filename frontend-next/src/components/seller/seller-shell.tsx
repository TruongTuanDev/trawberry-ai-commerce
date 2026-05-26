"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ShopSwitcher } from "@/components/seller/shop-switcher";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n("seller");
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.sellerUser);
  const logoutRole = useAuthStore((state) => state.logoutRole);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const [loggingOut, setLoggingOut] = useState(false);
  const sellerBlocked =
    user?.role === "SELLER" &&
    user.sellerApprovalStatus &&
    user.sellerApprovalStatus !== "APPROVED";
  const sellerActionHref =
    user?.sellerNextStep === "WAIT_FOR_APPROVAL" || user?.sellerNextStep === "CONTACT_SUPPORT"
      ? "/seller/pending"
      : "/seller/onboarding";
  const navigation = [
    { href: "/seller/dashboard", label: t("sellerShell.dashboard") },
    { href: "/seller/notifications", label: t("sellerShell.notifications") },
    { href: "/seller/products", label: t("sellerShell.products") },
    { href: "/seller/import/wildberries", label: t("sellerShell.wbExcel") },
    { href: "/seller/import/wildberries-api", label: t("sellerShell.wbSync") },
    { href: "/seller/ai-images", label: t("sellerShell.aiImages") },
    { href: "/seller/orders", label: t("sellerShell.orders") },
    { href: "/seller/messages", label: t("sellerShell.messages") },
    { href: "/seller/returns", label: t("sellerShell.returns") },
    { href: "/seller/reviews", label: t("sellerShell.reviews") },
    { href: "/seller/support-cases", label: t("sellerShell.support") },
    { href: "/seller/payments", label: t("sellerShell.payments") },
    { href: "/seller/payments-to-confirm", label: t("sellerShell.toConfirm") },
    { href: "/seller/payment-settings", label: t("sellerShell.paymentSettings") },
    { href: "/seller/finance", label: t("sellerShell.finance") },
    { href: "/seller/onboarding", label: t("sellerShell.onboarding") },
    { href: "/seller/settings", label: t("sellerShell.settings") },
  ];

  useEffect(() => {
    if (!user || user.role !== "SELLER" || sellerBlocked) {
      return;
    }
    void loadShops();
  }, [loadShops, sellerBlocked, user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutRole("seller");
      router.replace("/seller-login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="grain-overlay min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:h-screen lg:overflow-hidden" data-testid="seller-shell">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1600px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] lg:h-[calc(100vh-3rem)] lg:min-h-0">
        <aside className="hidden w-72 flex-col justify-between border-r border-[var(--border)] bg-white p-6 text-[var(--foreground)] lg:sticky lg:top-0 lg:flex lg:h-full lg:overflow-y-auto">
          <div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t("sellerShell.brand")}</p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold">
                {t("sellerShell.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {t("sellerShell.description")}
              </p>
            </div>
            <nav className="mt-8 space-y-2">
              {navigation.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active ? "bg-gradient-primary text-white shadow-md" : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{t("sellerShell.currentUser")}</p>
            <p className="mt-2 text-sm font-semibold">{user?.fullName ?? t("sellerShell.unknownSeller")}</p>
            <p className="text-sm text-[var(--muted)]">{user?.email ?? t("sellerShell.noEmail")}</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              data-testid="logout-button"
              className="public-button-secondary mt-4 w-full px-4 py-2 text-xs"
            >
              {loggingOut ? t("common.signingOut") : t("common.logout")}
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <header className="relative z-20 border-b border-[var(--border)] bg-[rgba(255,250,243,0.92)] px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t("sellerShell.operations")}
                </p>
                <h1 className="mt-1 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
                  {t("sellerShell.centerTitle")}
                </h1>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <LanguageSwitcher role="seller" />
                <NotificationBell role="seller" />
                <ShopSwitcher />
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  data-testid="logout-button-mobile"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
                >
                  {loggingOut ? t("common.signingOut") : t("common.logout")}
                </button>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{user?.role ?? "SELLER"}</p>
                  <p className="text-[var(--muted)]">{t("sellerShell.cookieAuth")}</p>
                </div>
              </div>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {sellerBlocked ? (
              <div className="mb-6 rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-5 py-4" data-testid="seller-approval-banner">
                <p className="text-sm font-semibold text-[var(--accent-strong)]">
                  {user?.sellerApprovalStatus === "REJECTED"
                    ? t("sellerShell.rejected")
                    : t("sellerShell.pending")}
                </p>
                {user?.sellerApprovalStatus === "REJECTED" && user.sellerRejectionReason ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">{user.sellerRejectionReason}</p>
                ) : user?.sellerNextStep === "WAIT_FOR_APPROVAL" ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("sellerShell.pendingDescription")}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("sellerShell.completeOnboarding")}
                  </p>
                )}
                <Link
                  href={sellerActionHref}
                  className="mt-3 inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                >
                  {sellerActionHref === "/seller/pending" ? t("sellerShell.reviewStatus") : t("sellerShell.openOnboarding")}
                </Link>
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
