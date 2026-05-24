"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  generateAdminSellerFeeInvoice,
  listAdminSellerFeeInvoices,
  listAdminSellerFees,
  markAdminSellerFeeInvoicePaid,
  type AdminSellerFeeInvoice,
  type AdminSellerFeeRow,
  updateAdminShopCommission,
} from "@/lib/admin-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";

function formatRub(value: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function AdminSellerFeesPageClient() {
  const [rows, setRows] = useState<AdminSellerFeeRow[]>([]);
  const [invoices, setInvoices] = useState<AdminSellerFeeInvoice[]>([]);
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [generatingShopId, setGeneratingShopId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { run: runAction, isRunning } = useActionFeedback();

  const invoiceByShop = useMemo(
    () => new Map(invoices.map((invoice) => [`${invoice.shopId}:${invoice.billingPeriod}`, invoice])),
    [invoices],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [nextRows, nextInvoices] = await Promise.all([
        listAdminSellerFees(),
        listAdminSellerFeeInvoices(),
      ]);
      setRows(nextRows);
      setInvoices(nextInvoices);
      setCommissionDrafts((current) => {
        const next = { ...current };
        for (const row of nextRows) {
          if (!(row.shopId in next)) {
            next[row.shopId] = row.commissionPercent;
          }
        }
        return next;
      });
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load seller fees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleSaveCommission = async (row: AdminSellerFeeRow) => {
    const raw = commissionDrafts[row.shopId] ?? row.commissionPercent;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError("Commission percent must be a valid non-negative number.");
      return;
    }

    setSavingShopId(row.shopId);
    setError(null);
    setSuccess(null);
    await runAction({
      action: async () => {
        return updateAdminShopCommission(row.shopId, { commissionPercent: value });
      },
      successMessage: "Đã lưu hoa hồng thành công.",
      onSuccess: async () => {
        setSuccess(`Commission saved for ${row.shopName}.`);
        await loadData();
      },
      onFinally: () => {
        setSavingShopId(null);
      }
    });
  };

  const handleGenerateInvoice = async (row: AdminSellerFeeRow) => {
    if (!window.confirm(`Bạn có chắc chắn muốn TẠO hóa đơn mới cho ${row.shopName} (${row.billingPeriod}) không?`)) {
      return;
    }
    setGeneratingShopId(row.shopId);
    setError(null);
    setSuccess(null);
    await runAction({
      action: async () => {
        return generateAdminSellerFeeInvoice(row.shopId, {
          billingPeriod: row.billingPeriod,
        });
      },
      successMessage: "Đã tạo hóa đơn thành công.",
      onSuccess: async () => {
        setSuccess(`Invoice generated for ${row.shopName} (${row.billingPeriod}).`);
        await loadData();
      },
      onFinally: () => {
        setGeneratingShopId(null);
      }
    });
  };

  const handleMarkPaid = async (invoiceId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn XÁC NHẬN hóa đơn này đã được thanh toán không?")) {
      return;
    }
    setPayingInvoiceId(invoiceId);
    setError(null);
    setSuccess(null);
    await runAction({
      action: async () => {
        return markAdminSellerFeeInvoicePaid(invoiceId);
      },
      successMessage: "Đã xác nhận thanh toán hóa đơn.",
      onSuccess: async () => {
        setSuccess("Invoice marked as paid.");
        await loadData();
      },
      onFinally: () => {
        setPayingInvoiceId(null);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-seller-fees-page">
      <section className="card-panel rounded-[1.75rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Finance
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          Seller fee settings
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Platform commission is configured per shop. Confirmed orders snapshot that shop commission at payment confirmation time, and invoices use ledger snapshots instead of recalculating with a new percent later.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
            Phí sàn cấu hình theo shop.
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
            Đơn hàng dùng commission snapshot tại thời điểm xác nhận thanh toán.
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-600">{success}</p> : null}
      </section>

      <section className="card-panel overflow-x-auto rounded-[1.75rem] p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--panel-strong)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Shop</th>
              <th className="px-4 py-3 font-medium">Seller contact</th>
              <th className="px-4 py-3 font-medium">Orders today / month</th>
              <th className="px-4 py-3 font-medium">Revenue month</th>
              <th className="px-4 py-3 font-medium">Confirmed revenue</th>
              <th className="px-4 py-3 font-medium">Shop commission %</th>
              <th className="px-4 py-3 font-medium">Platform fee due</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const invoice = invoiceByShop.get(`${row.shopId}:${row.billingPeriod}`) ?? null;
              return (
                <tr key={row.shopId} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[var(--foreground)]">{row.shopName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {row.daysLeftInMonth} day(s) left this month
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-[var(--foreground)]">
                      {row.sellerName ?? "Unknown seller"}
                    </p>
                    <p className="text-[var(--muted)]">{row.sellerEmail}</p>
                    <p className="text-[var(--muted)]">{row.sellerPhone ?? "No phone"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p>{row.ordersToday} today</p>
                    <p className="text-[var(--muted)]">{row.ordersThisMonth} this month</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-[var(--foreground)]">
                      {formatRub(row.revenueThisMonth)}
                    </p>
                    <p className="text-[var(--muted)]">{formatRub(row.revenueToday)} today</p>
                  </td>
                  <td className="px-4 py-4 font-medium text-[var(--foreground)]">
                    {formatRub(row.confirmedRevenueThisMonth)}
                  </td>
                  <td className="px-4 py-4">
                    <input
                      value={commissionDrafts[row.shopId] ?? row.commissionPercent}
                      onChange={(event) =>
                        setCommissionDrafts((current) => ({
                          ...current,
                          [row.shopId]: event.target.value,
                        }))
                      }
                      className="w-24 rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                      data-testid={`admin-commission-input-${row.shopId}`}
                    />
                  </td>
                  <td
                    className="px-4 py-4 font-medium text-[var(--warning)]"
                    data-testid={`admin-platform-fee-due-${row.shopId}`}
                  >
                    {formatRub(row.platformFeeDue)}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-[var(--foreground)]">{row.billingPeriod}</p>
                    <p className="text-xs text-[var(--muted)]">Ledger snapshot billing only</p>
                  </td>
                  <td className="px-4 py-4">
                    <p
                      className="font-medium text-[var(--foreground)]"
                      data-testid={`admin-invoice-status-${row.shopId}`}
                    >
                      {invoice?.status ?? row.invoiceStatus ?? "No invoice"}
                    </p>
                    {invoice?.paidAt ? (
                      <p className="text-xs text-[var(--muted)]">
                        Paid {new Date(invoice.paidAt).toLocaleDateString("ru-RU")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => void handleSaveCommission(row)}
                        disabled={isRunning}
                        loading={savingShopId === row.shopId && isRunning}
                        data-testid={`admin-save-commission-${row.shopId}`}
                      >
                        Save commission
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => void handleGenerateInvoice(row)}
                        disabled={isRunning}
                        loading={generatingShopId === row.shopId && isRunning}
                        data-testid={`admin-generate-invoice-${row.shopId}`}
                      >
                        Generate invoice
                      </Button>
                      {invoice ? (
                        <Button
                          variant={invoice.status === "PAID" ? "outline" : "success"}
                          size="xs"
                          onClick={() => void handleMarkPaid(invoice.id)}
                          disabled={invoice.status === "PAID" || isRunning}
                          loading={payingInvoiceId === invoice.id && isRunning}
                          data-testid={`admin-mark-invoice-paid-${invoice.id}`}
                        >
                          {invoice.status === "PAID" ? "Already paid" : "Mark paid"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length < 1 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[var(--muted)]">
                  No seller shops available for finance supervision.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
