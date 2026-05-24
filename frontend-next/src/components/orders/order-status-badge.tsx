"use client";

import { translate } from "@/i18n/use-i18n";
import { useLocaleStore } from "@/i18n/locale-store";

const toneByStatus: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  NEW: "bg-amber-50 text-amber-700",
  READY_TO_CREATE_YANDEX: "bg-sky-50 text-sky-700",
  YANDEX_MANUAL_CREATED: "bg-sky-50 text-sky-700",
  ASSEMBLING: "bg-sky-50 text-sky-700",
  SHIPPING: "bg-violet-50 text-violet-700",
  IN_TRANSIT: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-700",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const { cookieLocale, roleLocales } = useLocaleStore();
  const locale = cookieLocale ?? roleLocales.seller ?? "ru";

  return (
    <span
      data-status={status}
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByStatus[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {translate(locale, `common.status.order.${status}`)}
    </span>
  );
}
