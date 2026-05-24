"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PublicShell } from "@/components/public/public-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useAuthStore } from "@/stores/auth-store";

const navItems = [
  { href: "/customer/account", label: "Overview" },
  { href: "/customer/notifications", label: "Notifications" },
  { href: "/customer/account/profile", label: "Profile" },
  { href: "/customer/account/addresses", label: "Addresses" },
  { href: "/customer/orders", label: "Orders" },
  { href: "/customer/returns", label: "Returns / refunds" },
  { href: "/customer/account/security", label: "Security" },
  { href: "/customer/account/support", label: "Support" },
];

export function CustomerAccountShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.customerUser);
  const logoutRole = useAuthStore((state) => state.logoutRole);
  const { run, isRunning } = useActionFeedback();

  return (
    <ProtectedShell
      role="customer"
      allowedRoles={["CUSTOMER"]}
      loginPath="/customer/login"
      redirectByRole={{
        ADMIN: "/admin/dashboard",
        SELLER: "/seller/dashboard",
      }}
    >
      <PublicShell>
        <main className="px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
            <aside className="card-panel h-fit overflow-hidden rounded-[2rem] border-white/70 bg-white/90 shadow-[0_24px_60px_rgba(82,27,94,0.08)] backdrop-blur lg:sticky lg:top-6 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
              <div className="bg-[radial-gradient(circle_at_top_left,rgba(203,17,171,0.18),transparent_48%),linear-gradient(135deg,#fff8fd_0%,#ffffff_64%,#f7f1fb_100%)] px-5 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  My account
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                  {user?.fullName || "Customer account"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Manage profile, shipping addresses, returns, orders, and security from one customer workspace.
                </p>
              </div>

              <nav className="grid gap-1 p-3" data-testid="customer-account-nav">
                {navItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/customer/account" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition",
                        active
                          ? "bg-[linear-gradient(135deg,rgba(203,17,171,0.14),rgba(161,0,255,0.09))] text-[var(--foreground)] shadow-[inset_0_0_0_1px_rgba(203,17,171,0.18)]"
                          : "text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    void run({
                      action: () => logoutRole("customer"),
                      successMessage: "Đăng xuất thành công",
                      onSuccess: () => {
                        router.push("/customer/login");
                      },
                    })
                  }
                  disabled={isRunning}
                  className="mt-2 rounded-[1.25rem] border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 disabled:opacity-50"
                  data-testid="customer-account-logout"
                >
                  {isRunning ? "Đang gửi..." : "Logout"}
                </button>
              </nav>
            </aside>

            <section className="space-y-6 min-w-0">
              <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),rgba(255,255,255,0.72)),linear-gradient(135deg,rgba(255,240,249,0.95),rgba(245,248,255,0.92))] px-6 py-6 shadow-[0_22px_50px_rgba(45,20,60,0.08)] sm:px-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                      Customer account
                    </p>
                    <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
                      {title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                      {description}
                    </p>
                  </div>
                  {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
                </div>
              </header>
              {children}
            </section>
          </div>
        </main>
      </PublicShell>
    </ProtectedShell>
  );
}
