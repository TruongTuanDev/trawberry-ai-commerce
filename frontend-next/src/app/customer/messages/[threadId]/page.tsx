import { CustomerMessageThreadDetailPageClient } from "@/components/customer/customer-message-thread-detail-page-client";

export default async function CustomerMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <CustomerMessageThreadDetailPageClient threadId={threadId} />;
}
