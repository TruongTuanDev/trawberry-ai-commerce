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
  role,
}: {
  status: string;
  testId?: string;
  role?: string;
}) {
  const { roleLocales, cookieLocale } = useLocaleStore();

  let locale = cookieLocale;
  if (role === "seller") {
    locale = roleLocales.seller;
  } else if (role === "admin") {
    locale = roleLocales.admin;
  } else if (role === "customer") {
    locale = roleLocales.customer;
  } else if (typeof window !== "undefined" && window.location.pathname.startsWith("/seller")) {
    locale = roleLocales.seller;
  } else if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    locale = roleLocales.admin;
  }

  locale = locale ?? "ru";

  return (
    <span
      data-testid={testId}
      data-status={status}
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByPaymentStatus[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {translate(locale, `common.status.payment.${status}`)}
    </span>
  );
}
