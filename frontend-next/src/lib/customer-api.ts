import { apiRequest } from "@/lib/api";
import type { PaymentDetails } from "@/lib/seller-api";

export type ReturnRefundCaseSummary = {
  id: string;
  type: string;
  reason: string;
  status: string;
  requestedAmount: string;
  approvedAmount: string | null;
  createdAt: string;
};

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
    paymentDetails: PaymentDetails;
    trackingPath: string;
    deliveryStatus: string | null;
    returnRefundCases?: ReturnRefundCaseSummary[];
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

export type CustomerProfile = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
};

export type CustomerAddress = {
  id: string;
  fullName: string;
  phone: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  federalSubject: string | null;
  cityType: string | null;
  district: string | null;
  settlement: string | null;
  street: string;
  building: string;
  streetType: string | null;
  buildingBlock: string | null;
  entrance: string | null;
  intercom: string | null;
  floor: string | null;
  apartment: string | null;
  postalCode: string | null;
  comment: string | null;
  latitude: string | null;
  longitude: string | null;
  geoPrecision: string;
  geoProvider: string;
  geoProviderUri: string | null;
  addressFullName: string | null;
  addressShortName: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddressInput = {
  fullName: string;
  phone: string;
  country?: string;
  countryCode?: string;
  city: string;
  region: string;
  federalSubject?: string;
  cityType?: string;
  district?: string;
  settlement?: string;
  street: string;
  building: string;
  streetType?: string;
  buildingBlock?: string;
  entrance?: string;
  intercom?: string;
  floor?: string;
  apartment?: string;
  postalCode?: string;
  comment?: string;
  latitude?: number | null;
  longitude?: number | null;
  geoPrecision?: string;
  geoProvider?: string;
  geoProviderUri?: string;
};

export type CustomerAddressSuggestion = {
  title: string;
  country: string;
  countryCode: string;
  city: string;
  federalSubject: string | null;
  district: string | null;
  street: string;
  streetType: string | null;
  building: string;
  latitude: number;
  longitude: number;
  geoPrecision: string;
  geoProvider: string;
  geoProviderUri: string | null;
  addressFullName: string;
  addressShortName: string;
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

export type CustomerReturnRefundCase = {
  id: string;
  checkoutId: string | null;
  orderId: string;
  shopId: string;
  sellerId: string;
  customerId: string;
  type: string;
  reason: string;
  status: string;
  requestedAmount: string;
  approvedAmount: string | null;
  productAmount: string;
  deliveryFeeRefundAmount: string;
  platformFeeAdjustmentAmount: string;
  currency: string;
  buyerComment: string;
  sellerComment: string | null;
  adminDecision: string | null;
  sellerResponseDueAt: string | null;
  openedAt: string;
  sellerRespondedAt: string | null;
  adminReviewedAt: string | null;
  refundConfirmedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderCode: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    totalAmount: string;
    shippingCost: string;
  };
  shop: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  seller: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  messages: Array<{
    id: string;
    authorId: string | null;
    authorRole: string;
    visibility: string;
    message: string;
    authorName: string | null;
    createdAt: string;
  }>;
  evidence: Array<{
    id: string;
    uploadedById: string | null;
    uploadedByRole: string;
    fileUrl: string;
    fileType: string;
    label: string | null;
    originalName: string | null;
    createdAt: string;
  }>;
  manualTransfers: Array<{
    id: string;
    amount: string;
    currency: string;
    method: string;
    proofImageUrl: string | null;
    bankReference: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  finance: {
    latestLedgerStatus: string | null;
    latestLedgerCommission: string | null;
    latestAdjustmentId: string | null;
  };
};

export async function getCustomerOrderHistory() {
  return apiRequest<{ items: CustomerCheckoutReceipt[] }>("/api/customer/orders", {
    method: "GET",
  });
}

export async function getCustomerProfile() {
  return apiRequest<CustomerProfile>("/api/customer/profile", {
    method: "GET",
  });
}

export async function updateCustomerProfile(body: {
  name?: string;
  email?: string;
  phone?: string;
}) {
  return apiRequest<CustomerProfile>("/api/customer/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function changeCustomerPassword(body: {
  currentPassword: string;
  newPassword: string;
}) {
  return apiRequest<{ success: boolean }>("/api/customer/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getCustomerAddresses() {
  return apiRequest<{ items: CustomerAddress[] }>("/api/customer/addresses", {
    method: "GET",
  });
}

export async function createCustomerAddress(body: CustomerAddressInput) {
  return apiRequest<CustomerAddress>("/api/customer/addresses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCustomerAddress(addressId: string, body: CustomerAddressInput) {
  return apiRequest<CustomerAddress>(`/api/customer/addresses/${encodeURIComponent(addressId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteCustomerAddress(addressId: string) {
  return apiRequest<{ success: boolean }>(`/api/customer/addresses/${encodeURIComponent(addressId)}`, {
    method: "DELETE",
  });
}

export async function setDefaultCustomerAddress(addressId: string) {
  return apiRequest<CustomerAddress>(`/api/customer/addresses/${encodeURIComponent(addressId)}/default`, {
    method: "POST",
  });
}

export async function getCustomerAddressSuggestions(query: string, city?: string) {
  const params = new URLSearchParams();
  params.set("query", query);
  if (city?.trim()) {
    params.set("city", city.trim());
  }
  return apiRequest<{ items: CustomerAddressSuggestion[] }>(
    `/api/customer/address-suggestions?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function geocodeCustomerAddress(addressId: string) {
  return apiRequest<CustomerAddress>(
    `/api/customer/addresses/${encodeURIComponent(addressId)}/geocode`,
    {
      method: "POST",
    },
  );
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

export async function listCustomerReturnRefundCases() {
  return apiRequest<{ items: CustomerReturnRefundCase[] }>("/api/customer/returns", {
    method: "GET",
  });
}

export async function getCustomerReturnRefundCase(caseId: string) {
  return apiRequest<CustomerReturnRefundCase>(`/api/customer/returns/${encodeURIComponent(caseId)}`, {
    method: "GET",
  });
}

export async function createCustomerReturnRefundCase(
  orderId: string,
  body: {
    type: string;
    reason: string;
    requestedAmount: number;
    buyerComment: string;
  },
) {
  return apiRequest<CustomerReturnRefundCase>(
    `/api/customer/orders/${encodeURIComponent(orderId)}/returns`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function addCustomerReturnRefundMessage(caseId: string, message: string) {
  return apiRequest<CustomerReturnRefundCase>(`/api/customer/returns/${encodeURIComponent(caseId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function uploadCustomerReturnRefundEvidence(caseId: string, payload: { file: File; label?: string }) {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.label?.trim()) {
    formData.append("label", payload.label.trim());
  }
  return apiRequest<CustomerReturnRefundCase>(`/api/customer/returns/${encodeURIComponent(caseId)}/evidence`, {
    method: "POST",
    body: formData,
  });
}

export async function confirmCustomerRefundReceived(caseId: string) {
  return apiRequest<CustomerReturnRefundCase>(`/api/customer/returns/${encodeURIComponent(caseId)}/confirm-refund-received`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelCustomerReturnRefundCase(caseId: string) {
  return apiRequest<CustomerReturnRefundCase>(`/api/customer/returns/${encodeURIComponent(caseId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
