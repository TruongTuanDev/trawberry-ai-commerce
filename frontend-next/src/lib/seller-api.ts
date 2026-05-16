import { apiRequest } from "@/lib/api";

export type SellerOrderStatus = "PENDING" | "NEW" | "ASSEMBLING" | "SHIPPING" | "DELIVERED" | "CANCELLED";
export type PaymentReviewAction = "MARK_PAID" | "REJECT_PAYMENT" | "ADD_NOTE" | "UPLOAD_PROOF";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED";
export type DeliveryProviderName = "CDEK" | "YANDEX" | "MANUAL";
export type DeliveryExceptionReasonCode =
  | "CUSTOMER_UNAVAILABLE"
  | "WRONG_ADDRESS"
  | "COURIER_CANCELLED"
  | "SELLER_CANCELLED"
  | "CUSTOMER_CANCELLED"
  | "DAMAGED_PACKAGE"
  | "LOST_PACKAGE"
  | "DELIVERY_TIMEOUT"
  | "OTHER";
export type DeliveryCommentVisibility = "INTERNAL" | "CUSTOMER_VISIBLE";

export type SellerOrderDeliverySummary = {
  provider: DeliveryProviderName | string;
  status: string;
  providerShipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  courierPhone: string | null;
  estimatedDeliveryAt: string | null;
  deliveryNote: string | null;
};

export type DeliverySettings = {
  shopId: string;
  pickupCountry: string;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode: string | null;
  pickupLatitude: string | null;
  pickupLongitude: string | null;
  pickupContactPhone: string;
  pickupContactName: string;
  pickupWorkingHours: string | null;
  pickupComment: string | null;
  enabledCarriers: string[];
  defaultCarrier: DeliveryProviderName | string;
  sameCityPreferredCarrier: DeliveryProviderName | string;
  interCityPreferredCarrier: DeliveryProviderName | string;
  fallbackCarrier: DeliveryProviderName | string;
  defaultWeightGram: number;
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryOffer = {
  id: string;
  provider: DeliveryProviderName | string;
  offerType: string;
  priceAmount: string;
  priceCurrency: string;
  estimatedMinMinutes: number | null;
  estimatedMaxMinutes: number | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  pickupPointId: string | null;
  isRecommended: boolean;
  expiresAt: string | null;
};

export type DeliveryEvent = {
  id: string;
  provider: string;
  eventType: string;
  providerStatus: string | null;
  message: string | null;
  createdAt: string;
};

export type DeliveryComment = {
  id: string;
  actorUserId: string | null;
  actorRole: string;
  visibility: DeliveryCommentVisibility | string;
  message: string;
  createdAt: string;
};

export type DeliveryShipment = {
  id: string;
  provider: DeliveryProviderName | string;
  providerShipmentId: string | null;
  providerOrderNumber: string | null;
  providerStatus: string;
  internalStatus: string;
  priceAmount: string | null;
  priceCurrency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  courierPhone: string | null;
  estimatedDeliveryAt: string | null;
  deliveryNote: string | null;
  failureReasonCode: DeliveryExceptionReasonCode | string | null;
  failureReasonText: string | null;
  failedAt: string | null;
  customerVisibleMessage: string | null;
  lastAdminNote: string | null;
  lastSellerNote: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  deliveredAt: string | null;
};

export type DeliveryDetail = {
  orderId: string;
  shopId: string;
  activeShipment: DeliveryShipment | null;
  offers: DeliveryOffer[];
  events: DeliveryEvent[];
  comments: DeliveryComment[];
};

export type ShopSummary = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: string;
  sellerProfileId: string;
  productCount: number;
};

