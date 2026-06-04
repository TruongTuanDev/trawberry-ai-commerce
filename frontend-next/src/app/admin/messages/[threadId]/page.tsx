import { AdminMessageThreadDetailPageClient } from "@/components/admin/admin-message-thread-detail-page-client";

export default async function AdminMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <AdminMessageThreadDetailPageClient threadId={threadId} />;
}
