import { apiRequest } from "@/lib/api";

export type SellerOrderStatus = "NEW" | "ASSEMBLING" | "SHIPPING" | "DELIVERED" | "CANCELLED";

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
    inStock: boolean;
  }>;
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
}>;

export async function getSellerShops(token: string) {
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
  },
  token: string,
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

  return apiRequest<ProductListResponse>(`/api/shops/${shopId}/products?${params.toString()}`, {
    method: "GET",
    token,
  });
}

export async function getShopProductById(shopId: string, productId: string, token: string) {
  return apiRequest<ProductDetail>(`/api/shops/${shopId}/products/${productId}`, {
    method: "GET",
    token,
  });
}

export async function updateShopProduct(
  shopId: string,
  productId: string,
  payload: UpdateProductPayload,
  token: string,
) {
  return apiRequest<ProductDetail>(`/api/shops/${shopId}/products/${productId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getShopProductImages(shopId: string, productId: string, token: string) {
  return apiRequest<ProductImage[]>(`/api/shops/${shopId}/products/${productId}/images`, {
    method: "GET",
    token,
  });
}

export async function uploadShopProductImages(
  shopId: string,
  productId: string,
  files: File[],
  token: string,
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
  token: string,
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
  token: string,
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
  token: string,
) {
  return apiRequest<AiImageTask>(`/api/shops/${shopId}/products/${productId}/ai-images/tasks`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getAiCredits(shopId: string, token: string) {
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
  token: string,
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

export async function getShopAiImageTaskById(shopId: string, taskId: string, token: string) {
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
  token: string,
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
  token: string,
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

export async function getShopOrderById(shopId: string, orderId: string, token: string) {
  return apiRequest<SellerOrderListItem>(`/api/shops/${shopId}/orders/${orderId}`, {
    method: "GET",
    token,
  });
}

export async function updateShopOrderStatus(
  shopId: string,
  orderId: string,
  status: SellerOrderStatus,
  token: string,
) {
  return apiRequest<SellerOrderListItem>(`/api/shops/${shopId}/orders/${orderId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}
