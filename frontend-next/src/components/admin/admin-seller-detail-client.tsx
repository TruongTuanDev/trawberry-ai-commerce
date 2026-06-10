"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveAdminSeller,
  approveAdminSellerDocument,
  getAdminSeller,
  getAdminSellerOnboarding,
  listAdminAuditLogs,
  listAdminSellerDocuments,
  rejectAdminSeller,
  rejectAdminSellerDocument,
  type AdminAuditLog,
  type AdminSellerDetail,
} from "@/lib/admin-api";
import type { SellerDocument, SellerOnboardingProfile } from "@/lib/seller-onboarding-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";

function formatApprovalStatus(value: string | null | undefined) {
  switch (value) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return value ?? "Not provided";
  }
}

function formatDocumentType(value: string | null | undefined) {
  switch (value) {
    case "PASSPORT":
      return "Passport";
    case "INN":
      return "INN";
    case "OGRN":
      return "OGRN";
    case "COMPANY_REGISTRATION":
      return "Company registration";
    case "BANK_DETAILS":
      return "Bank details";
    case "OTHER":
      return "Other";
    default:
      return value ?? "Not provided";
  }
}

function formatLegalType(value: string | null | undefined) {
  switch (value) {
    case "INDIVIDUAL":
      return "Individual";
    case "IP":
      return "Sole proprietor";
    case "LLC":
      return "LLC";
    case "OTHER":
      return "Other";
    default:
      return value ?? "Not provided";
  }
}

function formatPaymentConfigStatus(value: string | null | undefined) {
  switch (value) {
    case "READY":
      return "Ready";
    case "MISSING":
      return "Missing";
    case "PENDING":
      return "Pending";
    default:
      return value ?? "Not provided";
  }
}

