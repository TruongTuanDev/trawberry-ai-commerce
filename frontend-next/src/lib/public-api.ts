import { apiRequest } from "@/lib/api";

export type PublicProduct = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  brand: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  price: string | null;
  images: Array<{
    id: string;
    url: string;
    isMain: boolean;
  }>;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

export type PaginatedPublicProducts = {
  items: PublicProduct[];
  meta: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
};

export type CheckoutOrderPayload = {
  shopId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    address: string;
    note?: string;
  };
  paymentMethod: "MANUAL_TRANSFER" | "CASH_ON_DELIVERY";
};

export type CheckoutOrderResponse = {
  orderId: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paymentInstructions: string | null;
};

export async function getPublicProducts(query?: { search?: string; page?: number; size?: number }) {
  const params = new URLSearchParams();
  if (query?.search) params.set("search", query.search);
  if (query?.page) params.set("page", String(query.page));
  if (query?.size) params.set("size", String(query.size));

  const qs = params.toString();
  return apiRequest<PaginatedPublicProducts>(`/api/public/products${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export async function getPublicProduct(productId: string) {
  return apiRequest<PublicProduct>(`/api/public/products/${productId}`, {
    method: "GET",
  });
}

export async function createCheckoutOrder(payload: CheckoutOrderPayload) {
  return apiRequest<CheckoutOrderResponse>("/api/checkout/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
