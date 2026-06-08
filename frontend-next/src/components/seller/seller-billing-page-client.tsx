"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  devCreditSellerBillingWallet,
  getSellerBillingLedger,
  getSellerBillingWallet,
  type SellerBillingDevCreditResult,
  type SellerBillingLedgerEntry,
  type SellerBillingWallet,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const BILLING_DEV_TOOLS_ENABLED =
  process.env.NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED === "true";

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
  demoReadinessTitle: "V1 demo readiness",
  demoReadinessDescription:
    "Use this page to show wallet state, funded demo balance, and campaign charge history without introducing any real checkout or payment-provider top-up flow.",
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
  devFundingEyebrow: "Demo funding",
  devFundingTitle: "Local dev/demo wallet credit",
  devFundingDescription:
    "This action is for local demo and QA only. It is not a real payment, top-up, or customer-visible billing flow.",
  devFundingDisabled:
    "Demo wallet funding is hidden unless NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED=true and the backend BILLING_DEV_TOOLS_ENABLED flag are both enabled.",
  devFundingAmount: "Credit amount",
  devFundingAction: "Add demo funds",
  devFundingSubmitting: "Funding wallet...",
  devFundingHint:
    "Recommended for demos: credit a small wallet amount, then trigger sponsored clicks from the public storefront to show spend deductions safely.",
  devFundingSuccess: "Demo funds added to the current seller wallet.",
  demoOnlyLabel: "Demo/dev only",
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
  const [message, setMessage] = useState<string | null>(null);
  const [devFundingAmount, setDevFundingAmount] = useState("250");
  const [devFundingSubmitting, setDevFundingSubmitting] = useState(false);

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
  }, [currentShopId, hydrated, loadShops, shops.length]);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  const currency = wallet?.currency ?? "RUB";

  const handleDevFunding = async () => {
    if (!currentShopId) return;

    const amount = Number(devFundingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Demo funding amount must be greater than zero.");
      return;
    }

    setDevFundingSubmitting(true);
    try {
      const result: SellerBillingDevCreditResult =
        await devCreditSellerBillingWallet(currentShopId, { amount });
      setWallet(result.wallet);
      setLedger((current) => [result.entry, ...current]);
      setMessage(BILLING_COPY.devFundingSuccess);
      setError(null);
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : BILLING_COPY.loadFailed,
      );
    } finally {
      setDevFundingSubmitting(false);
    }
  };

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
                Finance workflow
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                Track wallet health, reserve usage, and campaign spend in one place.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Available now
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                Wallet, ledger, demo credit tools
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Protected scope
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                No checkout or customer billing behavior changed
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
        {message ? <p className="mt-4 text-sm text-[var(--success)]">{message}</p> : null}
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
            <p className="text-sm text-[var(--muted)]">{BILLING_COPY.demoReadinessTitle}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {BILLING_COPY.demoReadinessDescription}
            </p>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={BILLING_COPY.devFundingEyebrow}
        title={BILLING_COPY.devFundingTitle}
        description={BILLING_COPY.devFundingDescription}
      >
        {BILLING_DEV_TOOLS_ENABLED ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--warning)]">
                {BILLING_COPY.demoOnlyLabel}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                {BILLING_COPY.devFundingHint}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {BILLING_COPY.devFundingAmount}
                </span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                  type="number"
                  min="0.01"
                  max="50000"
                  step="0.01"
                  value={devFundingAmount}
                  onChange={(event) => setDevFundingAmount(event.target.value)}
                />
              </label>
              <button
                className="mt-4 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] disabled:opacity-60"
                disabled={devFundingSubmitting || !currentShopId}
                onClick={() => void handleDevFunding()}
                type="button"
              >
                {devFundingSubmitting
                  ? BILLING_COPY.devFundingSubmitting
                  : BILLING_COPY.devFundingAction}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {BILLING_COPY.devFundingDisabled}
          </p>
        )}
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
