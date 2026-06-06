"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  getSellerNavGroups,
  isSellerNavItemActive,
  type SellerNavGroup,
} from "@/components/seller/seller-nav-config";
import { ShopSwitcher } from "@/components/seller/shop-switcher";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const SELLER_NAV_STORAGE_KEY = "seller-nav-group-state";

export function SellerShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n("seller");
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.sellerUser);
  const logoutRole = useAuthStore((state) => state.logoutRole);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(SELLER_NAV_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      window.localStorage.removeItem(SELLER_NAV_STORAGE_KEY);
      return {};
    }
  });

  const sellerBlocked =
    user?.role === "SELLER" &&
    user.sellerApprovalStatus &&
    user.sellerApprovalStatus !== "APPROVED";
  const sellerActionHref =
    user?.sellerNextStep === "WAIT_FOR_APPROVAL" || user?.sellerNextStep === "CONTACT_SUPPORT"
      ? "/seller/pending"
      : "/seller/onboarding";

  const navigation = useMemo(() => getSellerNavGroups(t), [t]);
  const activeGroupKey = useMemo(
    () =>
      navigation.find((group) =>
        group.items.some((item) => isSellerNavItemActive(pathname, item)),
      )?.key ?? null,
    [navigation, pathname],
  );

  const filteredNavigation = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return navigation;
    }

    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.label.toLowerCase().includes(keyword) || group.items.length > 0);
  }, [navigation, searchQuery]);

  useEffect(() => {
    if (!user || user.role !== "SELLER" || sellerBlocked) {
      return;
    }
    void loadShops();
  }, [loadShops, sellerBlocked, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SELLER_NAV_STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutRole("seller");
      router.replace("/seller-login");
    } finally {
      setLoggingOut(false);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const renderNavigation = (mode: "desktop" | "mobile") => (
    <SellerNavigation
      mode={mode}
      groups={filteredNavigation}
      pathname={pathname}
      collapsedGroups={collapsedGroups}
      activeGroupKey={activeGroupKey}
      onToggleGroup={toggleGroup}
      onNavigate={() => setMobileMenuOpen(false)}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      t={t}
    />
  );

  return (
    <div
      className="grain-overlay min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:h-screen lg:overflow-hidden"
      data-testid="seller-shell"
    >
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1600px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] lg:h-[calc(100vh-3rem)] lg:min-h-0">
        <aside className="hidden w-72 flex-col justify-between border-r border-[var(--border)] bg-white p-6 text-[var(--foreground)] lg:sticky lg:top-0 lg:flex lg:h-full lg:overflow-y-auto">
          <div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                {t("sellerShell.brand")}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold">
                {t("sellerShell.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {t("sellerShell.description")}
              </p>
            </div>
            <div className="mt-6">{renderNavigation("desktop")}</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("sellerShell.currentUser")}
            </p>
            <p className="mt-2 text-sm font-semibold">
              {user?.fullName ?? t("sellerShell.unknownSeller")}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {user?.email ?? t("sellerShell.noEmail")}
            </p>
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
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] lg:hidden"
                    aria-label={t("sellerShell.openMenu")}
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <h1 className="font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
                    {t("sellerShell.centerTitle")}
                  </h1>
                </div>
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
                  <p className="font-semibold text-[var(--foreground)]">
                    {user?.role ?? "SELLER"}
                  </p>
                  <p className="text-[var(--muted)]">{t("sellerShell.cookieAuth")}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {sellerBlocked ? (
              <div
                className="mb-6 rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-5 py-4"
                data-testid="seller-approval-banner"
              >
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
                  {sellerActionHref === "/seller/pending"
                    ? t("sellerShell.reviewStatus")
                    : t("sellerShell.openOnboarding")}
                </Link>
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.24)] lg:hidden">
          <div className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col border-r border-[var(--border)] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  {t("sellerShell.brand")}
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-mono-app)] text-xl font-bold text-[var(--foreground)]">
                  {t("sellerShell.title")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]"
                aria-label={t("sellerShell.closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{renderNavigation("mobile")}</div>
            <div className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("sellerShell.currentUser")}
              </p>
              <p className="mt-2 text-sm font-semibold">
                {user?.fullName ?? t("sellerShell.unknownSeller")}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {user?.email ?? t("sellerShell.noEmail")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SellerNavigation({
  mode,
  groups,
  pathname,
  collapsedGroups,
  activeGroupKey,
  onToggleGroup,
  onNavigate,
  searchQuery,
  onSearchQueryChange,
  t,
}: {
  mode: "desktop" | "mobile";
  groups: SellerNavGroup[];
  pathname: string;
  collapsedGroups: Record<string, boolean>;
  activeGroupKey: string | null;
  onToggleGroup: (groupKey: string) => void;
  onNavigate: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
        <Search className="h-4 w-4 text-[var(--muted)]" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t("sellerShell.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />
      </label>

      <nav className="space-y-3">
        {groups.map((group) => {
          const isActiveGroup = group.key === activeGroupKey;
          const isCollapsed = isActiveGroup ? false : Boolean(collapsedGroups[group.key]);

          return (
            <section
              key={group.key}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-3 py-3"
            >
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {group.label}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 text-[var(--muted)] transition-transform",
                    isCollapsed ? "" : "rotate-180",
                  )}
                />
              </button>
              {!isCollapsed ? (
                <div className={clsx("mt-2 space-y-1", mode === "mobile" ? "pb-1" : "")}>
                  {group.items.map((item) => {
                    const active = isSellerNavItemActive(pathname, item);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={clsx(
                          "flex items-center rounded-2xl px-4 py-2.5 text-sm font-medium transition",
                          active
                            ? "bg-gradient-primary text-white shadow-md"
                            : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}

        {groups.length < 1 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
            {t("sellerShell.noMatches")}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
