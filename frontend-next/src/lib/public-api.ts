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

export type RecommendationPlacement =
  | "home"
  | "product_detail"
  | "search"
  | "cart"
  | "cart_later_reserved";

export type RecommendationSponsoredScenarioType = "home" | "similar" | "search";

export type RecommendationSponsoredPreset = {
  id:
    | "conservative"
    | "balanced"
    | "aggressive-internal-only"
    | "stock-safe"
    | "search-safe";
  name: string;
  description: string;
  version: string;
  stability: "experimental" | "stable" | "deprecated";
  maxSponsoredBoost: number;
  maxBusinessBoost: number;
  allowedScenarioTypes: RecommendationSponsoredScenarioType[];
  notes: string;
};

export type RecommendationSponsoredPresetCatalog = {
  sponsoredRankingEnabled: boolean;
  activePreset: RecommendationSponsoredPreset | null;
  presets: RecommendationSponsoredPreset[];
};

export type RecommendationSponsoredCampaign = {
  campaignId: string | null;
  sponsorType: "none" | "campaign" | "business_boost" | "hybrid";
  maxBoost: number;
  scenarioType: RecommendationSponsoredScenarioType;
  billingMode: "none" | "cpc" | "cpm" | "fixed";
  rolloutMode: "disabled" | "internal" | "limited" | "public";
};

export type RecommendationCampaignReadiness = {
  sponsoredEligible: boolean;
  sponsoredBoostApplied: boolean;
  sponsoredBoostScore: number;
  sponsoredReason: string | null;
  sponsoredPresetId: RecommendationSponsoredPreset["id"] | null;
  campaignReadinessStatus:
    | "disabled"
    | "not_targeted"
    | "ineligible"
    | "eligible"
    | "boosted";
  billingMode: "none" | "cpc" | "cpm" | "fixed";
  rolloutMode: "disabled" | "internal" | "limited" | "public";
};

export type VisualSearchEventType = "impression" | "click";

export type RecommendationProductItem = {
  product: PublicProduct;
  rank: number;
  score: number | null;
  reasonCodes: string[];
  sponsored?: boolean;
  trackingToken?: string | null;
  scoreExplanation?: {
    algorithm: string;
    finalScore: number | null;
    reasons: string[];
    scoreBreakdown: {
      categoryScore: number;
      textScore: number;
      popularityScore: number;
      freshnessScore: number;
      ratingScore: number;
      stockScore: number;
      shopScore: number;
      penaltyScore: number;
      personalizationScore: number;
      recentViewScore: number;
      categoryAffinityScore: number;
      searchIntentScore: number;
      clickAffinityScore: number;
      sponsoredBoostScore: number;
      businessBoostScore: number;
      maxSponsoredBoost: number;
    } | null;
    sponsoredReason?: string | null;
    sponsoredPreset?: RecommendationSponsoredPreset | null;
    campaignReadiness?: RecommendationCampaignReadiness | null;
    sponsoredCampaign?: RecommendationSponsoredCampaign | null;
  };
};

export type RecommendationProductsResponse = {
  algorithm: string;
  placement: RecommendationPlacement;
  items: RecommendationProductItem[];
  products: PublicProduct[];
};

export type RecommendationQaPlacement =
  | "home"
  | "product_detail"
  | "search";

export type RecommendationQaAlgorithmSnapshot = {
  algorithm: "rule_based_v1" | "rule_based_v2";
  rank: number | null;
  finalScore: number | null;
  reasons: string[];
  scoreBreakdown: {
    categoryScore: number;
    textScore: number;
    popularityScore: number;
    freshnessScore: number;
    ratingScore: number;
    stockScore: number;
    shopScore: number;
    penaltyScore: number;
    personalizationScore: number;
    recentViewScore: number;
    categoryAffinityScore: number;
    searchIntentScore: number;
    clickAffinityScore: number;
    sponsoredBoostScore: number;
    businessBoostScore: number;
    maxSponsoredBoost: number;
  } | null;
  sponsoredReason: string | null;
  sponsoredPreset: RecommendationSponsoredPreset | null;
  campaignReadiness: RecommendationCampaignReadiness | null;
  sponsoredCampaign: RecommendationSponsoredCampaign | null;
};

