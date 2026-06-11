"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useAuthStore } from "@/stores/auth-store";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useI18n } from "@/i18n/use-i18n";

const navLinks = [
  { href: "/admin/dashboard", key: "adminShell.nav.dashboard", match: "/admin/dashboard" },
  { href: "/admin/notifications", key: "adminShell.nav.notifications", match: "/admin/notifications" },
  { href: "/admin/sellers", key: "adminShell.nav.sellers", match: "/admin/sellers" },
  { href: "/admin/users", key: "adminShell.nav.users", match: "/admin/users" },
  { href: "/admin/deliveries", key: "adminShell.nav.deliveries", match: "/admin/deliveries" },
  { href: "/admin/payments-supervision", key: "adminShell.nav.payments", match: "/admin/payments-supervision" },
  { href: "/admin/returns", key: "adminShell.nav.returns", match: "/admin/returns" },
  { href: "/admin/messages", key: "adminShell.nav.messages", match: "/admin/messages" },
  { href: "/admin/reviews", key: "adminShell.nav.reviews", match: "/admin/reviews" },
  { href: "/admin/campaigns/moderation", key: "adminShell.nav.reviews", label: "Campaign moderation", match: "/admin/campaigns" },
  { href: "/admin/ads-wallet/top-ups", key: "adminShell.nav.finance", label: "Ads wallet top-ups", match: "/admin/ads-wallet" },
  { href: "/admin/finance/seller-fees", key: "adminShell.nav.finance", match: "/admin/finance" },
  { href: "/admin/queues", key: "adminShell.nav.queues", match: "/admin/queues" },
  { href: "/admin/support-cases", key: "adminShell.nav.supportCases", match: "/admin/support-cases" },
  { href: "/admin/reports", key: "adminShell.nav.reports", match: "/admin/reports" },
  {
    href: "/admin/recommendations-analytics",
    key: "adminShell.nav.recommendationsAnalytics",
    match: "/admin/recommendations-analytics",
  },
  {
    href: "/admin/recommendations/tuning",
    key: "adminShell.nav.recommendationTuning",
    match: "/admin/recommendations/tuning",
    requiresTuningWorkflow: true,
  },
  { href: "/admin/homepage-slides", key: "adminShell.nav.homepageSlides", match: "/admin/homepage-slides" },
  { href: "/admin/ai-settings", key: "adminShell.nav.aiSettings", match: "/admin/ai-settings" },
];

export function AdminShell({
  children,
  recommendationTuningWorkflowEnabled = false,
}: {
  children: React.ReactNode;
  recommendationTuningWorkflowEnabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n("admin");
  const user = useAuthStore((state) => state.adminUser);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const visibleNavLinks = navLinks.filter(
    (link) =>
      !("requiresTuningWorkflow" in link) ||
      !link.requiresTuningWorkflow ||
      recommendationTuningWorkflowEnabled,
  );

  useEffect(() => {
    if (!user) {
      return;
    }
  }, [router, user]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel max-w-md rounded-[1.5rem] px-8 py-6 text-center">
          <p className="text-sm text-[var(--muted)]">{t("adminShell.checkingAccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grain-overlay min-h-screen lg:h-screen lg:overflow-hidden lg:p-6" data-testid="admin-shell">
      <div className="mx-auto flex min-h-screen lg:min-h-0 lg:h-full w-full max-w-[1400px] overflow-hidden bg-[var(--panel)] lg:rounded-[2rem] lg:border lg:border-[var(--border)] lg:shadow-[var(--shadow)]">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-900 text-slate-100 lg:sticky lg:top-0 lg:block lg:h-full shrink-0">
          <div className="h-full overflow-y-auto p-6 scrollbar-thin">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t("adminShell.badge")}</p>
            <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-white">{t("adminShell.title")}</h1>
            <nav className="mt-8 space-y-2">
              {visibleNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    pathname.startsWith(link.match) ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {"label" in link ? link.label : t(link.key)}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden cursor-pointer"
                aria-label="Open menu"
                data-testid="admin-mobile-menu-toggle"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {t("adminShell.title")}
                </p>
                <h2 className="text-sm font-semibold text-slate-800">
                  {t("adminShell.loggedInAs", { email: user.email })}
                </h2>
              </div>
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3" data-testid="admin-header-controls">
              <LanguageSwitcher role="admin" compact />
              <NotificationBell role="admin" />
              <button
                onClick={async () => {
                  await useAuthStore.getState().logoutRole("admin");
                  router.push("/admin/login");
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                {t("common.logout")}
              </button>
            </div>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" data-testid="admin-mobile-menu">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer content */}
          <aside className="relative flex w-72 max-w-xs flex-col bg-slate-900 p-6 text-slate-100 shadow-2xl transition-transform">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t("adminShell.badge")}</p>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                aria-label={t("adminShell.closeMenu")}
                data-testid="admin-mobile-menu-close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-white">{t("adminShell.title")}</h1>
            <nav className="mt-8 flex-1 space-y-2 overflow-y-auto scrollbar-thin">
              {visibleNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    pathname.startsWith(link.match) ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {"label" in link ? link.label : t(link.key)}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
