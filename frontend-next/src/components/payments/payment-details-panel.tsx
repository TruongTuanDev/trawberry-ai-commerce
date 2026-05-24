"use client";

import { useState } from "react";
import type { PaymentDetails } from "@/lib/seller-api";

export function PaymentDetailsPanel({
  details,
  title = "Payment instructions",
  className = "",
}: {
  details: PaymentDetails;
  title?: string;
  className?: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div className={`rounded-[1.5rem] border border-[var(--border)] bg-white p-5 ${className}`.trim()}>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
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
              alt="Seller payment QR"
              className="h-56 w-56 max-w-full rounded-[1rem] object-contain"
            />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] group-hover:text-[var(--accent-strong)]">
              Tap to enlarge
            </p>
          </button>
        </div>
      ) : null}
        <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
          <InfoLine label="Mode" value={details.mode ?? "STATIC_QR"} />
          <InfoLine label="Bank" value={details.bankName ?? "Not provided"} />
          <InfoLine label="Recipient" value={details.recipientName ?? "Not provided"} />
          <InfoLine label="Recipient phone" value={details.recipientPhone ?? "Not provided"} />
          <InfoLine label="SBP phone" value={details.sbpPhone ?? "Not provided"} />
          <InfoLine label="Account" value={details.recipientAccount ?? "Not provided"} />
        </div>
        <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          {details.paymentInstruction ?? "This shop did not provide extra payment instructions."}
        </div>
      </div>
      {previewOpen && details.staticQrImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6" data-testid="payment-qr-preview-modal">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">QR preview</p>
                <h3 className="mt-2 text-lg font-bold text-[var(--foreground)]">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                data-testid="payment-qr-preview-close"
              >
                Close
              </button>
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={details.staticQrImageUrl}
                alt="Seller payment QR enlarged"
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
