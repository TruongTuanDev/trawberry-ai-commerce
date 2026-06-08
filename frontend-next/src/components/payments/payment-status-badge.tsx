"use client";

import { translate } from "@/i18n/translate";
import { useLocaleStore } from "@/i18n/locale-store";

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
  displayText,
}: {
  status: string;
  testId?: string;
  displayText?: string;
}) {
  const { cookieLocale, roleLocales } = useLocaleStore();
  const locale = cookieLocale ?? roleLocales.seller ?? "ru";

  return (
    <span
      data-testid={testId}
      data-status={status}
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByPaymentStatus[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {displayText ?? translate(locale, `common.status.payment.${status}`)}
    </span>
  );
}
