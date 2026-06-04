import { apiRequest } from "@/lib/api";
import type { PaymentDetails } from "@/lib/seller-api";

export type CheckoutPaymentMethod =
  | "PREPAID_SELLER_QR"
  | "PAY_ON_DELIVERY_SELLER_QR"
  | "DEPOSIT_THEN_DELIVERY_PAYMENT"
  | "YANDEX_CARD_ON_DELIVERY"
  | "CASH_COURIER_COLLECTION";

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
  aiTryOn: {
    enabled: boolean;
  };
};

export type RecommendationPlacement = "home" | "product_detail" | "cart" | "search";

export type VisualSearchEventType = "impression" | "click";

export type RecommendationProductsResponse = {
  algorithm: string;
  items: PublicProduct[];
};

export type VisualSearchResponse = {
  analysis: {
    category: string | null;
    color: string | null;
    gender: string | null;
    keywords: string[];
  };
  products: PublicProduct[];
  algorithm: string;
  visualSearchLogId?: string | null;
  disabled?: boolean;
};

export type AiTryOnBuiltInModel = {
  modelId: string;
  gender: "male" | "female" | "other";
  bodyType: string;
  heightCm: number;
  weightKg: number;
  imageUrl: string;
  labelRu: string;
  labelEn: string;
};

export type PublicAiTryOnConfig = {
  enabled: boolean;
  providerMode: "mock" | "demo" | "openai";
  guestDailyLimit: number;
  customerDailyLimit: number;
  requireConsent: boolean;
  supportedCategories: string[];
};

export type CreateAiTryOnTaskPayload = {
  selectedSize: string;
  selectedRussianSize?: string;
  heightCm?: number;
  weightKg?: number;
  gender?: "male" | "female" | "other";
  bodyType?: "slim" | "regular" | "large";
  bodyTraits?: string[];
  customerImageUrl?: string;
  customerImageStorageKey?: string;
  selectedModelId?: string;
  consentAccepted?: boolean;
};

export type AiTryOnTask = {
  id: string;
  customerId: string | null;
  guestSessionId: string | null;
  shopId: string;
  productId: string;
  selectedSize: string | null;
  selectedRussianSize: string | null;
  providerMode: "mock" | "demo" | "openai";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorCode: string | null;
  errorMessage: string | null;
  resultImageUrl: string | null;
  resultImage: {
    url: string;
    storageKey: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
  } | null;
  sizeRecommendation: {
    recommendedSize: string | null;
    recommendedRussianSize: string | null;
    note: string | null;
    noteRu: string | null;
    noteEn: string | null;
    confidence: "low" | "medium" | "high" | null;
  };
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type UploadAiTryOnReferenceResponse = {
  url: string;
  storageKey: string;
  mimeType: string;
  size: number;
};

export type PublicProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  fitFeedback: string | null;
  status: string;
  sellerReply: string | null;
  sellerRepliedAt: string | null;
  createdAt: string;
  verifiedPurchase: boolean;
  customerName: string;
  orderCode: string | null;
  images: Array<{
    id: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    createdAt: string;
  }>;
};

export type PublicProductReviewsResponse = {
  items: PublicProductReview[];
  summary: {
    averageRating: string | null;
    ratingCount: number;
    countsByRating: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PublicShopProfile = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  approvedAt: string | null;
  productCount: number;
  ratingAverage: string | null;
  ratingCount: number;
  joinedAt: string | null;
  locationLabel: string | null;
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
    latitude?: number;
    longitude?: number;
  };
  addressId?: string;
  paymentMethod: CheckoutPaymentMethod;
};

