"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.adminUser);

  useEffect(() => {
    if (!user) {
      return;
    }
  }, [router, user]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel max-w-md rounded-[1.5rem] px-8 py-6 text-center">
          <p className="text-sm text-[var(--muted)]">Checking admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grain-overlay min-h-screen px-4 py-4 sm:px-6 sm:py-6" data-testid="admin-shell">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1400px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)]">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-900 p-6 text-slate-100 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin</p>
          <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-white">Marketplace Ops</h1>
          <nav className="mt-8 space-y-2">
            <Link
              href="/admin/dashboard"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/dashboard") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/sellers"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/sellers") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Seller approvals
            </Link>
            <Link
              href="/admin/deliveries"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/deliveries") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Delivery supervision
            </Link>
            <Link
              href="/admin/payments-supervision"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/payments-supervision") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Payments supervision
            </Link>
            <Link
              href="/admin/queues"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/queues") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Operational queues
            </Link>
            <Link
              href="/admin/support-cases"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/support-cases") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Support cases
            </Link>
            <Link
              href="/admin/reports"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/reports") ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Reports
            </Link>
            <Link href="/seller/dashboard" className="flex rounded-2xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white mt-4 border border-slate-800">
              Seller center
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
