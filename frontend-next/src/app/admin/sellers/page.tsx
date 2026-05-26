"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  approveAdminSeller,
  listAdminSellers,
  rejectAdminSeller,
  type AdminSellerListResponse,
  type AdminSeller,
  type SellerApprovalStatus,
} from "@/lib/admin-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const statuses: Array<SellerApprovalStatus | "ALL"> = ["PENDING", "APPROVED", "REJECTED", "ALL"];

function formatApprovalStatus(value: SellerApprovalStatus | "ALL") {
  switch (value) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "ALL":
      return "All";
    default:
      return value;
  }
}

export default function AdminSellersPage() {
  const [status, setStatus] = useState<SellerApprovalStatus | "ALL">("PENDING");
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [summary, setSummary] = useState<AdminSellerListResponse["summary"]>({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [selectedSeller, setSelectedSeller] = useState<AdminSeller | null>(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run: runAction, isRunning } = useActionFeedback();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const result = await listAdminSellers({ status, q: search || undefined, page: 1, limit: 50 });
        if (!mounted) return;
        setSellers(result.items);
        setSummary(result.summary);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load seller approvals.");
        }
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
  }, [search, status]);

  const refresh = async () => {
    const result = await listAdminSellers({ status, q: search || undefined, page: 1, limit: 50 });
    setSellers(result.items);
    setSummary(result.summary);
  };

  const approve = async (seller: AdminSeller) => {
    setSavingUserId(seller.userId);
    setMessage(null);
    setError(null);
    await runAction({
      action: async () => {
        return approveAdminSeller(seller.userId);
      },
      successMessage: "Seller approved successfully.",
      onSuccess: async () => {
        await refresh();
      },
      onFinally: () => {
        setSavingUserId(null);
      }
    });
  };

  const reject = async () => {
    if (!selectedSeller) return;
    if (!window.confirm(`Reject seller ${selectedSeller.email}?`)) {
      return;
    }
    setSavingUserId(selectedSeller.userId);
    setMessage(null);
    setError(null);
    await runAction({
      action: async () => {
        return rejectAdminSeller(selectedSeller.userId, reason.trim() || undefined);
      },
      successMessage: "Seller rejected successfully.",
      onSuccess: async () => {
        setSelectedSeller(null);
        setReason("");
        await refresh();
      },
      onFinally: () => {
        setSavingUserId(null);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-sellers-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Seller approval</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
              Review marketplace sellers
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              New seller registrations stay pending until an admin approves them. Rejected sellers cannot create shops.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <Metric label="All" value={String(summary.all)} />
            <Metric label="Pending" value={String(summary.pending)} />
            <Metric label="Approved" value={String(summary.approved)} />
            <Metric label="Rejected" value={String(summary.rejected)} />
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seller status filters">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                status === item
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
              data-testid={`seller-status-tab-${item}`}
            >
              {formatApprovalStatus(item)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search seller by name, email, phone, or shop"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

        <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-[var(--border)]">
          <div className="hidden grid-cols-[1.2fr_1fr_120px_120px_140px_140px_300px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] lg:grid">
            <div>Seller</div>
            <div>Status</div>
            <div>Shops</div>
            <div>Revenue</div>
            <div>Pending fee</div>
            <div>Reviewed</div>
            <div>Actions</div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading sellers...</div>
            ) : sellers.length ? (
              sellers.map((seller) => (
                <article
                  key={seller.userId}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_120px_120px_140px_140px_300px] lg:items-center"
                  data-testid="admin-seller-row"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{seller.name ?? "Unnamed seller"}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{seller.email}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{seller.phone ?? "No phone"}{seller.primaryShopName ? ` · ${seller.primaryShopName}` : ""}</p>
                  </div>
                  <div>
                    <span className="inline-flex rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {formatApprovalStatus(seller.sellerApprovalStatus)}
                    </span>
                    {seller.sellerRejectionReason ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">{seller.sellerRejectionReason}</p>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--foreground)]">{seller.activeShopCount ?? 0}/{seller.shopCount ?? 0}</p>
                  <p className="text-sm text-[var(--foreground)]">{seller.revenueThisMonth ?? "0"} ₽</p>
                  <p className="text-sm text-[var(--foreground)]">{seller.pendingPlatformFees ?? "0"} ₽</p>
                  <p className="text-sm text-[var(--muted)]">
                    {seller.sellerApprovedAt ?? seller.sellerRejectedAt
                      ? new Date(seller.sellerApprovedAt ?? seller.sellerRejectedAt ?? "").toLocaleDateString()
                      : "Not reviewed"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/sellers/${seller.userId}`}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                      data-testid={`view-seller-${seller.userId}`}
                    >
                      Review
                    </Link>
                    <button
                      type="button"
                      onClick={() => void approve(seller)}
                      disabled={isRunning || seller.sellerApprovalStatus === "APPROVED"}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid={`approve-seller-${seller.userId}`}
                    >
                      {savingUserId === seller.userId && isRunning ? "Approving..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSeller(seller)}
                      disabled={isRunning || seller.sellerApprovalStatus === "REJECTED"}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid={`reject-seller-${seller.userId}`}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">No sellers match this status.</div>
            )}
          </div>
        </div>
      </section>

      {selectedSeller ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-2xl" data-testid="reject-seller-modal">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Reject seller</p>
            <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{selectedSeller.email}</h3>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={4}
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Reason, optional"
              data-testid="reject-reason-input"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedSeller(null)} disabled={isRunning} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button type="button" onClick={() => void reject()} disabled={isRunning} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" data-testid="confirm-reject-seller">
                {isRunning ? "Rejecting..." : "Reject seller"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
