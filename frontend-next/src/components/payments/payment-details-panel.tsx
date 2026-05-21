"use client";

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
  return (
    <div className={`rounded-[1.5rem] border border-[var(--border)] bg-white p-5 ${className}`.trim()}>
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {details.staticQrImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={details.staticQrImageUrl}
          alt="Seller payment QR"
          className="mt-4 h-56 w-56 max-w-full rounded-[1.25rem] border border-[var(--border)] object-contain"
        />
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
