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
