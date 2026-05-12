const toneByStatus: Record<string, string> = {
  NEW: "bg-amber-50 text-amber-700",
  ASSEMBLING: "bg-sky-50 text-sky-700",
  SHIPPING: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByStatus[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
