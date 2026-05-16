import { Suspense } from "react";
import { ReceiptPageClient } from "@/components/customer/receipt-page-client";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ checkoutCode: string }>;
}) {
  const { checkoutCode } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--muted)]">Loading receipt...</div>}>
      <ReceiptPageClient checkoutCode={checkoutCode} />
    </Suspense>
  );
}