export type CheckoutOrderResponse = {
  checkoutId: string;
  checkoutCode: string;
  orderId: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
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
    paymentMethod: string | null;
    paymentMethodLabel: string | null;
    totalAmount: string;
    paymentInstructions: string | null;
    paymentDetails: PaymentDetails;
    trackingPath: string;
    itemsCount: number;
    addressGeoReadiness: {
      hasStructuredAddress: boolean;
      hasCoordinates: boolean;
      geoPrecision: string | null;
      isYandexManualReady: boolean;
      isYandexApiReady: boolean;
      missingFields: string[];
    };
    addressWarnings: string[];
  }>;
  orderCodes: string[];
  grandTotal: string;
  addressGeoReadiness: {
    hasStructuredAddress: boolean;
    hasCoordinates: boolean;
    geoPrecision: string | null;
    isYandexManualReady: boolean;
    isYandexApiReady: boolean;
    missingFields: string[];
  };
  addressWarnings: string[];
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
  paymentMethodLabel: string | null;
  paymentInstructions: string | null;
  paymentDetails: PaymentDetails;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
    addressFullName?: string | null;
    city?: string | null;
    street?: string | null;
    building?: string | null;
    entrance?: string | null;
    noEntrance?: boolean;
    intercom?: string | null;
    floor?: string | null;
    noFloor?: boolean;
    apartment?: string | null;
    noApartment?: boolean;
    geoPrecision?: string | null;
    deliveryComment?: string | null;
    geoReadiness?: {
      hasStructuredAddress: boolean;
      hasCoordinates: boolean;
      geoPrecision: string | null;
      isYandexManualReady: boolean;
      isYandexApiReady: boolean;
      missingFields: string[];
    };
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
    courierName: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: string | null;
    packagePreset: string | null;
    packageWeightGram: number | null;
    packageLengthCm: number | null;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    pickupAddress: string | null;
    pickupAddressFullName?: string | null;
    pickupLatitude: string | null;
    pickupLongitude: string | null;
    dropoffAddressFullName?: string | null;
    dropoffCity?: string | null;
    dropoffStreet?: string | null;
    dropoffBuilding?: string | null;
    dropoffEntrance?: string | null;
    dropoffNoEntrance?: boolean;
    dropoffIntercom?: string | null;
    dropoffFloor?: string | null;
    dropoffNoFloor?: boolean;
    dropoffApartment?: string | null;
    dropoffNoApartment?: boolean;
    dropoffGeoPrecision?: string | null;
    dropoffComment?: string | null;
    dropoffLatitude: string | null;
    dropoffLongitude: string | null;
    dropoffGeoReadiness?: {
      hasStructuredAddress: boolean;
      hasCoordinates: boolean;
      geoPrecision: string | null;
      isYandexManualReady: boolean;
      isYandexApiReady: boolean;
      missingFields: string[];
    };
    recipientName: string | null;
    recipientPhone: string | null;
    manualYandexOrderId: string | null;
    yandexClaimId: string | null;
    yandexStatus: string | null;
    yandexPrice: string | null;
    yandexTrackingLink: string | null;
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

export type CreateVisualSearchPayload = {
  image: File;
  categoryHint?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  guestSessionId?: string;
};

export async function getPublicProducts(query?: {
  search?: string;
  q?: string;
  categoryId?: string;
  categorySlug?: string;
  shopSlug?: string;
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
  if (query?.shopSlug) params.set("shopSlug", query.shopSlug);
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

export async function getPublicShopProfile(shopSlug: string) {
  return apiRequest<{ shop: PublicShopProfile }>(`/api/public/shops/${shopSlug}`, {
    method: "GET",
  });
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

export async function getHomeRecommendations(limit = 12) {
  return apiRequest<RecommendationProductsResponse>(
    `/api/public/recommendations/home?limit=${limit}`,
    {
      method: "GET",
    },
  );
}

export async function getSimilarProductRecommendations(
  productId: string,
  limit = 12,
) {
  return apiRequest<RecommendationProductsResponse>(
    `/api/public/recommendations/products/${productId}/similar?limit=${limit}`,
    {
      method: "GET",
    },
  );
}

type TrackProductViewPayload = {
  productId: string;
  source?: string;
  referrer?: string;
  guestSessionId?: string;
};

type TrackSearchPayload = {
  query: string;
  resultCount?: number;
  locale?: string;
  guestSessionId?: string;
};

type TrackRecommendationEventPayload = {
  type: "impression" | "click";
  placement: RecommendationPlacement;
  productId: string;
  sourceProductId?: string;
  algorithm?: string;
  rank?: number;
  score?: number;
  guestSessionId?: string;
};

type TrackVisualSearchEventPayload = {
  type: VisualSearchEventType;
  visualSearchLogId?: string;
  productId: string;
  rank?: number;
  score?: number;
  guestSessionId?: string;
};

const GUEST_SESSION_STORAGE_KEY = "trawberry_guest_session_id";

function createGuestSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getGuestSessionId() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const existing = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = createGuestSessionId();
  window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, nextValue);
  return nextValue;
}

async function swallowTrackingRequest(path: string, payload: unknown) {
  const guestSessionId = getGuestSessionId();

  try {
    await apiRequest<void>(path, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: guestSessionId
        ? {
            "x-guest-session-id": guestSessionId,
          }
        : undefined,
    });
  } catch {
    return;
  }
}

