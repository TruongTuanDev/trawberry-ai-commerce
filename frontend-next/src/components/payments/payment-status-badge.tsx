const toneByPaymentStatus: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  UNPAID: "bg-orange-50 text-orange-700",
  PAID: "bg-emerald-50 text-emerald-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  FAILED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-700",
};

export function PaymentStatusBadge({
  status,
  testId,
}: {
  status: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByPaymentStatus[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
