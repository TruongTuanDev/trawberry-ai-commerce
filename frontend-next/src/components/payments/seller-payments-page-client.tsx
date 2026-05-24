"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import {
  confirmPayment,
  listPayments,
  rejectPayment,
  type SellerPaymentItem,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const proofTabs = [
  { value: "BUYER_MARKED_PAID", label: "Chờ duyệt" },
  { value: "SELLER_REJECTED", label: "Đã từ chối" },
  { value: "SELLER_CONFIRMED", label: "Đã xác nhận" },
] as const;

function isImageProof(item: SellerPaymentItem) {
  return Boolean(item.paymentProof?.mimeType?.startsWith("image/"));
}

export function SellerPaymentsPageClient({
  initialProofStatus = "BUYER_MARKED_PAID",
  title = "Payment review",
  description = "Chỉ hiển thị các đơn đang chờ người bán duyệt minh chứng thanh toán trước khi đưa sang luồng xử lý đơn.",
}: {
  initialProofStatus?: string;
  title?: string;
  description?: string;
}) {
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [payments, setPayments] = useState<SellerPaymentItem[]>([]);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [proofStatus, setProofStatus] = useState(initialProofStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SellerPaymentItem | null>(null);
  const { run: runAction, isRunning } = useActionFeedback();

  const pendingCount = useMemo(
    () =>
      payments.filter((item) => item.paymentProofStatus === "BUYER_MARKED_PAID")
        .length,
    [payments],
  );

  const load = async () => {
    if (!user || !currentShopId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await listPayments(
        currentShopId,
        {
          page,
          size,
          search: search || undefined,
          proofStatus: proofStatus || undefined,
        },
        "",
      );
      setPayments(response.items);
      setTotalPages(response.meta.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId, page, proofStatus, search, size, user]);

  const handleDecision = async (
    item: SellerPaymentItem,
    action: "confirm" | "reject",
  ) => {
    if (!currentShopId) return;
    await runAction({
      action: async () => {
        if (action === "confirm") {
          await confirmPayment(
            currentShopId,
            item.id,
            { note: "Seller confirmed payment proof from review queue." },
            "",
          );
        } else {
          await rejectPayment(
            currentShopId,
            item.id,
            { note: "Seller rejected payment proof from review queue." },
            "",
          );
        }
      },
      successMessage:
        action === "confirm"
          ? "Đã xác nhận thanh toán và chuyển đơn sang mục Mới."
          : "Đã từ chối minh chứng thanh toán.",
      errorMessage: "Không thể cập nhật trạng thái thanh toán.",
      onSuccess: async () => {
        if (preview?.id === item.id) {
          setPreview(null);
        }
        await load();
      },
    }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <SectionCard eyebrow="Payment review" title={title} description={description}>
        <div className="flex flex-wrap items-center gap-3">
          {proofTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setProofStatus(tab.value);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                proofStatus === tab.value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--muted)]">
            Chờ duyệt trong trang hiện tại: {pendingCount}
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by order, customer, payment method"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
          >
            Tải lại queue
          </button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Queue"
        title="Đơn chờ duyệt minh chứng"
        description="Xác nhận thành công sẽ đưa đơn sang Orders > Mới. Từ chối sẽ giữ đơn ở luồng thanh toán và không đi tiếp sang fulfillment."
      >
        {error ? (
          <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[140px_1fr_1.2fr_120px_170px_120px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>Đơn</div>
            <div>Buyer</div>
            <div>Sản phẩm</div>
            <div>Số tiền</div>
            <div>Gửi proof</div>
            <div>Ảnh</div>
            <div>Hành động</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading payment review queue...</div>
            ) : payments.length ? (
              payments.map((payment) => (
                <article
                  key={payment.id}
                  className="grid gap-4 px-4 py-4 lg:grid-cols-[140px_1fr_1.2fr_120px_170px_120px_220px] lg:px-5"
                  data-testid="seller-payment-review-row"
                >
                  <div>
                    <Link href={`/seller/payments/${payment.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                      {payment.orderNumber}
                    </Link>
                    <div className="mt-2">
                      <PaymentStatusBadge status={payment.paymentStatus} />
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">{payment.customer.name}</p>
                    <p>{payment.customer.phone}</p>
                    <p>{payment.customer.email ?? "No email"}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {payment.items.slice(0, 2).map((item) => (
                      <p key={item.id}>
                        {item.productTitleSnapshot} x {item.quantity}
                      </p>
                    ))}
                    {payment.items.length > 2 ? <p>+{payment.items.length - 2} sản phẩm</p> : null}
                  </div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{payment.totalAmount}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {payment.paymentProof?.uploadedAt
                      ? new Date(payment.paymentProof.uploadedAt).toLocaleString()
                      : "Chưa có"}
                  </div>
                  <div>
                    {payment.paymentProof ? (
                      <button
                        type="button"
                        onClick={() => setPreview(payment)}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-1 transition hover:border-[var(--accent)]"
                        data-testid="seller-payment-proof-preview"
                      >
                        {isImageProof(payment) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={payment.paymentProof.url}
                            alt={payment.paymentProof.originalName ?? payment.orderNumber}
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white text-xs font-semibold text-[var(--foreground)]">
                            PDF
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">Không có</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDecision(payment, "confirm")}
                      disabled={isRunning || payment.paymentProofStatus !== "BUYER_MARKED_PAID"}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRunning ? "Đang lưu..." : "Xác nhận"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision(payment, "reject")}
                      disabled={isRunning || payment.paymentProofStatus !== "BUYER_MARKED_PAID"}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRunning ? "Đang lưu..." : "Từ chối"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Không còn đơn nào trong queue này.</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Proof preview</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{preview.orderNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
            <div className="mt-6">
              {isImageProof(preview) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.paymentProof!.url}
                  alt={preview.paymentProof?.originalName ?? preview.orderNumber}
                  className="max-h-[70vh] w-full rounded-[1.5rem] object-contain"
                />
              ) : (
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
                  Proof này không phải ảnh. Mở file đầy đủ ở tab mới để xem nội dung.
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={preview.paymentProof?.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Mở file gốc
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
