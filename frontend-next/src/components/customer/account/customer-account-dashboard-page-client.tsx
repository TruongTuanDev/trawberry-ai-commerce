"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { useI18n } from "@/i18n/use-i18n";
import {
  getCustomerAddresses,
  getCustomerOrderHistory,
  getCustomerProfile,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customer-api";

export function CustomerAccountDashboardPageClient() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n("customer");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const [profileResponse, addressesResponse, ordersResponse] =
          await Promise.all([
            getCustomerProfile(),
            getCustomerAddresses(),
            getCustomerOrderHistory(),
          ]);

        if (!mounted) {
          return;
        }

        setProfile(profileResponse);
        setAddresses(addressesResponse.items);
        setOrdersCount(ordersResponse.items.length);
        setError(null);
      } catch (issue) {
        if (!mounted) {
          return;
        }
        setError(issue instanceof Error ? issue.message : t("customer.dashboard.loadFailed"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [t]);

  return (
    <CustomerAccountShell
      title={t("customer.dashboard.title")}
      description={t("customer.dashboard.description")}
    >
      {error ? (
        <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label={t("customer.dashboard.displayName")} value={profile?.name || t("common.notProvided")} />
        <MetricCard label={t("customer.dashboard.savedAddresses")} value={loading ? "..." : String(addresses.length)} />
        <MetricCard label={t("customer.dashboard.checkouts")} value={loading ? "..." : String(ordersCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card-panel rounded-[1.75rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("customer.dashboard.quickProfileEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {t("customer.dashboard.quickProfileTitle")}
              </h2>
            </div>
            <Link href="/customer/account/profile" className="public-button-secondary inline-flex px-4 py-2 text-sm">
              {t("customer.dashboard.editProfile")}
            </Link>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoRow label={t("customer.profile.fullName")} value={profile?.name || t("common.notProvided")} />
            <InfoRow label={t("customer.profile.email")} value={profile?.email || t("common.notProvided")} />
            <InfoRow label={t("customer.profile.phone")} value={profile?.phone || t("common.notProvided")} />
            <InfoRow
              label={t("customer.dashboard.createdAt")}
              value={
                profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleString()
                  : t("common.notProvided")
              }
            />
          </dl>
        </section>

        <section className="card-panel rounded-[1.75rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("customer.dashboard.quickActionsEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {t("customer.dashboard.quickActionsTitle")}
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <QuickAction href="/customer/account/addresses" title={t("customer.dashboard.addressesTitle")}>
              {t("customer.dashboard.addressesDescription")}
            </QuickAction>
            <QuickAction href="/customer/orders" title={t("customer.dashboard.ordersTitle")}>
              {t("customer.dashboard.ordersDescription")}
            </QuickAction>
            <QuickAction href="/customer/account/security" title={t("customer.dashboard.securityTitle")}>
              {t("customer.dashboard.securityDescription")}
            </QuickAction>
          </div>
        </section>
      </div>
    </CustomerAccountShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-panel rounded-[1.6rem] bg-[linear-gradient(180deg,#ffffff_0%,#fcf8ff_100%)] px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function QuickAction({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[1.35rem] border border-[var(--border)] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_16px_36px_rgba(203,17,171,0.12)]"
    >
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{children}</p>
    </Link>
  );
}
