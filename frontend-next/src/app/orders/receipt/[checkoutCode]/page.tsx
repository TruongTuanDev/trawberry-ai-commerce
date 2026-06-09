import { Suspense } from "react";
import { ReceiptPageClient } from "@/components/customer/receipt-page-client";
import { getRoleDefaultLocale } from "@/i18n/config";
import { translate } from "@/i18n/translate";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ checkoutCode: string }>;
}) {
  const { checkoutCode } = await params;
  const fallbackLocale = getRoleDefaultLocale("customer");

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--muted)]">
          {translate(fallbackLocale, "checkout.receipt")}
        </div>
      }
    >
      <ReceiptPageClient checkoutCode={checkoutCode} />
    </Suspense>
  );
}
