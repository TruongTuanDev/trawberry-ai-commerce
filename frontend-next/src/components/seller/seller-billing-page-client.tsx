"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  getSellerBillingLedger,
  getSellerBillingWallet,
  type SellerBillingLedgerEntry,
  type SellerBillingWallet,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useI18n } from "@/i18n/use-i18n";

function getBillingCopy(t: (key: string) => string) {
  return {
    eyebrow: t("seller.billing.eyebrow"),
    title: t("seller.billing.title"),
    description: t("seller.billing.description"),
    currentShop: t("seller.billing.currentShop"),
    selectShop: t("seller.billing.selectShop"),
    walletStatus: t("seller.billing.walletStatus"),
    balance: t("seller.billing.balance"),
    reservedBalance: t("seller.billing.reservedBalance"),
    availableBalance: t("seller.billing.availableBalance"),
    currency: t("seller.billing.currency"),
    foundationTitle: t("seller.billing.foundationTitle"),
    foundationDescription: t("seller.billing.foundationDescription"),
    operationsTitle: t("seller.billing.operationsTitle"),
    operationsDescription: t("seller.billing.operationsDescription"),
    loading: t("seller.billing.loading"),
    loadFailed: t("seller.billing.loadFailed"),
    walletEyebrow: t("seller.billing.walletEyebrow"),
    walletTitle: t("seller.billing.walletTitle"),
    walletDescription: t("seller.billing.walletDescription"),
    ledgerEyebrow: t("seller.billing.ledgerEyebrow"),
    ledgerTitle: t("seller.billing.ledgerTitle"),
    ledgerDescription: t("seller.billing.ledgerDescription"),
    noLedger: t("seller.billing.noLedger"),
    workflow: t("seller.billing.workflow"),
    workflowDescription: t("seller.billing.workflowDescription"),
    availableNow: t("seller.billing.availableNow"),
    availableNowDescription: t("seller.billing.availableNowDescription"),
    protectedScope: t("seller.billing.protectedScope"),
    protectedScopeDescription: t("seller.billing.protectedScopeDescription"),
    columns: {
      date: t("seller.billing.columns.date"),
      type: t("seller.billing.columns.type"),
      amount: t("seller.billing.columns.amount"),
      balanceAfter: t("seller.billing.columns.balanceAfter"),
      reservedAfter: t("seller.billing.columns.reservedAfter"),
      campaign: t("seller.billing.columns.campaign"),
      description: t("seller.billing.columns.description"),
    },
  };
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export function SellerBillingPageClient() {
  const { t } = useI18n("seller");
  const BILLING_COPY = useMemo(() => getBillingCopy(t), [t]);
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);

  const [wallet, setWallet] = useState<SellerBillingWallet | null>(null);
  const [ledger, setLedger] = useState<SellerBillingLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loadBilling = async (shopId: string | null) => {
    if (!shopId) {
      setWallet(null);
      setLedger([]);
      setError(null);
      setLoading(false);
      return;
    }

    const [nextWallet, nextLedger] = await Promise.all([
      getSellerBillingWallet(shopId),
      getSellerBillingLedger(shopId),
    ]);

    setWallet(nextWallet);
    setLedger(nextLedger);
    setError(null);
  };

  useEffect(() => {
    if (!hydrated) return;
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        if (shops.length < 1) {
          await loadShops();
        }
        const shopId = useSellerWorkspaceStore.getState().currentShopId;
        if (!shopId) {
          if (active) {
            await loadBilling(null);
          }
          return;
        }

        if (!active) return;
        await loadBilling(shopId);
      } catch (issue) {
        if (active) {
          setError(
            issue instanceof Error ? issue.message : BILLING_COPY.loadFailed,
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [BILLING_COPY.loadFailed, currentShopId, hydrated, loadShops, shops.length]);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  const currency = wallet?.currency ?? "RUB";

  return (
    <div className="space-y-6" data-testid="seller-billing-page">
      <SectionCard
        eyebrow={BILLING_COPY.eyebrow}
        title={BILLING_COPY.title}
        description={BILLING_COPY.description}
      >
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(79,70,229,0.06),rgba(255,255,255,0.96))] p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.25rem] border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {BILLING_COPY.workflow}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {BILLING_COPY.workflowDescription}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {BILLING_COPY.availableNow}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {BILLING_COPY.availableNowDescription}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {BILLING_COPY.protectedScope}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {BILLING_COPY.protectedScopeDescription}
              </p>
            </div>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{BILLING_COPY.loading}</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 shadow-sm hover:shadow-md transition duration-200 xl:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{BILLING_COPY.currentShop}</p>
              <p className="mt-3 text-lg font-bold text-[var(--foreground)]">
                {currentShop?.name ?? BILLING_COPY.selectShop}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 shadow-sm hover:shadow-md transition duration-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{BILLING_COPY.balance}</p>
              <p className="mt-3 text-2xl font-black text-[var(--foreground)]">
                {wallet ? formatMoney(wallet.balance, currency) : formatMoney("0", currency)}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 shadow-sm hover:shadow-md transition duration-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{BILLING_COPY.reservedBalance}</p>
              <p className="mt-3 text-2xl font-black text-[var(--warning)]">
                {wallet
                  ? formatMoney(wallet.reservedBalance, currency)
                  : formatMoney("0", currency)}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 shadow-sm hover:shadow-md transition duration-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{BILLING_COPY.walletStatus}</p>
              <div className="mt-3">
                <span className={`premium-badge ${
                  wallet?.status === "active" ? "premium-badge-success" : "premium-badge-warning"
                }`}>
                  {wallet?.status ?? "active"}
                </span>
              </div>
            </article>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow={BILLING_COPY.walletEyebrow}
        title={BILLING_COPY.walletTitle}
        description={BILLING_COPY.walletDescription}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="text-sm text-[var(--muted)]">{BILLING_COPY.availableBalance}</p>
            <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
              {wallet
                ? formatMoney(wallet.availableBalance, currency)
                : formatMoney("0", currency)}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="text-sm text-[var(--muted)]">{BILLING_COPY.currency}</p>
            <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
              {currency}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 xl:col-span-2">
            <p className="text-sm text-[var(--muted)]">{BILLING_COPY.foundationTitle}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {BILLING_COPY.foundationDescription}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 xl:col-span-2">
            <p className="text-sm text-[var(--muted)]">{BILLING_COPY.operationsTitle}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {BILLING_COPY.operationsDescription}
            </p>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={BILLING_COPY.ledgerEyebrow}
        title={BILLING_COPY.ledgerTitle}
        description={BILLING_COPY.ledgerDescription}
      >
        <div className="table-shell overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-[var(--panel-strong)] text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.date}</th>
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.type}</th>
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.amount}</th>
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.balanceAfter}</th>
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.reservedAfter}</th>
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.campaign}</th>
                <th className="border-b border-[var(--border)] px-4 py-3 font-semibold">{BILLING_COPY.columns.description}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                  <td className="border-b border-[var(--border)] px-4 py-3 text-[var(--muted)]">{formatDate(entry.createdAt)}</td>
                  <td className="border-b border-[var(--border)] px-4 py-3 font-medium uppercase text-[var(--foreground)]">
                    <span className={`premium-badge ${
                      entry.type === "DEBIT" ? "premium-badge-danger" : "premium-badge-success"
                    }`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 font-semibold text-[var(--foreground)]">
                    {formatMoney(entry.amount, entry.currency)}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-[var(--foreground)]">
                    {formatMoney(entry.balanceAfter, entry.currency)}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-[var(--foreground)]">
                    {formatMoney(entry.reservedAfter, entry.currency)}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
                    {entry.campaign ? `${entry.campaign.name} (${entry.campaign.id.slice(0, 8)})` : "-"}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-[var(--muted)]">
                    {entry.description ?? entry.referenceType ?? "-"}
                  </td>
                </tr>
              ))}
              {ledger.length < 1 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--muted)]">
                    {BILLING_COPY.noLedger}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
