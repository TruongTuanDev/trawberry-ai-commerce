"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";

export default function SellerPendingPage() {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const status = user?.sellerApprovalStatus ?? "PENDING";
  const nextStep = user?.sellerNextStep ?? "WAIT_FOR_APPROVAL";

  const formatStatus = (value: string) => {
    const key = `seller.pending.status.${value}`;
    const translated = t(key);
    return translated !== key ? translated : value;
  };

  const formatNextStep = (value: string) => {
    const key = `seller.pending.nextSteps.${value}`;
    const translated = t(key);
    return translated !== key ? translated : value;
  };

  return (
    <div className="space-y-6" data-testid="seller-pending-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t("seller.pending.eyebrow")}</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          {status === "REJECTED" ? t("seller.pending.titleAttention") : t("seller.pending.titleReview")}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          {status === "REJECTED"
            ? t("seller.pending.subtitleRejected")
            : t("seller.pending.subtitleReview")}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{t("seller.pending.currentStatus")}</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]" data-testid="seller-pending-status">
            {formatStatus(status)}
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
              {t("seller.pending.reviewOnboarding")}
            </Link>
            <Link
              href="/seller/dashboard"
              className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
            >
              {t("seller.pending.tryDashboard")}
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{t("seller.pending.nextStep")}</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{formatNextStep(nextStep)}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {nextStep === "CONTACT_SUPPORT"
              ? t("seller.pending.nextStepContact")
              : t("seller.pending.nextStepDefault")}
          </p>
        </div>
      </section>
    </div>
  );
}
