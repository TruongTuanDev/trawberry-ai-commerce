import { apiRequest } from "@/lib/api";

export type CustomerCheckoutReceipt = {
  checkoutId: string;
  checkoutCode: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  grandTotal: string;
  createdAt: string;
  updatedAt: string;
  orderCodes: string[];
  supportCases: Array<{
    id: string;
    issueType: string;
    status: string;
    subject: string;
    orderId: string | null;
    createdAt: string;
  }>;
  orders: Array<{
    orderId: string;
    orderCode: string;
    shopId: string;
    shopName: string;
    status: string;
    paymentStatus: string;
    totalAmount: string;
    paymentInstructions: string | null;
    trackingPath: string;
    deliveryStatus: string | null;
    itemsCount: number;
    items: Array<{
      id: string;
      productId: string | null;
      variantId: string | null;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
      productTitleSnapshot: string;
      productImageSnapshot: string | null;
      variantNameSnapshot: string | null;
    }>;
  }>;
};

export type CustomerSupportCase = {
  id: string;
  checkoutId: string;
  checkoutCode: string;
  orderId: string | null;
  shopId: string | null;
  shopName: string | null;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  issueType: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  order: {
    id: string;
    orderCode: string;
    status: string;
    paymentStatus: string;
  } | null;
  messages: Array<{
    id: string;
    senderUserId: string | null;
    senderRole: string;
    senderName: string | null;
    message: string;
    isInternal: boolean;
    createdAt: string;
  }>;
};

export async function getCustomerOrderHistory() {
  return apiRequest<{ items: CustomerCheckoutReceipt[] }>("/api/customer/orders", {
    method: "GET",
  });
}

export async function getCustomerOrderReceipt(checkoutCode: string) {
  return apiRequest<CustomerCheckoutReceipt>(
    `/api/customer/orders/${encodeURIComponent(checkoutCode)}`,
    {
      method: "GET",
    },
  );
}

export async function getPublicCheckoutReceipt(checkoutCode: string, phone: string) {
  const params = new URLSearchParams({ phone });
  return apiRequest<CustomerCheckoutReceipt>(
    `/api/public/checkouts/${encodeURIComponent(checkoutCode)}?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function createCustomerSupportCase(
  checkoutCode: string,
  body: {
    orderId?: string;
    issueType: string;
    subject: string;
    description: string;
  },
) {
  return apiRequest<CustomerSupportCase>(
    `/api/customer/checkouts/${encodeURIComponent(checkoutCode)}/support-cases`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function listCustomerSupportCases() {
  return apiRequest<{ items: CustomerSupportCase[] }>("/api/customer/support-cases", {
    method: "GET",
  });
}

export async function getCustomerSupportCase(caseId: string) {
  return apiRequest<CustomerSupportCase>(`/api/customer/support-cases/${encodeURIComponent(caseId)}`, {
    method: "GET",
  });
}

export async function addCustomerSupportCaseMessage(caseId: string, message: string) {
  return apiRequest<CustomerSupportCase>(`/api/customer/support-cases/${encodeURIComponent(caseId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
