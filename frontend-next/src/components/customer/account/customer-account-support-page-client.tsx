"use client";

import Link from "next/link";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { useI18n } from "@/i18n/use-i18n";

export function CustomerAccountSupportPageClient() {
  const { t } = useI18n("customer");

  return (
    <CustomerAccountShell
      title={t("customer.support.pageTitle")}
      description={t("customer.support.pageDescription")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SupportCard
          href="/customer/orders"
          title={t("customer.support.ordersSupportTitle")}
          description={t("customer.support.ordersSupportDescription")}
        />
        <SupportCard
          href="/orders/track"
          title={t("customer.support.publicLookupTitle")}
          description={t("customer.support.publicLookupDescription")}
        />
      </div>
    </CustomerAccountShell>
  );
}

function SupportCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card-panel rounded-[1.75rem] px-6 py-6 transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(203,17,171,0.12)]"
    >
      <p className="text-lg font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