export type SellerOrderListItem = {
  id: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  status: SellerOrderStatus;
  paymentStatus: string;
  totalAmount: string;
  shippingCost: string;
  shippingMethodName: string | null;
  shippingAddress: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  customerCompletedAt: string | null;
  delivery: SellerOrderDeliverySummary | null;
  items: Array<{
    id: string;
    variantId: string | null;
    quantity: number;
    priceAtPurchase: string;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
};

export type SellerOrdersResponse = {
  items: SellerOrderListItem[];
  meta: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
};

export type PaymentReviewLog = {
  id: string;
  action: PaymentReviewAction;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  reviewerUserId: string;
  reviewerName: string | null;
  createdAt: string;
};

export type SellerPaymentItem = {
  id: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  status: SellerOrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  totalAmount: string;
  shippingAddress: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: string;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
  paymentProof: {
    url: string;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
    uploadedAt: string | null;
  } | null;
  reviewLogs: PaymentReviewLog[];
};

export type SellerPaymentsResponse = {
  items: SellerPaymentItem[];
  meta: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
};

export type ProductListItem = {
  id: string;
  shopId: string;
  wbNmId: string;
  title: string;
  wbTitle: string | null;
  localTitle: string | null;
  brand: string | null;
  visibility: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  wbVendorCode: string | null;
  mainImage: string | null;
  inStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  stockStatus: StockStatus;
  variantCount: number;
  primaryVariantId: string | null;
};

export type ProductListResponse = {
  items: ProductListItem[];
  meta: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
};

export type ProductDetail = {
  id: string;
  shopId: string;
  wbNmId: string;
  wbImtId: string | null;
  wbTitle: string;
  localTitle: string | null;
  title: string | null;
  wbDescription: string | null;
  localDescription: string | null;
  description: string | null;
  brand: string | null;
  visibility: string | null;
  seoSlug: string | null;
  wbVendorCode: string | null;
  categoryName: string | null;
  category: {
    id: number;
    name: string;
  } | null;
  shop: {
    id: string;
    name: string;
    slug: string;
  };
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    chrtId: string;
    techSize: string | null;
    wbSize: string | null;
    basePrice: string | null;
    discountPrice: string | null;
    stockQuantity: number;
    reservedStock: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    stockStatus: StockStatus;
    inStock: boolean;
  }>;
};

export type ProductInventory = {
  productId: string;
  shopId: string;
  title: string;
  totalStockQuantity: number;
  totalReservedStock: number;
  totalLowStockThreshold: number;
  trackInventory: boolean;
  stockStatus: StockStatus;
  totalAvailableQuantity: number;
  inStock: boolean;
  variants: Array<{
    id: string;
    chrtId: string;
    techSize: string | null;
    wbSize: string | null;
    stockQuantity: number;
    reservedStock: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    stockStatus: StockStatus;
    availableQuantity: number;
    inStock: boolean;
  }>;
};

export type WbImportIssue = {
  level: "WARNING" | "ERROR";
  code: string;
  message: string;
  row?: number;
  sellerSku?: string | null;
};

export type WbImportPreviewProduct = {
  sellerSku: string | null;
  externalProductId: string | null;
  name: string;
  brand: string | null;
  categoryName: string | null;
  variantsCount: number;
  imagesCount: number;
  priceStatus: "OK" | "MISSING";
  warnings: WbImportIssue[];
  errors: WbImportIssue[];
};

export type WbImportPreview = {
  importId: string;
  totalRows: number;
  totalProducts: number;
  totalVariants: number;
  totalImages: number;
  warnings: WbImportIssue[];
  errors: WbImportIssue[];
  products: WbImportPreviewProduct[];
};

export type WbImportConfirmResult = {
  importId: string;
  status: string;
  createdProducts: number;
  updatedProducts: number;
  createdVariants: number;
  updatedVariants: number;
  addedImages: number;
  skippedImages: number;
};

export type WbImportStatus = {
  importId: string;
  status: string;
  originalFileName: string;
  totalRows: number;
  totalProducts: number;
  totalVariants: number;
  totalImages: number;
  warnings: WbImportIssue[];
  errors: WbImportIssue[];
  result: WbImportConfirmResult | null;
  createdAt: string;
  completedAt: string | null;
};