function formatCodeLabel(value: string | null | undefined) {
  if (!value) {
    return "Not provided";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminSellerDetailClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [seller, setSeller] = useState<AdminSellerDetail | null>(null);
  const [profile, setProfile] = useState<SellerOnboardingProfile | null>(null);
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [documentRejectReasons, setDocumentRejectReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run: runAction, isRunning } = useActionFeedback();

  const load = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [sellerResult, onboardingResult, documentResult, auditResult] = await Promise.all([
        getAdminSeller(userId),
        getAdminSellerOnboarding(userId),
        listAdminSellerDocuments(userId),
        listAdminAuditLogs(userId),
      ]);
      setSeller(sellerResult);
      setProfile(onboardingResult.profile);
      setDocuments(documentResult);
      setAuditLogs(auditResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load seller onboarding.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const approveDocument = async (documentId: string) => {
    setSaving(documentId);
    setMessage(null);
    setError(null);
    await runAction({
      action: async () => {
        return approveAdminSellerDocument(userId, documentId);
      },
      successMessage: "Document approved successfully.",
      onSuccess: async () => {
        await load(false);
      },
      onError: (_issue, message) => {
        setError(message);
      },
      onFinally: () => {
        setSaving(null);
      }
    });
  };

  const rejectDocument = async (documentId: string) => {
    if (!window.confirm("Reject this document?")) {
      return;
    }
    setSaving(documentId);
    setMessage(null);
    setError(null);
    await runAction({
      action: async () => {
        return rejectAdminSellerDocument(userId, documentId, documentRejectReasons[documentId]?.trim() || undefined);
      },
      successMessage: "Document rejected successfully.",
      onSuccess: async () => {
        await load(false);
      },
      onError: (_issue, message) => {
        setError(message);
      },
      onFinally: () => {
        setSaving(null);
      }
    });
  };

  const approveSeller = async () => {
    setSaving("seller");
    setMessage(null);
    setError(null);
    await runAction({
      action: async () => {
        return approveAdminSeller(userId);
      },
      successMessage: "Seller approved successfully.",
      onSuccess: async () => {
        const updated = await getAdminSeller(userId);
        setSeller(updated);
        await load(false);
      },
      onError: (_issue, message) => {
        setError(message);
      },
      onFinally: () => {
        setSaving(null);
      }
    });
  };

  const rejectSeller = async () => {
    if (!window.confirm("Reject this seller?")) {
      return;
    }
    setSaving("seller");
    setMessage(null);
    setError(null);
    await runAction({
      action: async () => {
        return rejectAdminSeller(userId, rejectReason.trim() || undefined);
      },
      successMessage: "Seller rejected successfully.",
      onSuccess: async () => {
        const updated = await getAdminSeller(userId);
        setSeller(updated);
        await load(false);
      },
      onError: (_issue, message) => {
        setError(message);
      },
      onFinally: () => {
        setSaving(null);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-seller-detail-page">
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/admin/sellers")}
        >
          Back to sellers
        </Button>
      </div>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Seller onboarding</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
              {seller?.email ?? "Loading seller"}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{seller?.name ?? "Unnamed seller"}</p>
          </div>
          <span className="w-fit rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]" data-testid="admin-seller-status">
            {formatApprovalStatus(seller?.sellerApprovalStatus) ?? "Loading"}
          </span>
        </div>
        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
      </section>

      {seller ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Marketplace operations summary</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ProfileField label="Shops" value={`${seller.activeShopCount ?? 0}/${seller.shopCount ?? 0} active`} />
            <ProfileField label="Contact phone" value={seller.contactPhone} />
            <ProfileField label="Revenue this month" value={`${seller.financeSummary.revenueThisMonth} ₽`} />
            <ProfileField label="Pending platform fees" value={`${seller.financeSummary.pendingPlatformFees} ₽`} />
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Shops</p>
              <div className="mt-3 space-y-3">
                {seller.shops.map((shop) => (
                  <div key={shop.id} className="rounded-[0.9rem] border border-[var(--border)] bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{shop.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatCodeLabel(shop.status)} · payment {formatPaymentConfigStatus(shop.paymentConfigStatus)}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Revenue {shop.confirmedRevenueThisMonth} ₽ · Pending fee {shop.pendingPlatformFees} ₽
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Recent orders</p>
              <div className="mt-3 space-y-3">
                {seller.recentOrders.length ? seller.recentOrders.map((order) => (
                  <div key={order.id} className="rounded-[0.9rem] border border-[var(--border)] bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{order.orderCode}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{order.shopName}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {formatCodeLabel(order.status)} · {formatCodeLabel(order.paymentStatus)} · {order.totalAmount} ₽
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--muted)]">No recent orders yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <h3 className="text-lg font-bold text-[var(--foreground)]">Legal profile</h3>
        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading profile...</p>
        ) : profile ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ProfileField label="Legal type" value={formatLegalType(profile.legalType)} />
            <ProfileField label="Legal name" value={profile.legalName} />
            <ProfileField label="INN" value={profile.inn} />
            <ProfileField label="OGRN" value={profile.ogrn} />
            <ProfileField label="KPP" value={profile.kpp} />
            <ProfileField label="Address" value={profile.legalAddress} />
            <ProfileField label="Contact name" value={profile.contactName} />
            <ProfileField label="Contact phone" value={profile.contactPhone} />
            <ProfileField label="Contact email" value={profile.contactEmail} />
            <ProfileField label="Bank" value={profile.bankName} />
            <ProfileField label="Bank account" value={profile.bankAccount} />
            <ProfileField label="BIK" value={profile.bik} />
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <h3 className="text-lg font-bold text-[var(--foreground)]">Documents</h3>
        <div className="mt-4 space-y-3">
          {documents.length ? (
            documents.map((document) => (
              <article key={document.id} className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4" data-testid="admin-document-row">
                <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_140px_1.4fr] lg:items-start">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{document.originalName ?? document.documentType}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatDocumentType(document.documentType)}</p>
                    <a href={document.url} target="_blank" className="mt-1 block text-xs text-[var(--accent-strong)]" rel="noreferrer">
                      Open document
                    </a>
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">{formatApprovalStatus(document.status)}</span>
                  <div className="flex flex-col gap-2">
                    <input
                      value={documentRejectReasons[document.id] ?? ""}
                      onChange={(event) => setDocumentRejectReasons((current) => ({ ...current, [document.id]: event.target.value }))}
                      placeholder="Reject reason, optional"
                      className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      data-testid={`document-reject-reason-${document.id}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void approveDocument(document.id)}
                        disabled={isRunning || document.status === "APPROVED"}
                        loading={saving === document.id && isRunning}
                        data-testid={`admin-approve-document-${document.id}`}
                      >
                        Approve document
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void rejectDocument(document.id)}
                        disabled={isRunning || document.status === "REJECTED"}
                        loading={saving === document.id && isRunning}
                        data-testid={`admin-reject-document-${document.id}`}
                      >
                        Reject document
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No documents uploaded.</p>
          )}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <h3 className="text-lg font-bold text-[var(--foreground)]">Seller approval</h3>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="w-full space-y-2 text-sm font-semibold text-[var(--foreground)]">
            <span>Reject reason</span>
            <input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              data-testid="admin-reject-seller-reason"
            />
          </label>
          <Button
            variant="primary"
            onClick={() => void approveSeller()}
            disabled={isRunning || seller?.sellerApprovalStatus === "APPROVED"}
            loading={saving === "seller" && isRunning}
            data-testid="admin-approve-seller"
          >
            Approve seller
          </Button>
          <Button
            variant="danger"
            onClick={() => void rejectSeller()}
            disabled={isRunning || seller?.sellerApprovalStatus === "REJECTED"}
            loading={saving === "seller" && isRunning}
            data-testid="admin-reject-seller"
          >
            Reject seller
          </Button>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <h3 className="text-lg font-bold text-[var(--foreground)]">Audit log</h3>
        <div className="mt-4 space-y-3">
          {auditLogs.length ? (
            auditLogs.map((log) => (
              <article key={log.id} className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3" data-testid="admin-audit-row">
                <p className="text-sm font-semibold text-[var(--foreground)]">{log.action}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{new Date(log.createdAt).toLocaleString()}</p>
                {log.reason ? <p className="mt-2 text-sm text-[var(--muted)]">{log.reason}</p> : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No audit events for this seller yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]">{value || "Not provided"}</p>
    </div>
  );
}
