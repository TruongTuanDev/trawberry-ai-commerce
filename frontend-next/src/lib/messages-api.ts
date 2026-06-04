import { apiRequest } from "@/lib/api";

export type MessageThreadSummary = {
  id: string;
  status: string;
  subject: string | null;
  lastMessageAt: string;
  reportedAt: string | null;
  reportedReason: string | null;
  unread: boolean;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  order: {
    id: string;
    orderCode: string;
    status: string;
    paymentStatus: string;
  } | null;
  customer: {
    id: string;
    fullName: string;
  };
  seller: {
    id: string;
    fullName: string;
  };
  latestMessage: {
    id: string;
    senderRole: string;
    message: string;
    createdAt: string;
  } | null;
};

export type MessageThreadDetail = MessageThreadSummary & {
  canReply: boolean;
  canReport: boolean;
  canClose: boolean;
  messages: Array<{
    id: string;
    senderRole: string;
    senderName: string;
    message: string;
    createdAt: string;
  }>;
};

export async function createCustomerMessageThread(body: {
  shopId?: string;
  shopSlug?: string;
  productId?: string;
  orderId?: string;
  subject?: string;
  message: string;
}) {
  return apiRequest<MessageThreadDetail>("/api/customer/messages/threads", {
    method: "POST",
    authRole: "customer",
    body: JSON.stringify(body),
  });
}

export async function listCustomerMessageThreads(query?: {
  status?: string;
  filter?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.filter) params.set("filter", query.filter);
  if (query?.q) params.set("q", query.q);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<{ items: MessageThreadSummary[] }>(`/api/customer/messages/threads${suffix}`, {
    method: "GET",
    authRole: "customer",
  });
}

export async function getCustomerMessageThread(threadId: string) {
  return apiRequest<MessageThreadDetail>(`/api/customer/messages/threads/${threadId}`, {
    method: "GET",
    authRole: "customer",
  });
}

export async function sendCustomerMessage(threadId: string, message: string) {
  return apiRequest<MessageThreadDetail>(`/api/customer/messages/threads/${threadId}/messages`, {
    method: "POST",
    authRole: "customer",
    body: JSON.stringify({ message }),
  });
}

export async function markCustomerThreadRead(threadId: string) {
  return apiRequest<{ success: boolean }>(`/api/customer/messages/threads/${threadId}/read`, {
    method: "PATCH",
    authRole: "customer",
  });
}

export async function reportCustomerThread(threadId: string, reason?: string) {
  return apiRequest<MessageThreadDetail>(`/api/customer/messages/threads/${threadId}/report`, {
    method: "PATCH",
    authRole: "customer",
    body: JSON.stringify({ reason }),
  });
}

export async function listSellerMessageThreads(
  shopId: string,
  query?: { status?: string; filter?: string; q?: string },
) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.filter) params.set("filter", query.filter);
  if (query?.q) params.set("q", query.q);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<{ items: MessageThreadSummary[] }>(`/api/shops/${shopId}/messages/threads${suffix}`, {
    method: "GET",
    authRole: "seller",
  });
}

export async function getSellerMessageThread(shopId: string, threadId: string) {
  return apiRequest<MessageThreadDetail>(`/api/shops/${shopId}/messages/threads/${threadId}`, {
    method: "GET",
    authRole: "seller",
  });
}

export async function sendSellerMessage(shopId: string, threadId: string, message: string) {
  return apiRequest<MessageThreadDetail>(`/api/shops/${shopId}/messages/threads/${threadId}/messages`, {
    method: "POST",
    authRole: "seller",
    body: JSON.stringify({ message }),
  });
}

export async function markSellerThreadRead(shopId: string, threadId: string) {
  return apiRequest<{ success: boolean }>(`/api/shops/${shopId}/messages/threads/${threadId}/read`, {
    method: "PATCH",
    authRole: "seller",
  });
}

export async function closeSellerMessageThread(shopId: string, threadId: string) {
  return apiRequest<MessageThreadDetail>(`/api/shops/${shopId}/messages/threads/${threadId}/close`, {
    method: "PATCH",
    authRole: "seller",
  });
}

export async function listAdminMessageThreads(query?: { status?: string }) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<{ items: MessageThreadSummary[] }>(`/api/admin/messages/threads${suffix}`, {
    method: "GET",
    authRole: "admin",
  });
}

export async function getAdminMessageThread(threadId: string) {
  return apiRequest<MessageThreadDetail>(`/api/admin/messages/threads/${threadId}`, {
    method: "GET",
    authRole: "admin",
  });
}

export async function closeAdminMessageThread(threadId: string) {
  return apiRequest<MessageThreadDetail>(`/api/admin/messages/threads/${threadId}/close`, {
    method: "PATCH",
    authRole: "admin",
  });
}

export async function reopenAdminMessageThread(threadId: string) {
  return apiRequest<MessageThreadDetail>(`/api/admin/messages/threads/${threadId}/reopen`, {
    method: "PATCH",
    authRole: "admin",
  });
}