export type WbSyncRun = {
  syncRunId: string;
  status: string;
  mode: string;
  syncType: string;
  article: string | null;
  totalFetched: number;
  totalProducts: number;
  totalVariants: number;
  totalImages: number;
  createdProducts: number;
  updatedProducts: number;
  createdVariants: number;
  updatedVariants: number;
  warnings: WbImportIssue[];
  errors: WbImportIssue[];
  rawSummary: {
    products?: Array<{
      sellerSku: string | null;
      externalProductId: string | null;
      name: string;
      variantsCount: number;
      imagesCount: number;
      warnings: WbImportIssue[];
      errors: WbImportIssue[];
    }>;
  } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type WbCredentialsStatus = {
  shopId: string;
  hasCredentials: boolean;
  keyLast4: string | null;
  updatedAt: string | null;
  mode: "mock" | "real";
};

export type ProductImage = {
  id: string;
  shopId: string;
  productId: string;
  url: string;
  wbUrl: string;
  localUrl: string | null;
  storageKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  imageType: "ORIGINAL" | "AI_GENERATED" | "MODEL_REFERENCE" | "FRONT" | "BACK" | "DETAIL";
  isMain: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AiTaskStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type AiTaskType = "PRODUCT_MODEL_IMAGE" | "TRY_ON" | "BACKGROUND_REPLACE" | "DETAIL_SHOT";
export type AiStylePreset = "MAIN_COVER" | "STUDIO" | "LIFESTYLE" | "WALKING" | "BACK_VIEW" | "DETAIL" | "TRY_ON";

export type AiGeneratedImage = {
  id: string;
  taskId: string;
  shopId: string;
  productId: string;
  url: string;
  imageUrl: string;
  storageKey: string | null;
  provider: string | null;
  thumbnailUrl: string | null;
  storageProvider: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  isSelected: boolean;
  attachedImageId: string | null;
  createdAt: string;
};

export type AiCredits = {
  id: string;
  shopId: string;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  createdAt: string;
  updatedAt: string;
};

export type AiImageTask = {
  id: string;
  shopId: string;
  productId: string;
  requestedBy: string;
  userId: string;
  status: AiTaskStatus;
  taskType: AiTaskType;
  mode: "generate" | "try_on";
  quantity: number;
  prompt: string;
  stylePreset: string | null;
  sourceImageId: string | null;
  inputFrontImageId: string | null;
  inputBackImageId: string | null;
  inputModelImageId: string | null;
  creditCost: number;
  creditRefundedAt: string | null;
  attemptCount: number;
  queueJobId: string | null;
  providerTaskId: string | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  generatedImages: AiGeneratedImage[];
};

export type CreateAiImageTaskPayload = {
  mode?: "generate" | "try_on";
  taskType: AiTaskType;
  quantity: number;
  prompt: string;
  stylePreset?: AiStylePreset;
  sourceImageId?: string;
  inputFrontImageId?: string;
  inputBackImageId?: string;
  inputModelImageId?: string;
};

export type CreateShopPayload = {
  name: string;
  slug: string;
  contactInfo?: string;
  paymentInstructions?: string;
};

export type CreateProductPayload = {
  wbNmId: number;
  wbTitle: string;
  wbDescription?: string;
  brand?: string;
  categoryName?: string;
  wbVendorCode?: string;
  localTitle?: string;
  localDescription?: string;
  seoSlug?: string;
  visibility?: string;
  variants?: Array<{
    chrtId: number;
    techSize?: string;
    wbSize?: string;
    isActive?: boolean;
    basePrice?: number;
    discountPrice?: number;
    stockQuantity?: number;
    lowStockThreshold?: number;
    trackInventory?: boolean;
  }>;
};

export type UpdateProductPayload = Partial<{
  wbNmId: number;
  wbTitle: string;
  wbDescription: string;
  brand: string;
  categoryId: number;
  categoryName: string;
  wbVendorCode: string;
  wbVideoUrl: string;
  wbNeedKiz: boolean;
  subjectId: number;
  wholesaleEnabled: boolean;
  wholesaleQuantum: number;
  length: number;
  width: number;
  height: number;
  weightBrutto: number;
  dimensionsValid: boolean;
  localTitle: string;
  localDescription: string;
  seoSlug: string;
  visibility: string;
  localTags: string[];
  variants: Array<{
    chrtId: number;
    isActive?: boolean;
    basePrice?: number;
    discountPrice?: number;
    stockQuantity?: number;
    lowStockThreshold?: number;
    trackInventory?: boolean;
  }>;
}>;

export async function createSellerShop(payload: CreateShopPayload, token?: string) {
  return apiRequest<ShopSummary>("/api/shops", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getSellerShops(token?: string) {
  return apiRequest<ShopSummary[]>("/api/shops", {
    method: "GET",
    token,
  });
}

export async function getShopProducts(
  shopId: string,
  query: {
    page: number;
    size: number;
    search?: string;
    status?: string;
    stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  },
  token?: string,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });

  if (query.search) {
    params.set("search", query.search);
  }

  if (query.status) {
    params.set("status", query.status);
  }
  if (query.stockStatus) {
    params.set("stockStatus", query.stockStatus);
  }

  return apiRequest<ProductListResponse>(`/api/shops/${shopId}/products?${params.toString()}`, {
    method: "GET",
    token,
  });
}

export async function createShopProduct(shopId: string, payload: CreateProductPayload, token?: string) {
  return apiRequest<ProductDetail>(`/api/shops/${shopId}/products`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getShopProductById(shopId: string, productId: string, token?: string) {
  return apiRequest<ProductDetail>(`/api/shops/${shopId}/products/${productId}`, {
    method: "GET",
    token,
  });
}

export async function updateShopProduct(
  shopId: string,
  productId: string,
  payload: UpdateProductPayload,
  token?: string,
) {
  return apiRequest<ProductDetail>(`/api/shops/${shopId}/products/${productId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getShopProductInventory(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductInventory>(
    `/api/shops/${shopId}/products/${productId}/inventory`,
    {
      method: "GET",
      token,
    },
  );
}

export async function updateShopProductInventory(
  shopId: string,
  productId: string,
  payload: {
    variantId?: string;
    stockQuantity: number;
    note?: string;
  },
  token?: string,
) {
  return apiRequest<ProductInventory>(
    `/api/shops/${shopId}/products/${productId}/inventory`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function previewWildberriesImport(
  shopId: string,
  input: {
    file: File;
    defaultStockQuantity?: number;
    publishMode?: "DRAFT" | "ACTIVE";
    imageMode?: "REMOTE_URL" | "DOWNLOAD_TO_STORAGE";
    priceFallback?: number;
  },
  token?: string,
) {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("defaultStockQuantity", String(input.defaultStockQuantity ?? 0));
  formData.append("publishMode", input.publishMode ?? "DRAFT");
  formData.append("imageMode", input.imageMode ?? "REMOTE_URL");
  if (input.priceFallback !== undefined) {
    formData.append("priceFallback", String(input.priceFallback));
  }

  return apiRequest<WbImportPreview>(`/api/shops/${shopId}/imports/wildberries/preview`, {
    method: "POST",
    token,
    body: formData,
  });
}

export async function confirmWildberriesImport(shopId: string, importId: string, token?: string) {
  return apiRequest<WbImportConfirmResult>(`/api/shops/${shopId}/imports/wildberries/confirm`, {
    method: "POST",
    token,
    body: JSON.stringify({ importId }),
  });
}

export async function getWildberriesImportStatus(shopId: string, importId: string, token?: string) {
  return apiRequest<WbImportStatus>(`/api/shops/${shopId}/imports/wildberries/${importId}`, {
    method: "GET",
    token,
  });
}

export async function getWbSyncCredentialsStatus(shopId: string, token?: string) {
  return apiRequest<WbCredentialsStatus>(`/api/shops/${shopId}/wb-sync/credentials/status`, {
    method: "GET",
    token,
  });
}

export async function saveWbSyncCredentials(shopId: string, apiKey: string, token?: string) {
  return apiRequest<WbCredentialsStatus>(`/api/shops/${shopId}/wb-sync/credentials`, {
    method: "POST",
    token,
    body: JSON.stringify({ apiKey }),
  });
}

export async function syncWbProducts(
  shopId: string,
  payload: {
    mode: "PREVIEW" | "IMPORT";
    limit?: number;
    publishMode?: "DRAFT" | "ACTIVE_IF_VALID";
    imageMode?: "REMOTE_URL";
  },
  token?: string,
) {
  return apiRequest<WbSyncRun>(`/api/shops/${shopId}/wb-sync/products`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function syncWbProductByArticle(
  shopId: string,
  payload: {
    article: string;
    mode: "PREVIEW" | "IMPORT";
    publishMode?: "DRAFT" | "ACTIVE_IF_VALID";
    imageMode?: "REMOTE_URL";
  },
  token?: string,
) {
  return apiRequest<WbSyncRun>(`/api/shops/${shopId}/wb-sync/products/by-article`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getShopProductImages(shopId: string, productId: string, token?: string) {
  return apiRequest<ProductImage[]>(`/api/shops/${shopId}/products/${productId}/images`, {
    method: "GET",
    token,
  });
}

export async function uploadShopProductImages(
  shopId: string,
  productId: string,
  files: File[],
  token?: string,
) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  return apiRequest<ProductImage[]>(`/api/shops/${shopId}/products/${productId}/images`, {
    method: "POST",
    token,
    body: formData,
  });
}

export async function deleteShopProductImage(
  shopId: string,
  productId: string,
  imageId: string,
  token?: string,
) {
  return apiRequest<void>(`/api/shops/${shopId}/products/${productId}/images/${imageId}`, {
    method: "DELETE",
    token,
  });
}

export async function updateShopProductImage(
  shopId: string,
  productId: string,
  imageId: string,
  payload: Partial<Pick<ProductImage, "isMain" | "sortOrder" | "imageType">>,
  token?: string,
) {
  return apiRequest<ProductImage>(`/api/shops/${shopId}/products/${productId}/images/${imageId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function createShopAiImageTask(
  shopId: string,
  productId: string,
  payload: CreateAiImageTaskPayload,
  token?: string,
) {
  return apiRequest<AiImageTask>(`/api/shops/${shopId}/products/${productId}/ai-images/tasks`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getAiCredits(shopId: string, token?: string) {
  return apiRequest<AiCredits>(`/api/shops/${shopId}/ai-credits`, {
    method: "GET",
    token,
  });
}

export const createAiImageTask = createShopAiImageTask;

export async function getShopAiImageTasks(
  shopId: string,
  query: {
    productId?: string;
    status?: string;
  },
  token?: string,
) {
  const params = new URLSearchParams();
  if (query.productId) {
    params.set("productId", query.productId);
  }
  if (query.status) {
    params.set("status", query.status);
  }

  return apiRequest<AiImageTask[]>(`/api/shops/${shopId}/ai-images/tasks?${params.toString()}`, {
    method: "GET",
    token,
  });
}

export async function getShopAiImageTaskById(shopId: string, taskId: string, token?: string) {
  return apiRequest<AiImageTask>(`/api/shops/${shopId}/ai-images/tasks/${taskId}`, {
    method: "GET",
    token,
  });
}

export const getAiImageTask = getShopAiImageTaskById;

export async function attachAiGeneratedImageToProduct(
  shopId: string,
  productId: string,
  generatedImageId: string,
  token?: string,
) {
  return apiRequest<ProductImage>(`/api/shops/${shopId}/products/${productId}/ai-images/${generatedImageId}/attach`, {
    method: "POST",
    token,
  });
}

export const attachGeneratedImage = attachAiGeneratedImageToProduct;

export async function getShopOrders(
  shopId: string,
  query: {
    page: number;
    size: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  token?: string,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });

  if (query.search) {
    params.set("search", query.search);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.dateFrom) {
    params.set("dateFrom", query.dateFrom);
  }
  if (query.dateTo) {
    params.set("dateTo", query.dateTo);
  }

  return apiRequest<SellerOrdersResponse>(`/api/shops/${shopId}/orders?${params.toString()}`, {
    method: "GET",
    token,
  });
}

export async function getShopOrderById(shopId: string, orderId: string, token?: string) {
  return apiRequest<SellerOrderListItem>(`/api/shops/${shopId}/orders/${orderId}`, {
    method: "GET",
    token,
  });
}

export async function listPayments(
  shopId: string,
  query: {
    page: number;
    size: number;
    search?: string;
    status?: string;
  },
  token?: string,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.status) {
    params.set("status", query.status);
  }

  return apiRequest<SellerPaymentsResponse>(`/api/shops/${shopId}/payments?${params.toString()}`, {
    method: "GET",
    token,
  });
}

export async function getPaymentDetail(shopId: string, orderId: string, token?: string) {
  return apiRequest<SellerPaymentItem>(`/api/shops/${shopId}/payments/${orderId}`, {
    method: "GET",
    token,
  });
}

export async function markPaymentPaid(
  shopId: string,
  orderId: string,
  payload?: { note?: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(`/api/shops/${shopId}/payments/${orderId}/mark-paid`, {
    method: "POST",
    token,
    body: JSON.stringify(payload ?? {}),
  });
}

export async function rejectPayment(
  shopId: string,
  orderId: string,
  payload?: { note?: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(`/api/shops/${shopId}/payments/${orderId}/reject`, {
    method: "POST",
    token,
    body: JSON.stringify(payload ?? {}),
  });
}

export async function addPaymentNote(
  shopId: string,
  orderId: string,
  payload: { note: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(`/api/shops/${shopId}/payments/${orderId}/notes`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateShopOrderStatus(
  shopId: string,
  orderId: string,
  status: SellerOrderStatus,
  token?: string,
) {
  return apiRequest<SellerOrderListItem>(`/api/shops/${shopId}/orders/${orderId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}

export async function getDeliverySettings(shopId: string, token?: string) {
  return apiRequest<DeliverySettings>(`/api/shops/${shopId}/delivery/settings`, {
    method: "GET",
    token,
  });
}

export async function updateDeliverySettings(
  shopId: string,
  payload: {
    pickupAddress: string;
    pickupCity: string;
    pickupPostalCode?: string;
    pickupContactPhone: string;
    pickupContactName: string;
    pickupCountry?: string;
    pickupLatitude?: number;
    pickupLongitude?: number;
    pickupWorkingHours?: string;
    pickupComment?: string;
    enabledCarriers: Array<"CDEK" | "YANDEX">;
    defaultCarrier: "CDEK" | "YANDEX";
    sameCityPreferredCarrier: "CDEK" | "YANDEX";
    interCityPreferredCarrier: "CDEK" | "YANDEX";
    fallbackCarrier: "CDEK" | "YANDEX";
    defaultWeightGram: number;
    defaultLengthCm: number;
    defaultWidthCm: number;
    defaultHeightCm: number;
  },
  token?: string,
) {
  return apiRequest<DeliverySettings>(`/api/shops/${shopId}/delivery/settings`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function calculateDeliveryOffers(
  shopId: string,
  orderId: string,
  payload: {
    carriers?: Array<"CDEK" | "YANDEX">;
    pickupAddress?: string;
    packageInfo?: {
      weightGram: number;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    };
  },
  token?: string,
) {
  return apiRequest<{ offers: DeliveryOffer[] }>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/offers`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function createDeliveryShipment(
  shopId: string,
  orderId: string,
  payload: {
    provider?: "CDEK" | "YANDEX";
    pickupAddress?: string;
    selectedOfferId?: string;
    packageInfo?: {
      weightGram: number;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    };
  },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function cancelDeliveryShipment(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload?: { reason?: string },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/cancel`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function acceptDeliveryShipment(
  shopId: string,
  orderId: string,
  shipmentId: string,
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/accept`,
    {
      method: "POST",
      token,
    },
  );
}

export async function refreshDeliveryShipment(
  shopId: string,
  orderId: string,
  shipmentId: string,
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/refresh`,
    {
      method: "POST",
      token,
    },
  );
}

export async function getOrderDelivery(
  shopId: string,
  orderId: string,
  token?: string,
) {
  return apiRequest<DeliveryDetail>(
    `/api/shops/${shopId}/orders/${orderId}/delivery`,
    {
      method: "GET",
      token,
    },
  );
}

export type ManualDeliveryPayload = {
  provider: DeliveryProviderName;
  providerShipmentId?: string | null;
  providerOrderNumber?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  courierPhone?: string | null;
  estimatedDeliveryAt?: string | null;
  deliveryNote?: string | null;
  pickupAddress?: string | null;
  note?: string | null;
};

export async function createManualDelivery(
  shopId: string,
  orderId: string,
  payload: ManualDeliveryPayload,
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/manual`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function updateManualDelivery(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload: ManualDeliveryPayload,
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/manual`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function markManualDeliveryInTransit(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload?: { note?: string | null },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/mark-in-transit`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function markManualDeliveryDelivered(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload?: { note?: string | null },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/mark-delivered`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function markManualDeliveryFailed(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload: {
    reasonCode: DeliveryExceptionReasonCode;
    reasonText?: string | null;
    customerVisibleMessage?: string | null;
  },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/mark-failed`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function addDeliveryComment(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload: { visibility: DeliveryCommentVisibility; message: string },
  token?: string,
) {
  return apiRequest<DeliveryComment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/comments`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}