export type RecommendationQaComparisonItem = {
  productId: string;
  productName: string;
  rankMovement: number | null;
  ruleBasedV1: RecommendationQaAlgorithmSnapshot | null;
  ruleBasedV2: RecommendationQaAlgorithmSnapshot | null;
};

export type RecommendationQaComparisonResponse = {
  placement: RecommendationQaPlacement;
  sponsoredRanking: {
    sponsoredRankingEnabled: boolean;
    activePreset: RecommendationSponsoredPreset | null;
  } | null;
  items: RecommendationQaComparisonItem[];
};

export type RecommendationQaSnapshotProduct = {
  id: string;
  name: string;
  seoSlug: string | null;
  categoryName: string | null;
  brand: string | null;
  color: string | null;
  price: string | null;
  inStock: boolean;
  imageUrl: string | null;
  shopName: string | null;
  shopSlug: string | null;
};

export type RecommendationQaSnapshotResponse = {
  scenarioType: "home" | "similar" | "search";
  placement: RecommendationQaPlacement;
  sponsoredRanking: {
    sponsoredRankingEnabled: boolean;
    activePreset: RecommendationSponsoredPreset | null;
  } | null;
  productId: string | null;
  query: string | null;
  limit: number;
  generatedAt: string;
  comparedAlgorithms: Array<"rule_based_v1" | "rule_based_v2">;
  items: Array<{
    product: RecommendationQaSnapshotProduct;
    rankMovement: number | null;
    ruleBasedV1: RecommendationQaAlgorithmSnapshot | null;
    ruleBasedV2: RecommendationQaAlgorithmSnapshot | null;
  }>;
};

export type RecommendationQaDiffStatus =
  | "unchanged"
  | "moved_up"
  | "moved_down"
  | "added"
  | "removed";

export type RecommendationQaDiffResponse = {
  scenario: {
    baseline: RecommendationQaSnapshotResponse;
    candidate: RecommendationQaSnapshotResponse;
  };
  summary: {
    totalItemsCompared: number;
    movedUpCount: number;
    movedDownCount: number;
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
  };
  items: Array<{
    productId: string;
    productName: string;
    status: RecommendationQaDiffStatus;
    oldRank: number | null;
    newRank: number | null;
    rankMovement: number | null;
    oldScore: number | null;
    newScore: number | null;
    scoreDelta: number | null;
    reasonDelta: {
      added: string[];
      removed: string[];
    } | null;
    scoreBreakdownDelta: {
      categoryScore: number;
      textScore: number;
      popularityScore: number;
      freshnessScore: number;
      ratingScore: number;
      stockScore: number;
      shopScore: number;
      penaltyScore: number;
      personalizationScore: number;
      recentViewScore: number;
      categoryAffinityScore: number;
      searchIntentScore: number;
      clickAffinityScore: number;
      sponsoredBoostScore: number;
      businessBoostScore: number;
      maxSponsoredBoost: number;
    } | null;
  }>;
};

export type RecommendationQaPack = {
  packName: string;
  description: string;
  scenarioType: "home" | "similar" | "search";
  query?: string | null;
  productId?: string | null;
  catalogId?: string | null;
  thresholdPresetId?: string | null;
  limit: number;
  baselineSnapshot: RecommendationQaSnapshotResponse;
  candidateSnapshot: RecommendationQaSnapshotResponse;
  expectedSummaryThresholds?: {
    maxMovedDownCount?: number;
    maxMovedUpCount?: number;
    maxAddedCount?: number;
    maxRemovedCount?: number;
    maxScoreDelta?: number;
    maxAbsoluteRankMovement?: number;
    minUnchangedCount?: number;
    maxTotalChangedCount?: number;
  };
};