export async function trackProductView(payload: TrackProductViewPayload) {
  await swallowTrackingRequest("/api/public/tracking/product-view", payload);
}

export async function trackSearch(payload: TrackSearchPayload) {
  await swallowTrackingRequest("/api/public/tracking/search", payload);
}

export async function trackRecommendationEvent(
  payload: TrackRecommendationEventPayload,
) {
  await swallowTrackingRequest("/api/public/recommendations/events", payload);
}

export async function createVisualSearch(payload: CreateVisualSearchPayload) {
  const formData = new FormData();
  formData.append("image", payload.image);
  if (payload.categoryHint?.trim()) {
    formData.append("categoryHint", payload.categoryHint.trim());
  }
  if (payload.cropX !== undefined) {
    formData.append("cropX", String(payload.cropX));
  }
  if (payload.cropY !== undefined) {
    formData.append("cropY", String(payload.cropY));
  }
  if (payload.cropWidth !== undefined) {
    formData.append("cropWidth", String(payload.cropWidth));
  }
  if (payload.cropHeight !== undefined) {
    formData.append("cropHeight", String(payload.cropHeight));
  }

  const guestSessionId = payload.guestSessionId ?? getGuestSessionId();
  return apiRequest<VisualSearchResponse>("/api/public/visual-search", {
    method: "POST",
    body: formData,
    headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
  });
}

export async function trackVisualSearchEvent(
  payload: TrackVisualSearchEventPayload,
) {
  await swallowTrackingRequest("/api/public/visual-search/events", payload);
}

export async function getPublicProductReviews(
  productId: string,
  query?: {
    rating?: number;
    page?: number;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  if (query?.rating) params.set("rating", String(query.rating));
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  return apiRequest<PublicProductReviewsResponse>(
    `/api/public/products/${productId}/reviews${suffix}`,
    {
      method: "GET",
    },
  );
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
  file?: File | null,
  buyerNote?: string,
) {
  const formData = new FormData();
  formData.append("phone", phone);
  if (buyerNote?.trim()) {
    formData.append("buyerNote", buyerNote.trim());
  }
  if (file) {
    formData.append("file", file);
  }

  return apiRequest<PublicTrackedOrder>(
    `/api/public/orders/${orderId}/payment-proof`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export type PublicHomepageSlide = {
  id: string;
  titleRu: string | null;
  titleEn: string | null;
  subtitleRu: string | null;
  subtitleEn: string | null;
  ctaLabelRu: string | null;
  ctaLabelEn: string | null;
  ctaUrl: string | null;
  altTextRu: string | null;
  altTextEn: string | null;
  imageDesktopUrl: string;
  imageMobileUrl: string | null;
  backgroundColor: string | null;
  displayOrder: number;
};

export async function getPublicHomepageSlides() {
  return apiRequest<PublicHomepageSlide[]>("/api/public/homepage-slides", {
    method: "GET",
  });
}

export async function getPublicAiTryOnConfig() {
  return apiRequest<PublicAiTryOnConfig>("/api/public/ai-try-on/config", {
    method: "GET",
  });
}

export async function uploadAiTryOnReference(
  file: File,
  guestSessionId?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<UploadAiTryOnReferenceResponse>("/api/public/ai-try-on/uploads", {
    method: "POST",
    body: formData,
    headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
  });
}

export async function createAiTryOnTask(
  productId: string,
  payload: CreateAiTryOnTaskPayload,
  guestSessionId?: string,
) {
  return apiRequest<AiTryOnTask>(`/api/public/products/${productId}/try-on/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
  });
}

export async function getAiTryOnTask(taskId: string, guestSessionId?: string) {
  return apiRequest<AiTryOnTask>(`/api/public/ai-try-on/tasks/${taskId}`, {
    method: "GET",
    headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
  });
}

export async function getPublicAiTryOnModels() {
  return apiRequest<AiTryOnBuiltInModel[]>("/api/public/ai-try-on/models", {
    method: "GET",
  });
}
