"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";

export default function SellerPendingPage() {
  const user = useAuthStore((state) => state.sellerUser);
  const status = user?.sellerApprovalStatus ?? "PENDING";
  const nextStep = user?.sellerNextStep ?? "WAIT_FOR_APPROVAL";

  return (
    <div className="space-y-6" data-testid="seller-pending-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Seller approval</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          {status === "REJECTED" ? "Seller account needs attention" : "Seller account under review"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          {status === "REJECTED"
            ? "Your onboarding submission was reviewed and needs changes before approval."
            : "Your onboarding profile and documents are in the admin review queue. Public marketplace access remains hidden until approval."}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Current status</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]" data-testid="seller-pending-status">
            {status}
          </p>
          {user?.sellerRejectionReason ? (
            <div className="mt-4 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
              {user.sellerRejectionReason}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/seller/onboarding"
              className="inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
            >
              Review onboarding
            </Link>
            <Link
              href="/seller/dashboard"
              className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
            >
              Try dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Next step</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{nextStep}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {nextStep === "CONTACT_SUPPORT"
              ? "Update onboarding details, replace rejected documents if needed, and contact support or an admin reviewer if the rejection note is unclear."
              : "No further seller action is required right now. An admin will approve or reject the account after reviewing the onboarding profile and documents."}
          </p>
        </div>
      </section>
    </div>
  );
}