export type RecommendationQaThresholdPreset = {
  id:
    | "strict"
    | "balanced"
    | "lenient"
    | "search-intent-sensitive"
    | "similar-products-sensitive";
  name: string;
  description: string;
  version: string;
  updatedAt: string;
  owner: string;
  notes: string;
  stability: "experimental" | "stable" | "deprecated";
  thresholds: NonNullable<RecommendationQaPack["expectedSummaryThresholds"]>;
};

export type RecommendationQaBaselineCatalogEntry = {
  id: string;
  name: string;
  description: string;
  version: string;
  updatedAt: string;
  owner: string;
  notes: string;
  stability: "experimental" | "stable" | "deprecated";
  scenarioType: "home" | "similar" | "search";
  query: string | null;
  productId: string | null;
  defaultLimit: number;
  recommendedThresholdPresetId: RecommendationQaThresholdPreset["id"];
  mockPack: {
    packName: string;
    description: string;
    thresholdPresetId: RecommendationQaThresholdPreset["id"];
    baselineSnapshot: RecommendationQaSnapshotResponse;
    candidateSnapshot: RecommendationQaSnapshotResponse;
  } | null;
};

export type RecommendationQaPackValidationResponse = {
  valid: boolean;
  pack: RecommendationQaPack;
  notices: string[];
  appliedThresholdPreset: RecommendationQaThresholdPreset | null;
  resolvedThresholds: NonNullable<RecommendationQaPack["expectedSummaryThresholds"]>;
  evaluation: {
    overallStatus: "pass" | "fail" | "not_evaluated";
    summary: {
      totalItemsCompared: number;
      movedUpCount: number;
      movedDownCount: number;
      addedCount: number;
      removedCount: number;
      unchangedCount: number;
      totalChangedCount: number;
      maxScoreDelta: number;
      maxAbsoluteRankMovement: number;
    };
    thresholds: Array<{
      key:
        | "maxMovedDownCount"
        | "maxMovedUpCount"
        | "maxAddedCount"
        | "maxRemovedCount"
        | "maxScoreDelta"
        | "maxAbsoluteRankMovement"
        | "minUnchangedCount"
        | "maxTotalChangedCount";
      status: "pass" | "fail";
      operator: "<=" | ">=";
      actualValue: number;
      expectedValue: number;
      message: string;
    }>;
  };
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

export async function getHomeRecommendations(
  limit = 12,
  options?: {
    debug?: boolean;
  },
) {
  const params = new URLSearchParams();
  const guestSessionId = getGuestSessionId();
  params.set("limit", String(limit));
  if (options?.debug) {
    params.set("debug", "true");
  }
  const response = await apiRequest<RecommendationProductsResponse | {
    algorithm: string;
    placement?: RecommendationPlacement;
    items: Array<PublicProduct | RecommendationProductItem>;
    products?: PublicProduct[];
  }>(
    `/api/public/recommendations/home?${params.toString()}`,
    {
      method: "GET",
      headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
    },
  );
  return normalizeRecommendationResponse(response, "home");
}

export async function getSimilarProductRecommendations(
  productId: string,
  limit = 12,
  options?: {
    debug?: boolean;
  },
) {
  const params = new URLSearchParams();
  const guestSessionId = getGuestSessionId();
  params.set("limit", String(limit));
  if (options?.debug) {
    params.set("debug", "true");
  }
  const response = await apiRequest<RecommendationProductsResponse | {
    algorithm: string;
    placement?: RecommendationPlacement;
    items: Array<PublicProduct | RecommendationProductItem>;
    products?: PublicProduct[];
  }>(
    `/api/public/recommendations/products/${productId}/similar?${params.toString()}`,
    {
      method: "GET",
      headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
    },
  );
  return normalizeRecommendationResponse(response, "product_detail");
}

export async function getSearchProductRecommendations(
  q: string,
  limit = 12,
  options?: {
    debug?: boolean;
  },
) {
  const params = new URLSearchParams();
  const guestSessionId = getGuestSessionId();
  params.set("q", q);
  params.set("limit", String(limit));
  if (options?.debug) {
    params.set("debug", "true");
  }
  const response = await apiRequest<RecommendationProductsResponse | {
    algorithm: string;
    placement?: RecommendationPlacement;
    items: Array<PublicProduct | RecommendationProductItem>;
    products?: PublicProduct[];
  }>(`/api/public/recommendations/search?${params.toString()}`, {
    method: "GET",
    headers: guestSessionId ? { "x-guest-session-id": guestSessionId } : undefined,
  });
  return normalizeRecommendationResponse(response, "search");
}

export async function getRecommendationRankingComparison(query?: {
  placement?: RecommendationQaPlacement;
  productId?: string;
  q?: string;
  limit?: number;
  debug?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("placement", query?.placement ?? "home");
  params.set("limit", String(query?.limit ?? 12));
  if (query?.productId) {
    params.set("productId", query.productId);
  }
  if (query?.q) {
    params.set("q", query.q);
  }
  if (query?.debug) {
    params.set("debug", "true");
  }

  return apiRequest<RecommendationQaComparisonResponse>(
    `/api/internal/recommendations/compare?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function getRecommendationRankingSnapshot(query?: {
  placement?: RecommendationQaPlacement;
  productId?: string;
  q?: string;
  limit?: number;
  debug?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("placement", query?.placement ?? "home");
  params.set("limit", String(query?.limit ?? 12));
  params.set("export", "true");
  params.set("format", "json");
  if (query?.productId) {
    params.set("productId", query.productId);
  }
  if (query?.q) {
    params.set("q", query.q);
  }
  if (query?.debug) {
    params.set("debug", "true");
  }

  return apiRequest<RecommendationQaSnapshotResponse>(
    `/api/internal/recommendations/compare?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function diffRecommendationRankingSnapshots(payload: {
  baseline: RecommendationQaSnapshotResponse;
  candidate: RecommendationQaSnapshotResponse;
}) {
  return apiRequest<RecommendationQaDiffResponse>(
    "/api/internal/recommendations/diff",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function validateRecommendationQaPack(payload: RecommendationQaPack) {
  return apiRequest<RecommendationQaPackValidationResponse>(
    "/api/internal/recommendations/packs/validate",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getRecommendationQaThresholdPresets() {
  return apiRequest<{ presets: RecommendationQaThresholdPreset[] }>(
    "/api/internal/recommendations/presets",
    {
      method: "GET",
    },
  );
}

export async function getRecommendationQaBaselineCatalog() {
  return apiRequest<{ catalog: RecommendationQaBaselineCatalogEntry[] }>(
    "/api/internal/recommendations/baseline-catalog",
    {
      method: "GET",
    },
  );
}

export async function getRecommendationSponsoredPresets() {
  return apiRequest<RecommendationSponsoredPresetCatalog>(
    "/api/internal/recommendations/sponsored-presets",
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
  idempotencyKey?: string;
  sponsored?: boolean;
  trackingToken?: string | null;
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

function normalizeRecommendationResponse(
  response:
    | RecommendationProductsResponse
    | {
        algorithm: string;
        placement?: RecommendationPlacement;
        items: Array<PublicProduct | RecommendationProductItem>;
        products?: PublicProduct[];
      },
  fallbackPlacement: RecommendationPlacement,
): RecommendationProductsResponse {
  const normalizedItems = response.items.map((item, index) => {
    if ("product" in item) {
      return item;
    }

      return {
        product: item,
        rank: index + 1,
        score: null,
        reasonCodes: [],
        scoreExplanation: undefined,
      };
    });

  return {
    algorithm: response.algorithm,
    placement: response.placement ?? fallbackPlacement,
    items: normalizedItems,
    products:
      response.products ??
      normalizedItems.map((item) => item.product),
  };
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
