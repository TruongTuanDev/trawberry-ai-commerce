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

const BILLING_COPY = {
  eyebrow: "Billing",
  title: "Seller wallet and campaign billing",
  description:
    "Review the current seller wallet, recent ledger entries, and campaign charge activity for the V1 sponsored recommendation flow.",
  currentShop: "Current shop",
  selectShop: "Pick a seller shop to view the billing foundation.",
  walletStatus: "Wallet status",
  balance: "Wallet balance",
  reservedBalance: "Reserved balance",
  availableBalance: "Available balance",
  currency: "Currency",
  foundationTitle: "Foundation scope",
  foundationDescription:
    "This wallet remains internal-only. It powers sponsored recommendation charging without changing checkout, payment, or customer-facing billing flows.",
  loading: "Loading billing foundation...",
  loadFailed: "Unable to load seller billing foundation.",
  walletEyebrow: "Wallet",
  walletTitle: "Wallet summary",
  walletDescription:
    "The wallet is shop-scoped and campaign CPC charges debit it transactionally when attributed recommendation clicks are billable.",
  ledgerEyebrow: "Ledger",
  ledgerTitle: "Ledger history",
  ledgerDescription:
    "Ledger rows show balance transitions after wallet mutations, including campaign recommendation click charges.",
  noLedger: "No ledger entries yet.",
  columns: {
    date: "Date",
    type: "Type",
    amount: "Amount",
    balanceAfter: "Balance after",
    reservedAfter: "Reserved after",
    campaign: "Campaign",
    description: "Description",
  },
} as const;

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
            setWallet(null);
            setLedger([]);
            setError(null);
            setLoading(false);
          }
          return;
        }

        const [nextWallet, nextLedger] = await Promise.all([
          getSellerBillingWallet(shopId),
          getSellerBillingLedger(shopId),
        ]);

        if (!active) return;
        setWallet(nextWallet);
        setLedger(nextLedger);
        setError(null);
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
  }, [currentShopId, hydrated, loadShops, shops.length]);

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
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{BILLING_COPY.loading}</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 xl:col-span-2">
              <p className="text-sm text-[var(--muted)]">{BILLING_COPY.currentShop}</p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {currentShop?.name ?? BILLING_COPY.selectShop}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{BILLING_COPY.balance}</p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {wallet ? formatMoney(wallet.balance, currency) : formatMoney("0", currency)}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{BILLING_COPY.reservedBalance}</p>
              <p className="mt-3 text-lg font-semibold text-[var(--warning)]">
                {wallet
                  ? formatMoney(wallet.reservedBalance, currency)
                  : formatMoney("0", currency)}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{BILLING_COPY.walletStatus}</p>
              <p className="mt-3 text-lg font-semibold uppercase text-[var(--foreground)]">
                {wallet?.status ?? "active"}
              </p>
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
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={BILLING_COPY.ledgerEyebrow}
        title={BILLING_COPY.ledgerTitle}
        description={BILLING_COPY.ledgerDescription}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.date}</th>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.type}</th>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.amount}</th>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.balanceAfter}</th>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.reservedAfter}</th>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.campaign}</th>
                <th className="px-3 py-2 font-medium">{BILLING_COPY.columns.description}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 text-[var(--muted)]">{formatDate(entry.createdAt)}</td>
                  <td className="px-3 py-3 font-medium uppercase text-[var(--foreground)]">
                    {entry.type}
                  </td>
                  <td className="px-3 py-3 text-[var(--foreground)]">
                    {formatMoney(entry.amount, entry.currency)}
                  </td>
                  <td className="px-3 py-3 text-[var(--foreground)]">
                    {formatMoney(entry.balanceAfter, entry.currency)}
                  </td>
                  <td className="px-3 py-3 text-[var(--foreground)]">
                    {formatMoney(entry.reservedAfter, entry.currency)}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {entry.campaign ? `${entry.campaign.name} (${entry.campaign.id.slice(0, 8)})` : "-"}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {entry.description ?? entry.referenceType ?? "-"}
                  </td>
                </tr>
              ))}
              {ledger.length < 1 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--muted)]">
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
