"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/use-i18n";

export function PublicFooter() {
  const { t } = useI18n("customer");

  return (
    <footer className="border-t border-[var(--border)]/80 bg-[rgba(255,250,243,0.84)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("publicFooter.tagline")}
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
            {t("publicFooter.title")}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
            {t("publicFooter.description")}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("publicFooter.explore")}
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-[var(--foreground)]">
            <Link href="/products" prefetch={false}>{t("publicFooter.shop")}</Link>
            <Link href="/orders/track" prefetch={false}>{t("publicFooter.trackOrder")}</Link>
            <Link href="/customer/login" prefetch={false}>{t("publicFooter.login")}</Link>
            <Link href="/customer/register" prefetch={false}>{t("publicFooter.register")}</Link>
            <Link href="/seller/register" prefetch={false}>{t("publicFooter.sellWithUs")}</Link>
            <Link href="/seller/login" prefetch={false}>{t("publicFooter.sellerLogin")}</Link>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("publicFooter.manualPayment")}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {t("publicFooter.manualPaymentDesc")}
          </p>
        </div>
      </div>
      <div className="border-t border-[var(--border)]/70 bg-white/55">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <p className="text-xs leading-6 text-[var(--muted)]">
            {t("publicFooter.disclaimer")}
          </p>
        </div>
      </div>
    </footer>
  );
}
