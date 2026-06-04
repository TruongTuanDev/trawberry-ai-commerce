import { SellerMessageThreadDetailPageClient } from "@/components/seller/seller-message-thread-detail-page-client";

export default async function SellerMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <SellerMessageThreadDetailPageClient threadId={threadId} />;
}
