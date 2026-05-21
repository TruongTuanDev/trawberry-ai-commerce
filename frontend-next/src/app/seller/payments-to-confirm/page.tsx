import { SellerPaymentsPageClient } from "@/components/payments/seller-payments-page-client";

export default function SellerPaymentsToConfirmPage() {
  return (
    <SellerPaymentsPageClient
      initialProofStatus="BUYER_MARKED_PAID"
      title="Payments to confirm"
      description="Focus on buyer-marked transfers that still need seller confirmation."
    />
  );
}
