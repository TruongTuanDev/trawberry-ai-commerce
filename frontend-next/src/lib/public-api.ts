import { apiRequest } from "@/lib/api";
import type { PaymentDetails } from "@/lib/seller-api";

export type PublicProduct = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  brand: string | null;
  color: string | null;
  gender: string | null;
  composition: string | null;
  sellerSku: string | null;
  seoSlug: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  price: string | null;
  oldPrice: string | null;
  inStock: boolean;
  availableQuantity: number;
  averageRating: string | null;
  feedbackCount: number;
  images: Array<{
    id: string;
    url: string;
    isMain: boolean;
  }>;
  variants: Array<{
    id: string;
    sizeName: string | null;
    russianSize: string | null;
    techSize: string | null;
    wbSize: string | null;
    sellerSku: string | null;
    price: string | null;
    originalPrice: string | null;
    stockQuantity: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    inStock: boolean;
    availableQuantity: number;
  }>;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    paymentInstructions: string | null;
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
  filters?: {
    categories: Array<{
      id: string;
      name: string;
      slug: string | null;
      count: number;
    }>;
    brands: Array<{ value: string; count: number }>;
    colors: Array<{ value: string; count: number }>;
    genders: Array<{ value: string; count: number }>;
    priceMin: string | null;
    priceMax: string | null;
  };
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children: PublicCategory[];
};

export type CheckoutOrderPayload = {
  shopId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    address: string;
    note?: string;
  };
  addressId?: string;
  paymentMethod: "MANUAL_TRANSFER" | "CASH_ON_DELIVERY";
};

export type CheckoutOrderResponse = {
  checkoutId: string;
  checkoutCode: string;
  orderId: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paymentInstructions: string | null;
  paymentDetails: PaymentDetails;
  trackingPath: string;
  customerPhone: string;
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
    itemsCount: number;
  }>;
  orderCodes: string[];
  grandTotal: string;
};

export type CartValidationStatus =
  | "OK"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_NOT_PUBLIC"
  | "PRODUCT_ARCHIVED"
  | "VARIANT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "QUANTITY_EXCEEDS_STOCK"
  | "MISSING_PRICE"
  | "PRICE_CHANGED";

export type ValidatePublicCartPayload = {
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    clientUnitPrice?: number;
  }>;
};

export type PublicCartValidationResponse = {
  valid: boolean;
  items: Array<{
    productId: string;
    variantId: string | null;
    requestedQuantity: number;
    available: boolean;
    status: CartValidationStatus;
    productName: string | null;
    variantName: string | null;
    imageUrl: string | null;
    unitPrice: number | null;
    currentStock: number;
    maxQuantity: number;
    trackInventory: boolean;
    lineTotal: number;
    shopId: string | null;
    shopName: string | null;
  }>;
  summary: {
    subtotal: number;
    invalidCount: number;
    changedCount: number;
  };
};

export type PublicTrackedOrder = {
  orderId: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  paymentDetails: PaymentDetails;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
  };
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    quantity: number;
    priceAtPurchase: string;
    unitPrice: string;
    lineTotal: string;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
    variantNameSnapshot: string | null;
  }>;
  paymentProof: {
    url: string;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
    uploadedAt: string | null;
  } | null;
  paymentProofStatus: string;
  buyerPaymentNote: string | null;
  paymentLogs: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    reviewerName: string | null;
    createdAt: string;
  }>;
  delivery: {
    provider: string;
    status: string;
    statusLabel: string;
    statusMessage: string;
    internalStatus: string;
    providerStatus: string;
    providerShipmentId: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: string | null;
    deliveryNote: string | null;
    failureReasonCode: string | null;
    customerVisibleMessage: string | null;
    deliveryComments: Array<{
      id: string;
      message: string;
      createdAt: string;
    }>;
  } | null;
};

export async function getPublicProducts(query?: {
  search?: string;
  q?: string;
  categoryId?: string;
  categorySlug?: string;
  brand?: string;
  color?: string;
  gender?: string;
  inStock?: boolean;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: number;
  size?: number;
}) {
  const params = new URLSearchParams();
  if (query?.search) params.set("search", query.search);
  if (query?.q) params.set("q", query.q);
  if (query?.categoryId) params.set("categoryId", query.categoryId);
  if (query?.categorySlug) params.set("categorySlug", query.categorySlug);
  if (query?.brand) params.set("brand", query.brand);
  if (query?.color) params.set("color", query.color);
  if (query?.gender) params.set("gender", query.gender);
  if (query?.inStock !== undefined)
    params.set("inStock", String(query.inStock));
  if (query?.minPrice) params.set("minPrice", query.minPrice);
  if (query?.maxPrice) params.set("maxPrice", query.maxPrice);
  if (query?.sort) params.set("sort", query.sort);
  if (query?.page) params.set("page", String(query.page));
  if (query?.size) params.set("size", String(query.size));

  const qs = params.toString();
  return apiRequest<PaginatedPublicProducts>(
    `/api/public/products${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
    },
  );
}

export async function getCategories() {
  return apiRequest<PublicCategory[]>("/api/categories", {
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

export async function validatePublicCart(payload: ValidatePublicCartPayload) {
  return apiRequest<PublicCartValidationResponse>("/api/public/cart/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function trackOrderByCode(orderCode: string, phone: string) {
  const params = new URLSearchParams({
    orderCode,
    phone,
  });

  return apiRequest<PublicTrackedOrder>(
    `/api/public/orders/track?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function trackOrderById(orderId: string, phone: string) {
  const params = new URLSearchParams({
    phone,
  });

  return apiRequest<PublicTrackedOrder>(
    `/api/public/orders/${orderId}/track?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function uploadPaymentProof(
  orderId: string,
  phone: string,
  file: File,
  buyerNote?: string,
) {
  const formData = new FormData();
  formData.append("phone", phone);
  if (buyerNote?.trim()) {
    formData.append("buyerNote", buyerNote.trim());
  }
  formData.append("file", file);

  return apiRequest<PublicTrackedOrder>(
    `/api/public/orders/${orderId}/payment-proof`,
    {
      method: "POST",
      body: formData,
    },
  );
}
