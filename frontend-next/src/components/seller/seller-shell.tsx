"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { ShopSwitcher } from "@/components/seller/shop-switcher";

const navigation = [
  { href: "/seller/dashboard", label: "Dashboard" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/import/wildberries", label: "WB Excel" },
  { href: "/seller/import/wildberries-api", label: "WB Sync" },
  { href: "/seller/ai-images", label: "AI Images" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/support-cases", label: "Support" },
  { href: "/seller/payments", label: "Payments" },
  { href: "/seller/onboarding", label: "Onboarding" },
  { href: "/seller/settings", label: "Settings" },
];

export function SellerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const [loggingOut, setLoggingOut] = useState(false);
  const sellerBlocked =
    user?.role === "SELLER" &&
    user.sellerApprovalStatus &&
    user.sellerApprovalStatus !== "APPROVED";

  useEffect(() => {
    if (!user) return;
    if (sellerBlocked) return;
    void loadShops();
  }, [loadShops, sellerBlocked, user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="grain-overlay min-h-screen px-4 py-4 sm:px-6 sm:py-6" data-testid="seller-shell">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1600px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)]">
        <aside className="hidden w-72 flex-col justify-between border-r border-[var(--border)] bg-[linear-gradient(180deg,#3e1e24_0%,#2d181e_100%)] p-6 text-white lg:flex">
          <div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Strawberry</p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold">
                Seller Center
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Next.js migration shell for seller operations, product work, images, and AI tasks.
              </p>
            </div>
            <nav className="mt-8 space-y-2">
              {user?.role === "ADMIN" ? (
                <Link
                  href="/admin/sellers"
                  className="flex items-center rounded-2xl px-4 py-3 text-sm font-medium text-white/78 transition hover:bg-white/8 hover:text-white"
                >
                  Admin approvals
                </Link>
              ) : null}
              {navigation.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active ? "bg-white text-[#2d181e]" : "text-white/78 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Current user</p>
            <p className="mt-2 text-sm font-semibold">{user?.fullName ?? "Unknown seller"}</p>
            <p className="text-sm text-white/65">{user?.email ?? "No email loaded"}</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              data-testid="logout-button"
              className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-[#2d181e]"
            >
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--border)] bg-[rgba(255,250,243,0.92)] px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Seller Operations
                </p>
                <h1 className="mt-1 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
                  Migrating the seller center to Next.js
                </h1>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ShopSwitcher />
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  data-testid="logout-button-mobile"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
                >
                  {loggingOut ? "Signing out..." : "Logout"}
                </button>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{user?.role ?? "SELLER"}</p>
                  <p className="text-[var(--muted)]">Cookie-based authentication active.</p>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {sellerBlocked ? (
              <div className="mb-6 rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-5 py-4" data-testid="seller-approval-banner">
                <p className="text-sm font-semibold text-[var(--accent-strong)]">
                  {user?.sellerApprovalStatus === "REJECTED"
                    ? "Your seller account was rejected."
                    : "Your seller account is awaiting approval."}
                </p>
                {user?.sellerApprovalStatus === "REJECTED" && user.sellerRejectionReason ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">{user.sellerRejectionReason}</p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Complete onboarding and upload verification documents so an admin can review the account.
                  </p>
                )}
                <Link
                  href="/seller/onboarding"
                  className="mt-3 inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                >
                  Open onboarding
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
