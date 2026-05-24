"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import type { LocaleRole } from "@/i18n/config";
import type { PaymentDetails } from "@/lib/seller-api";

export function PaymentDetailsPanel({
  details,
  title,
  className = "",
  role = "seller",
}: {
  details: PaymentDetails;
  title?: string;
  className?: string;
  role?: LocaleRole;
}) {
  const { t } = useI18n(role);
  const [previewOpen, setPreviewOpen] = useState(false);
  const resolvedTitle = title ?? t("seller.paymentDetail.instructionsTitle");

  return (
    <>
      <div className={`rounded-[1.5rem] border border-[var(--border)] bg-white p-5 ${className}`.trim()}>
        <p className="text-sm font-semibold text-[var(--foreground)]">{resolvedTitle}</p>
        {details.staticQrImageUrl ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group block rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-2 text-left transition hover:border-[var(--accent)]"
              data-testid="payment-qr-preview-trigger"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={details.staticQrImageUrl}
                alt={t("seller.paymentDetail.qrAlt")}
                className="h-56 w-56 max-w-full rounded-[1rem] object-contain"
              />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] group-hover:text-[var(--accent-strong)]">
                {t("common.copy.tapToEnlarge")}
              </p>
            </button>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
          <InfoLine label={t("seller.paymentDetail.mode")} value={details.mode ?? "STATIC_QR"} />
          <InfoLine label={t("seller.paymentDetail.bank")} value={details.bankName ?? t("common.notProvided")} />
          <InfoLine label={t("seller.paymentDetail.recipient")} value={details.recipientName ?? t("common.notProvided")} />
          <InfoLine label={t("seller.paymentDetail.recipientPhone")} value={details.recipientPhone ?? t("common.notProvided")} />
          <InfoLine label={t("seller.paymentDetail.sbpPhone")} value={details.sbpPhone ?? t("common.notProvided")} />
          <InfoLine label={t("seller.paymentDetail.account")} value={details.recipientAccount ?? t("common.notProvided")} />
        </div>
        <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          {details.paymentInstruction ?? t("seller.paymentDetail.noInstruction")}
        </div>
      </div>
      {previewOpen && details.staticQrImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6" data-testid="payment-qr-preview-modal">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{t("seller.paymentDetail.qrPreview")}</p>
                <h3 className="mt-2 text-lg font-bold text-[var(--foreground)]">{resolvedTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                data-testid="payment-qr-preview-close"
              >
                {t("common.close")}
              </button>
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={details.staticQrImageUrl}
                alt={t("seller.paymentDetail.qrPreviewAlt")}
                className="max-h-[75vh] w-full rounded-[1.25rem] object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 break-words font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
