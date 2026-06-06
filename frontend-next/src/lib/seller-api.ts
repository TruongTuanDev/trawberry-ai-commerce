import { ApiError, apiRequest } from "@/lib/api";

export type SellerOrderStatus =
  | "PENDING"
  | "NEW"
  | "READY_TO_CREATE_YANDEX"
  | "YANDEX_MANUAL_CREATED"
  | "ASSEMBLING"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED";

export type SellerFulfillmentBucket =
  | "ALL"
  | "NEW"
  | "ASSEMBLING"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";
export type PaymentReviewAction =
  | "MARK_PAID"
  | "SELLER_CONFIRMED"
  | "SELLER_REJECTED"
  | "ADMIN_CONFIRMED"
  | "ADMIN_REJECTED"
  | "ADD_NOTE"
  | "UPLOAD_PROOF"
  | "BUYER_MARKED_PAID";

export type SellerPaymentProofStatus =
  | "NOT_SUBMITTED"
  | "BUYER_MARKED_PAID"
  | "SELLER_CONFIRMED"
  | "SELLER_REJECTED"
  | "ADMIN_REVIEW";

export type PaymentDetails = {
  mode: string | null;
  selectedPaymentMethod?: string | null;
  selectedPaymentMethodLabel?: string | null;
  bankName: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAccount: string | null;
  sbpPhone: string | null;
  staticQrImageUrl: string | null;
  paymentInstruction: string | null;
  capabilities?: {
    sellerQrPaymentEnabled: boolean;
    payOnDeliverySellerQrEnabled: boolean;
    depositPaymentEnabled: boolean;
    yandexCardOnDeliveryStatus: string;
    cashCourierCollectionStatus: string;
    availableMethods: string[];
    depositPercent: number | null;
    depositRequiredAboveAmount: string | null;
    codMaxOrderAmount: string | null;
  };
};
export type StockStatus =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "NOT_TRACKED";
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
  providerOrderNumber?: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  courierName?: string | null;
  courierPhone: string | null;
  estimatedDeliveryAt: string | null;
  packagePreset?: string | null;
  packageWeightGram?: number | null;
  packageLengthCm?: number | null;
  packageWidthCm?: number | null;
  packageHeightCm?: number | null;
  manualYandexOrderId?: string | null;
  yandexClaimId?: string | null;
  yandexTrackingLink?: string | null;
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

export type ShippingLabelSize = "75x120" | "100x150" | "a6";

export const DEFAULT_SHIPPING_LABEL_SIZE: ShippingLabelSize = "100x150";
export const SHIPPING_LABEL_SIZE_STORAGE_KEY = "seller-shipping-label-size";
export const SHIPPING_LABEL_SIZE_OPTIONS: ShippingLabelSize[] = [
  "75x120",
  "100x150",
  "a6",
];

export function isShippingLabelSize(
  value: string | null | undefined,
): value is ShippingLabelSize {
  return value === "75x120" || value === "100x150" || value === "a6";
}

export function normalizeShippingLabelSize(
  value: string | null | undefined,
): ShippingLabelSize {
  return isShippingLabelSize(value) ? value : DEFAULT_SHIPPING_LABEL_SIZE;
}

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
  courierName: string | null;
  courierPhone: string | null;
  estimatedDeliveryAt: string | null;
  packagePreset: string | null;
  packageWeightGram: number | null;
  packageLengthCm: number | null;
  packageWidthCm: number | null;
  packageHeightCm: number | null;
  pickupLatitude: string | null;
  pickupLongitude: string | null;
  dropoffLatitude: string | null;
  dropoffLongitude: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  manualYandexOrderId: string | null;
  yandexClaimId: string | null;
  yandexStatus: string | null;
  yandexPrice: string | null;
  yandexTrackingLink: string | null;
  deliveryNote: string | null;
  failureReasonCode: DeliveryExceptionReasonCode | string | null;
  failureReasonText: string | null;
  failedAt: string | null;
  customerVisibleMessage: string | null;
  lastAdminNote: string | null;
  lastSellerNote: string | null;
  pickupAddress: string;
  pickupAddressFullName?: string | null;
  dropoffAddress: string;
  dropoffAddressFullName?: string | null;
  dropoffCity?: string | null;
  dropoffPostalCode?: string | null;
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
  pickupGeoReadiness?: {
    hasStructuredAddress: boolean;
    hasCoordinates: boolean;
    geoPrecision: string | null;
    isYandexManualReady: boolean;
    isYandexApiReady: boolean;
    missingFields: string[];
  };
  dropoffGeoReadiness?: {
    hasStructuredAddress: boolean;
    hasCoordinates: boolean;
    geoPrecision: string | null;
    isYandexManualReady: boolean;
    isYandexApiReady: boolean;
    missingFields: string[];
  };
  yandexManualReady?: boolean;
  yandexApiReady?: boolean;
  missingCoordinateWarning?: string | null;
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

export type SellerDashboardMetrics = {
  ordersToday: number;
  revenueToday: string;
  confirmedRevenueToday: string;
  ordersThisMonth: number;
  revenueThisMonth: string;
  confirmedRevenueThisMonth: string;
  pendingPaymentOrders: number;
  deliveryInProgressOrders: number;
  commissionPercent: string;
  estimatedPlatformFeeThisMonth: string;
  billingPeriod: string;
  daysLeftInMonth: number;
};

export type SellerFinanceLedgerEntry = {
  id: string;
  orderId: string;
  orderCode: string;
  billingPeriod: string;
  productRevenueAmount: string;
  deliveryFeeAmount: string;
  commissionPercent: string;
  commissionAmount: string;
  status: string;
  source: string;
  referenceCaseId?: string | null;
  createdAt: string;
  updatedAt: string;
  invoiceId: string | null;
};

export type SellerFinanceInvoice = {
  id: string;
  sellerId: string;
  shopId: string;
  billingPeriod: string;
  totalRevenue: string;
  totalCommission: string;
  status: string;
  dueDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerWalletStatus = "active" | "frozen" | "closed";
export type BillingLedgerEntryType =
  | "credit"
  | "debit"
  | "reserve"
  | "release"
  | "refund"
  | "adjustment";

export type SellerBillingWallet = {
  id: string;
  shopId: string;
  balance: string;
  reservedBalance: string;
  availableBalance: string;
  currency: string;
  status: SellerWalletStatus | string;
  createdAt: string;
  updatedAt: string;
};

export type SellerBillingLedgerEntry = {
  id: string;
  walletId: string;
  shopId: string;
  type: BillingLedgerEntryType | string;
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  reservedBefore: string;
  reservedAfter: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  campaign: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
};

export type SellerCampaignScenarioType = "home" | "similar" | "search";
export type SellerCampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "ended"
  | "archived";
export type SellerCampaignBillingMode = "none" | "cpc" | "cpm" | "fixed";
export type SellerCampaignTargetStatus = "active" | "paused" | "removed";

export type SellerCampaignTargetProductSummary = {
  id: string;
  name: string;
  seoSlug: string | null;
  brand: string | null;
  categoryName: string | null;
  catalogStatus: string;
  visibility: string | null;
};

export type SellerCampaignTarget = {
  id: string;
  campaignId: string;
  productId: string;
  boost: string;
  status: SellerCampaignTargetStatus | string;
  createdAt: string;
  updatedAt: string;
  product: SellerCampaignTargetProductSummary;
};

export type SellerCampaign = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  status: SellerCampaignStatus | string;
  scenarioTypes: SellerCampaignScenarioType[];
  startAt: string | null;
  endAt: string | null;
  budgetLimit: string | null;
  billingMode: SellerCampaignBillingMode | string;
  maxBoost: string;
  createdAt: string;
  updatedAt: string;
  billing: {
    mode: SellerCampaignBillingMode | string;
    budgetLimit: string | null;
    chargingEnabled: boolean;
    spendTracked: boolean;
    spentAmount: string;
    remainingBudget: string | null;
    billableImpressions: number;
    billableClicks: number;
    chargedClicks: number;
    totalChargedEvents: number;
    servedAsSponsored: boolean;
    budgetExhausted: boolean;
    walletBlocked: boolean;
    cpcAmount: string;
    notes: string[];
  };
  summary: {
    totalTargets: number;
    activeTargets: number;
    pausedTargets: number;
    removedTargets: number;
  };
  targets: SellerCampaignTarget[];
};

export type SellerCampaignEvent = {
  id: string;
  type: string;
  placement: string;
  scenarioType: string | null;
  productId: string;
  productName: string;
  algorithm: string | null;
  sponsored: boolean;
  charged: boolean;
  chargeStatus: string;
  cost: string | null;
  ledgerEntryId: string | null;
  createdAt: string;
};

export type SellerCampaignPerformance = {
  campaignId: string;
  shopId: string;
  summary: {
    spentAmount: string;
    budgetLimit: string | null;
    remainingBudget: string | null;
    billableImpressions: number;
    billableClicks: number;
    chargedClicks: number;
    totalChargedEvents: number;
    totalEvents: number;
    servedAsSponsored: boolean;
    budgetExhausted: boolean;
    walletBlocked: boolean;
    cpcAmount: string;
  };
  recentEvents: SellerCampaignEvent[];
};

export type SellerOrderListItem = {
  id: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  status: SellerOrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  totalAmount: string;
  shippingCost: string;
  shippingMethodName: string | null;
  shippingAddress: string;
  dropoffAddressFullName?: string | null;
  dropoffCity?: string | null;
  dropoffPostalCode?: string | null;
  dropoffStreet?: string | null;
  dropoffBuilding?: string | null;
  dropoffEntrance?: string | null;
  dropoffNoEntrance?: boolean;
  dropoffIntercom?: string | null;
  dropoffFloor?: string | null;
  dropoffNoFloor?: boolean;
  dropoffApartment?: string | null;
  dropoffNoApartment?: boolean;
  dropoffLatitude?: string | null;
  dropoffLongitude?: string | null;
  dropoffGeoPrecision?: string | null;
  dropoffComment?: string | null;
  dropoffGeoReadiness?: {
    hasStructuredAddress: boolean;
    hasCoordinates: boolean;
    geoPrecision: string | null;
    isYandexManualReady: boolean;
    isYandexApiReady: boolean;
    missingFields: string[];
  };
  yandexManualReady?: boolean;
  yandexApiReady?: boolean;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  customerCompletedAt: string | null;
  itemsCount: number;
  sellerDisplayStatus: string;
  sellerDisplayLabel: string;
  sellerStatusBucket: SellerFulfillmentBucket;
  nextAction: string | null;
  sellerArchivedAt: string | null;
  sellerArchiveSourceStatus: string | null;
  delivery: SellerOrderDeliverySummary | null;
  paymentDetails: PaymentDetails | null;
  finance: {
    ledgerStatus: string | null;
    commissionAmount: string | null;
    invoiceStatus: string | null;
  } | null;
  latestYandexReminder?: {
    id: string;
    message: string;
    createdAt: string;
    adminName: string | null;
  } | null;
  returnRefundCases?: Array<{
    id: string;
    type: string;
    reason: string;
    status: string;
    requestedAmount: string;
    approvedAmount: string | null;
    createdAt: string;
  }>;
  supportCases: Array<{
    id: string;
    issueType: string;
    status: string;
    subject: string;
    createdAt: string;
  }>;
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
    sellerSku: string | null;
  }>;
};

export type SellerReturnRefundCase = {
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

export type SellerSupportCase = {
  id: string;
  checkoutId: string;
  checkoutCode: string;
  orderId: string | null;
  shopId: string | null;
  shopName: string | null;
  issueType: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
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

export type SellerReviewRecord = {
  id: string;
  productId: string;
  shopId: string;
  sellerId: string;
  customerId: string;
  orderId: string;
  orderItemId: string;
  rating: number;
  comment: string | null;
  fitFeedback: string | null;
  status: string;
  sellerReply: string | null;
  sellerRepliedAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: string; title: string } | null;
  shop: { id: string; name: string } | null;
  customer: { id: string; name: string | null; maskedName: string } | null;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
  } | null;
  orderItem: {
    id: string;
    productTitleSnapshot: string;
    productImageSnapshot: string | null;
    variantNameSnapshot: string | null;
    quantity: number;
  } | null;
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

export type SellerOrdersResponse = {
  items: SellerOrderListItem[];
  meta: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
  summary: Record<SellerFulfillmentBucket, number>;
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
  paymentMethodLabel?: string | null;
  paymentInstructions: string | null;
  paymentDetails: PaymentDetails;
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
  paymentProofStatus: SellerPaymentProofStatus | string;
  buyerPaymentNote: string | null;
  reviewLogs: PaymentReviewLog[];
};

export type ShopPaymentSettings = {
  shopId: string;
  paymentMode: string;
  status: string;
  bankName: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAccount: string | null;
  sbpPhone: string | null;
  staticQrImageUrl: string | null;
  paymentInstruction: string | null;
  isReady: boolean;
  usesLegacyInstructions: boolean;
  allowPrepaidQr: boolean;
  allowPayOnDeliverySellerQr: boolean;
  allowDepositPayment: boolean;
  depositPercent: number | null;
  depositRequiredAboveAmount: string | null;
  codMaxOrderAmount: string | null;
  yandexCardOnDeliveryStatus: string;
  cashCourierCollectionStatus: string;
  availableMethods: string[];
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
  catalogStatus: "IMPORTED" | "DRAFT" | "READY" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  source: "MANUAL" | "WILDBERRIES_EXCEL" | "WILDBERRIES_API";
  seoSlug: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  sourceCategorySource: string | null;
  wbVendorCode: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  reviewWarnings: string[];
  readyToPublish: boolean;
  readyToSell: boolean;
  publicVisible: boolean;
  mainImage: string | null;
  inStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  stockStatus: StockStatus;
  variantCount: number;
  primaryVariantId: string | null;
  minPrice: string | null;
  maxPrice: string | null;
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
  catalogStatus: "IMPORTED" | "DRAFT" | "READY" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  readyToSell: boolean;
  publicVisible: boolean;
  source: "MANUAL" | "WILDBERRIES_EXCEL" | "WILDBERRIES_API";
  publishedAt: string | null;
  unpublishedAt: string | null;
  archivedAt: string | null;
  seoSlug: string | null;
  wbVendorCode: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  sourceCategorySource: string | null;
  reviewWarnings: string[];
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

export type ProductReadiness = {
  productId: string;
  shopId: string;
  ready: boolean;
  blockingReasons: string[];
  catalogStatus: ProductListItem["catalogStatus"];
};

export type BulkProductVariantMode =
  | "ALL_VARIANTS"
  | "MISSING_ONLY"
  | "FIRST_VARIANT_ONLY";

export type BulkUpdateShopProductsPayload = {
  productIds: string[];
  updates: {
    categoryId?: number;
    price?: number;
    stockQuantity?: number;
    trackInventory?: boolean;
  };
  scope?: {
    variantMode?: BulkProductVariantMode;
  };
  publishIfReady?: boolean;
};

export type BulkUpdateShopProductsResponse = {
  updated: number;
  failed: number;
  items: Array<{
    productId: string;
    success: boolean;
    error: string | null;
    readiness: {
      ready: boolean;
      blockingReasons: string[];
      catalogStatus: ProductListItem["catalogStatus"];
    } | null;
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
  categoryId: string | null;
  mappedCategoryName: string | null;
  sourceCategoryName: string | null;
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
  sourceMode: "mock" | "real";
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
      brand?: string | null;
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
  connected: boolean;
  hasCredentials: boolean;
  keyLast4: string | null;
  updatedAt: string | null;
  mode: "mock" | "real";
  lastVerifiedAt: string | null;
  lastVerificationStatus: "SUCCESS" | "FAILED" | "NOT_VERIFIED";
  lastVerificationError: string | null;
  canAttemptRealVerify?: boolean;
  missingConfig?: string[];
};

export type WbConnectionVerifyResult = {
  success: true;
  mode: "mock" | "real";
  fetched: number;
  message: string;
};

export type WbDiagnosticsResult = {
  mode: "mock" | "real";
  shopId: string;
  hasCredential: boolean;
  connected: boolean;
  keyLast4: string | null;
  lastVerifiedAt: string | null;
  lastVerificationStatus: "SUCCESS" | "FAILED" | "NOT_VERIFIED";
  lastVerificationError: string | null;
  canAttemptRealVerify: boolean;
  missingConfig: string[];
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
  imageType:
    | "ORIGINAL"
    | "AI_GENERATED"
    | "MODEL_REFERENCE"
    | "FRONT"
    | "BACK"
    | "DETAIL";
  isMain: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AiTaskStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type AiTaskType =
  | "PRODUCT_MODEL_IMAGE"
  | "TRY_ON"
  | "BACKGROUND_REPLACE"
  | "DETAIL_SHOT";
export type AiStylePreset =
  | "MAIN_COVER"
  | "STUDIO"
  | "LIFESTYLE"
  | "WALKING"
  | "BACK_VIEW"
  | "DETAIL"
  | "TRY_ON";

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

export type AiRuntimeStatus = {
  shopId: string;
  workerMode: "internal-mock" | "ai-service";
  effectiveMode:
    | "INTERNAL_MOCK"
    | "AI_SERVICE_MOCK"
    | "AI_SERVICE_OPENAI_READY"
    | "AI_SERVICE_OPENAI_BLOCKED"
    | "OFFLINE";
  sellerFlowEffectiveMode:
    | "INTERNAL_MOCK"
    | "AI_SERVICE_MOCK"
    | "AI_SERVICE_OPENAI_READY"
    | "AI_SERVICE_OPENAI_BLOCKED"
    | "OFFLINE";
  supportsTaskGeneration: boolean;
  supportsTaskAttach: boolean;
  supportsCredits: boolean;
  supportsTaskRetry: boolean;
  supportsVirtualTryOn: boolean;
  tryOnReady: boolean;
  aiServiceConfigured: boolean;
  aiServiceReachable: boolean;
  aiServiceProvider: "mock" | "openai" | null;
  aiServiceStorageDriver: "mock" | "local" | "s3" | null;
  openAiConfigured: boolean;
  openAiSmokeEnabled: boolean;
  openAiRealEnabled: boolean;
  safeErrorCode: string | null;
  statusMessage: string;
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
  categoryId?: number;
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

export async function createSellerShop(
  payload: CreateShopPayload,
  token?: string,
) {
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

async function findAcrossSellerShops<T>(
  resolver: (shopId: string) => Promise<T>,
  token?: string,
) {
  const shops = await getSellerShops(token);
  let lastError: Error | null = null;

  for (const shop of shops) {
    try {
      return await resolver(shop.id);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 403 || error.status === 404)
      ) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("No accessible seller shop matched this resource.");
}

export async function getSellerDashboardMetrics(
  shopId: string,
  token?: string,
) {
  return apiRequest<SellerDashboardMetrics>(
    `/api/seller/shops/${shopId}/dashboard-metrics`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerFinanceLedger(shopId: string, token?: string) {
  return apiRequest<SellerFinanceLedgerEntry[]>(
    `/api/seller/shops/${shopId}/finance-ledger`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerFinanceInvoices(
  shopId: string,
  token?: string,
) {
  return apiRequest<SellerFinanceInvoice[]>(
    `/api/seller/shops/${shopId}/invoices`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerBillingWallet(shopId: string, token?: string) {
  return apiRequest<SellerBillingWallet>(
    `/api/seller/shops/${shopId}/billing/wallet`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerBillingLedger(shopId: string, token?: string) {
  return apiRequest<SellerBillingLedgerEntry[]>(
    `/api/seller/shops/${shopId}/billing/ledger`,
    {
      method: "GET",
      token,
    },
  );
}

export async function listSellerCampaigns(
  shopId: string,
  query?: {
    status?: SellerCampaignStatus;
    scenarioType?: SellerCampaignScenarioType;
  },
  token?: string,
) {
  const params = new URLSearchParams();
  if (query?.status) {
    params.set("status", query.status);
  }
  if (query?.scenarioType) {
    params.set("scenarioType", query.scenarioType);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";

  return apiRequest<SellerCampaign[]>(
    `/api/seller/shops/${shopId}/campaigns${suffix}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function createSellerCampaign(
  shopId: string,
  payload: {
    name: string;
    description?: string;
    status?: SellerCampaignStatus;
    scenarioTypes: SellerCampaignScenarioType[];
    startAt?: string | null;
    endAt?: string | null;
    budgetLimit?: number | null;
    billingMode?: SellerCampaignBillingMode;
    maxBoost: number;
  },
  token?: string,
) {
  return apiRequest<SellerCampaign>(`/api/seller/shops/${shopId}/campaigns`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateSellerCampaign(
  shopId: string,
  campaignId: string,
  payload: {
    name?: string;
    description?: string | null;
    status?: SellerCampaignStatus;
    scenarioTypes?: SellerCampaignScenarioType[];
    startAt?: string | null;
    endAt?: string | null;
    budgetLimit?: number | null;
    billingMode?: SellerCampaignBillingMode;
    maxBoost?: number;
  },
  token?: string,
) {
  return apiRequest<SellerCampaign>(
    `/api/seller/shops/${shopId}/campaigns/${campaignId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function archiveSellerCampaign(
  shopId: string,
  campaignId: string,
  token?: string,
) {
  return apiRequest<SellerCampaign>(
    `/api/seller/shops/${shopId}/campaigns/${campaignId}/archive`,
    {
      method: "POST",
      token,
    },
  );
}

export async function upsertSellerCampaignTarget(
  shopId: string,
  campaignId: string,
  payload: {
    productId: string;
    boost: number;
    status?: SellerCampaignTargetStatus;
  },
  token?: string,
) {
  return apiRequest<SellerCampaign>(
    `/api/seller/shops/${shopId}/campaigns/${campaignId}/targets`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function removeSellerCampaignTarget(
  shopId: string,
  campaignId: string,
  targetId: string,
  token?: string,
) {
  return apiRequest<SellerCampaign>(
    `/api/seller/shops/${shopId}/campaigns/${campaignId}/targets/${targetId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function getSellerCampaignPerformance(
  shopId: string,
  campaignId: string,
  token?: string,
) {
  return apiRequest<SellerCampaignPerformance>(
    `/api/seller/shops/${shopId}/campaigns/${campaignId}/performance`,
    {
      method: "GET",
      token,
    },
  );
}

export async function listSellerCampaignEvents(
  shopId: string,
  campaignId: string,
  token?: string,
) {
  return apiRequest<SellerCampaignEvent[]>(
    `/api/seller/shops/${shopId}/campaigns/${campaignId}/events`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getShopProducts(
  shopId: string,
  query: {
    page: number;
    size: number;
    search?: string;
    status?: string;
    stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
    catalogStatus?: ProductListItem["catalogStatus"];
    visibility?: string;
    source?: ProductListItem["source"];
    missingPrice?: boolean;
    missingStock?: boolean;
    missingCategory?: boolean;
    missingImage?: boolean;
    readyToPublish?: boolean;
    needsReview?: boolean;
    published?: boolean;
    publicVisible?: boolean;
    sort?: "updatedAt_desc" | "updatedAt_asc" | "title_asc" | "title_desc";
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
  if (query.visibility) {
    params.set("visibility", query.visibility);
  }
  if (query.stockStatus) {
    params.set("stockStatus", query.stockStatus);
  }
  if (query.catalogStatus) {
    params.set("catalogStatus", query.catalogStatus);
  }
  if (query.source) {
    params.set("source", query.source);
  }
  if (query.missingPrice) {
    params.set("missingPrice", "true");
  }
  if (query.missingStock) {
    params.set("missingStock", "true");
  }
  if (query.missingCategory) {
    params.set("missingCategory", "true");
  }
  if (query.missingImage) {
    params.set("missingImage", "true");
  }
  if (query.readyToPublish) {
    params.set("readyToPublish", "true");
  }
  if (query.needsReview) {
    params.set("needsReview", "true");
  }
  if (query.published) {
    params.set("published", "true");
  }
  if (query.publicVisible) {
    params.set("publicVisible", "true");
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }

  return apiRequest<ProductListResponse>(
    `/api/shops/${shopId}/products?${params.toString()}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function createShopProduct(
  shopId: string,
  payload: CreateProductPayload,
  token?: string,
) {
  return apiRequest<ProductDetail>(`/api/shops/${shopId}/products`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getShopProductById(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductDetail>(
    `/api/shops/${shopId}/products/${productId}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerProductById(
  productId: string,
  token?: string,
) {
  return findAcrossSellerShops(
    (shopId) => getShopProductById(shopId, productId, token),
    token,
  );
}

export async function updateShopProduct(
  shopId: string,
  productId: string,
  payload: UpdateProductPayload,
  token?: string,
) {
  return apiRequest<ProductDetail>(
    `/api/shops/${shopId}/products/${productId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
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

export async function getSellerProductInventory(
  productId: string,
  token?: string,
) {
  return findAcrossSellerShops(
    (shopId) => getShopProductInventory(shopId, productId, token),
    token,
  );
}

export async function getShopProductReadiness(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductReadiness>(
    `/api/shops/${shopId}/products/${productId}/readiness`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerProductReadiness(
  productId: string,
  token?: string,
) {
  return findAcrossSellerShops(
    (shopId) => getShopProductReadiness(shopId, productId, token),
    token,
  );
}

export async function publishShopProduct(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductDetail>(
    `/api/shops/${shopId}/products/${productId}/publish`,
    {
      method: "POST",
      token,
    },
  );
}

export async function unpublishShopProduct(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductDetail>(
    `/api/shops/${shopId}/products/${productId}/unpublish`,
    {
      method: "POST",
      token,
    },
  );
}

export async function archiveShopProduct(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductDetail>(
    `/api/shops/${shopId}/products/${productId}/archive`,
    {
      method: "POST",
      token,
    },
  );
}

export async function deleteShopProduct(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<{ success: boolean }>(
    `/api/shops/${shopId}/products/${productId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function bulkShopProductAction(
  shopId: string,
  payload: {
    productIds: string[];
    action: "PUBLISH" | "UNPUBLISH" | "ARCHIVE";
    updates?: {
      categoryId?: number;
      categoryName?: string;
      variants?: Array<{
        chrtId: number;
        basePrice?: number;
        discountPrice?: number;
        stockQuantity?: number;
      }>;
    };
  },
  token?: string,
) {
  return apiRequest<{
    action: string;
    total: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      productId: string;
      success: boolean;
      action: string;
      blockingReasons?: string[];
      error?: string;
    }>;
  }>(`/api/shops/${shopId}/products/bulk`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function bulkUpdateShopProducts(
  shopId: string,
  payload: BulkUpdateShopProductsPayload,
  token?: string,
) {
  return apiRequest<BulkUpdateShopProductsResponse>(
    `/api/shops/${shopId}/products/bulk-update`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
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
  formData.append(
    "defaultStockQuantity",
    String(input.defaultStockQuantity ?? 0),
  );
  formData.append("publishMode", input.publishMode ?? "DRAFT");
  formData.append("imageMode", input.imageMode ?? "REMOTE_URL");
  if (input.priceFallback !== undefined) {
    formData.append("priceFallback", String(input.priceFallback));
  }

  return apiRequest<WbImportPreview>(
    `/api/shops/${shopId}/imports/wildberries/preview`,
    {
      method: "POST",
      token,
      body: formData,
    },
  );
}

export async function confirmWildberriesImport(
  shopId: string,
  importId: string,
  token?: string,
) {
  return apiRequest<WbImportConfirmResult>(
    `/api/shops/${shopId}/imports/wildberries/confirm`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ importId }),
    },
  );
}

export async function getWildberriesImportStatus(
  shopId: string,
  importId: string,
  token?: string,
) {
  return apiRequest<WbImportStatus>(
    `/api/shops/${shopId}/imports/wildberries/${importId}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getWbSyncCredentialsStatus(
  shopId: string,
  token?: string,
) {
  return apiRequest<WbCredentialsStatus>(
    `/api/shops/${shopId}/wb-sync/credentials/status`,
    {
      method: "GET",
      token,
    },
  );
}

export async function saveWbSyncCredentials(
  shopId: string,
  apiKey: string,
  token?: string,
) {
  return apiRequest<WbCredentialsStatus>(
    `/api/shops/${shopId}/wb-sync/credentials`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ apiKey }),
    },
  );
}

export async function verifyWbSyncCredentials(
  shopId: string,
  token?: string,
) {
  return apiRequest<WbConnectionVerifyResult>(
    `/api/shops/${shopId}/wb-sync/credentials/verify`,
    {
      method: "POST",
      token,
    },
  );
}

export async function deleteWbSyncCredentials(
  shopId: string,
  token?: string,
) {
  return apiRequest<{
    success: boolean;
    shopId: string;
    connected: boolean;
    keyLast4: string | null;
    lastVerifiedAt: string | null;
    lastVerificationStatus: "SUCCESS" | "FAILED" | "NOT_VERIFIED";
    lastVerificationError: string | null;
    mode: "mock" | "real";
  }>(
    `/api/shops/${shopId}/wb-sync/credentials`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function getWbSyncDiagnostics(
  shopId: string,
  token?: string,
) {
  return apiRequest<WbDiagnosticsResult>(
    `/api/shops/${shopId}/wb-sync/diagnostics`,
    {
      method: "GET",
      token,
    },
  );
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
  return apiRequest<WbSyncRun>(
    `/api/shops/${shopId}/wb-sync/products/by-article`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function getShopProductImages(
  shopId: string,
  productId: string,
  token?: string,
) {
  return apiRequest<ProductImage[]>(
    `/api/shops/${shopId}/products/${productId}/images`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerProductImages(
  productId: string,
  token?: string,
) {
  return findAcrossSellerShops(
    (shopId) => getShopProductImages(shopId, productId, token),
    token,
  );
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

  return apiRequest<ProductImage[]>(
    `/api/shops/${shopId}/products/${productId}/images`,
    {
      method: "POST",
      token,
      body: formData,
    },
  );
}

export async function deleteShopProductImage(
  shopId: string,
  productId: string,
  imageId: string,
  token?: string,
) {
  return apiRequest<void>(
    `/api/shops/${shopId}/products/${productId}/images/${imageId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function updateShopProductImage(
  shopId: string,
  productId: string,
  imageId: string,
  payload: Partial<Pick<ProductImage, "isMain" | "sortOrder" | "imageType">>,
  token?: string,
) {
  return apiRequest<ProductImage>(
    `/api/shops/${shopId}/products/${productId}/images/${imageId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function createShopAiImageTask(
  shopId: string,
  productId: string,
  payload: CreateAiImageTaskPayload,
  token?: string,
) {
  return apiRequest<AiImageTask>(
    `/api/shops/${shopId}/products/${productId}/ai-images/tasks`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function getAiCredits(shopId: string, token?: string) {
  return apiRequest<AiCredits>(`/api/shops/${shopId}/ai-credits`, {
    method: "GET",
    token,
  });
}

export async function getAiRuntimeStatus(shopId: string, token?: string) {
  return apiRequest<AiRuntimeStatus>(`/api/shops/${shopId}/ai-images/runtime`, {
    method: "GET",
    token,
  });
}

export const createAiImageTask = createShopAiImageTask;
export const getAiCreditsStatus = getAiCredits;

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

  return apiRequest<AiImageTask[]>(
    `/api/shops/${shopId}/ai-images/tasks?${params.toString()}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getShopAiImageTaskById(
  shopId: string,
  taskId: string,
  token?: string,
) {
  return apiRequest<AiImageTask>(
    `/api/shops/${shopId}/ai-images/tasks/${taskId}`,
    {
      method: "GET",
      token,
    },
  );
}

export const getAiImageTask = getShopAiImageTaskById;
export const listAiImageTasks = getShopAiImageTasks;
export const getAiImageTaskById = getShopAiImageTaskById;

export async function attachAiGeneratedImageToProduct(
  shopId: string,
  productId: string,
  generatedImageId: string,
  token?: string,
) {
  return apiRequest<ProductImage>(
    `/api/shops/${shopId}/products/${productId}/ai-images/${generatedImageId}/attach`,
    {
      method: "POST",
      token,
    },
  );
}

export const attachGeneratedImage = attachAiGeneratedImageToProduct;
export const attachAiGeneratedImage = attachAiGeneratedImageToProduct;

export async function getShopOrders(
  shopId: string,
  query: {
    page: number;
    size: number;
    search?: string;
    q?: string;
    status?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: "createdAt_desc" | "createdAt_asc";
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
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.paymentStatus) {
    params.set("paymentStatus", query.paymentStatus);
  }
  if (query.deliveryStatus) {
    params.set("deliveryStatus", query.deliveryStatus);
  }
  if (query.dateFrom) {
    params.set("dateFrom", query.dateFrom);
  }
  if (query.dateTo) {
    params.set("dateTo", query.dateTo);
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }

  return apiRequest<SellerOrdersResponse>(
    `/api/shops/${shopId}/orders?${params.toString()}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getShopOrderById(
  shopId: string,
  orderId: string,
  token?: string,
) {
  return apiRequest<SellerOrderListItem>(
    `/api/shops/${shopId}/orders/${orderId}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerOrderById(
  orderId: string,
  token?: string,
) {
  return findAcrossSellerShops(
    (shopId) => getShopOrderById(shopId, orderId, token),
    token,
  );
}

export async function listPayments(
  shopId: string,
  query: {
    page: number;
    size: number;
    search?: string;
    status?: string;
    proofStatus?: string;
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
  if (query.proofStatus) {
    params.set("proofStatus", query.proofStatus);
  }

  return apiRequest<SellerPaymentsResponse>(
    `/api/shops/${shopId}/payments?${params.toString()}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getPaymentDetail(
  shopId: string,
  orderId: string,
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(
    `/api/shops/${shopId}/payments/${orderId}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getSellerPaymentDetail(
  orderId: string,
  token?: string,
) {
  return findAcrossSellerShops(
    (shopId) => getPaymentDetail(shopId, orderId, token),
    token,
  );
}

export async function markPaymentPaid(
  shopId: string,
  orderId: string,
  payload?: { note?: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(
    `/api/shops/${shopId}/payments/${orderId}/mark-paid`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function confirmPayment(
  shopId: string,
  orderId: string,
  payload?: { note?: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(
    `/api/shops/${shopId}/payments/${orderId}/confirm`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function rejectPayment(
  shopId: string,
  orderId: string,
  payload?: { note?: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(
    `/api/shops/${shopId}/payments/${orderId}/reject`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function addPaymentNote(
  shopId: string,
  orderId: string,
  payload: { note: string },
  token?: string,
) {
  return apiRequest<SellerPaymentItem>(
    `/api/shops/${shopId}/payments/${orderId}/notes`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function getShopPaymentSettings(shopId: string, token?: string) {
  return apiRequest<ShopPaymentSettings>(
    `/api/shops/${shopId}/payment-settings`,
    {
      method: "GET",
      token,
    },
  );
}

export async function updateShopPaymentSettings(
  shopId: string,
  payload: {
    paymentMode?: "STATIC_QR";
    status?: "READY" | "DISABLED" | "PENDING_REVIEW";
    bankName?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientAccount?: string;
    sbpPhone?: string;
    paymentInstruction?: string;
    allowPrepaidQr?: boolean;
    allowPayOnDeliverySellerQr?: boolean;
    allowDepositPayment?: boolean;
    depositPercent?: number | null;
    depositRequiredAboveAmount?: number | null;
    codMaxOrderAmount?: number | null;
    yandexCardOnDeliveryStatus?:
      | "NOT_CONFIGURED"
      | "PROVIDER_PENDING"
      | "AVAILABLE"
      | "DISABLED";
    cashCourierCollectionStatus?: "NOT_AVAILABLE" | "DISABLED";
  },
  token?: string,
) {
  return apiRequest<ShopPaymentSettings>(
    `/api/shops/${shopId}/payment-settings`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function uploadShopPaymentQr(
  shopId: string,
  file: File,
  token?: string,
) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<ShopPaymentSettings>(
    `/api/shops/${shopId}/payment-settings/qr-image`,
    {
      method: "POST",
      token,
      body: formData,
    },
  );
}

export async function deleteShopPaymentQr(
  shopId: string,
  token?: string,
) {
  return apiRequest<ShopPaymentSettings>(
    `/api/shops/${shopId}/payment-settings/qr-image`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function updateShopOrderStatus(
  shopId: string,
  orderId: string,
  status: SellerOrderStatus,
  token?: string,
) {
  return apiRequest<SellerOrderListItem>(
    `/api/shops/${shopId}/orders/${orderId}/status`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    },
  );
}

export async function archiveShopOrder(
  shopId: string,
  orderId: string,
  token?: string,
) {
  return apiRequest<SellerOrderListItem>(
    `/api/shops/${shopId}/orders/${orderId}/archive`,
    {
      method: "POST",
      token,
      body: JSON.stringify({}),
    },
  );
}

export async function getDeliverySettings(shopId: string, token?: string) {
  return apiRequest<DeliverySettings>(
    `/api/shops/${shopId}/delivery/settings`,
    {
      method: "GET",
      token,
    },
  );
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
  return apiRequest<DeliverySettings>(
    `/api/shops/${shopId}/delivery/settings`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
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
  manualYandexOrderId?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  estimatedDeliveryAt?: string | null;
  packagePreset?: string | null;
  packageWeightGram?: number | null;
  packageLengthCm?: number | null;
  packageWidthCm?: number | null;
  packageHeightCm?: number | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryPrice?: number | null;
  yandexClaimId?: string | null;
  yandexStatus?: string | null;
  yandexTrackingLink?: string | null;
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
  payload?: { note?: string | null; courierName?: string | null; courierPhone?: string | null; estimatedDeliveryAt?: string | null },
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

export async function markManualDeliveryCourierAssigned(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload?: { note?: string | null; courierName?: string | null; courierPhone?: string | null; estimatedDeliveryAt?: string | null },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/mark-courier-assigned`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function markManualDeliveryPickedUp(
  shopId: string,
  orderId: string,
  shipmentId: string,
  payload?: { note?: string | null; courierName?: string | null; courierPhone?: string | null; estimatedDeliveryAt?: string | null },
  token?: string,
) {
  return apiRequest<DeliveryShipment>(
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipmentId}/mark-picked-up`,
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

export async function listShopSupportCases(shopId: string, token?: string) {
  return apiRequest<{ items: SellerSupportCase[] }>(`/api/shops/${shopId}/support-cases`, {
    method: "GET",
    token,
  });
}

export async function getShopSupportCase(shopId: string, caseId: string, token?: string) {
  return apiRequest<SellerSupportCase>(`/api/shops/${shopId}/support-cases/${encodeURIComponent(caseId)}`, {
    method: "GET",
    token,
  });
}

export async function addShopSupportCaseMessage(shopId: string, caseId: string, message: string, token?: string) {
  return apiRequest<SellerSupportCase>(`/api/shops/${shopId}/support-cases/${encodeURIComponent(caseId)}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
  });
}

export async function listShopReturnRefundCases(
  shopId: string,
  query?: {
    status?: string;
    reason?: string;
    q?: string;
  },
  token?: string,
) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.reason) params.set("reason", query.reason);
  if (query?.q) params.set("q", query.q);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ items: SellerReturnRefundCase[] }>(`/api/shops/${shopId}/returns${suffix}`, {
    method: "GET",
    token,
  });
}

export async function getShopReturnRefundCase(shopId: string, caseId: string, token?: string) {
  return apiRequest<SellerReturnRefundCase>(`/api/shops/${shopId}/returns/${encodeURIComponent(caseId)}`, {
    method: "GET",
    token,
  });
}

export async function respondShopReturnRefundCase(
  shopId: string,
  caseId: string,
  payload: { action: "ACCEPT" | "REJECT" | "REQUEST_EVIDENCE" | "ESCALATE_ADMIN"; sellerComment?: string },
  token?: string,
) {
  return apiRequest<SellerReturnRefundCase>(`/api/shops/${shopId}/returns/${encodeURIComponent(caseId)}/respond`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function markShopReturnReceived(shopId: string, caseId: string, token?: string) {
  return apiRequest<SellerReturnRefundCase>(`/api/shops/${shopId}/returns/${encodeURIComponent(caseId)}/mark-return-received`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
}

export async function markShopRefundSent(
  shopId: string,
  caseId: string,
  payload: {
    amount: number;
    method: "SBP" | "BANK_TRANSFER" | "CASH" | "OTHER";
    bankReference?: string;
    note?: string;
    file?: File | null;
  },
  token?: string,
) {
  const formData = new FormData();
  formData.append("amount", String(payload.amount));
  formData.append("method", payload.method);
  if (payload.bankReference?.trim()) {
    formData.append("bankReference", payload.bankReference.trim());
  }
  if (payload.note?.trim()) {
    formData.append("note", payload.note.trim());
  }
  if (payload.file) {
    formData.append("file", payload.file);
  }
  return apiRequest<SellerReturnRefundCase>(`/api/shops/${shopId}/returns/${encodeURIComponent(caseId)}/refund-sent`, {
    method: "POST",
    token,
    body: formData,
  });
}

export async function addShopReturnRefundMessage(shopId: string, caseId: string, message: string, token?: string) {
  return apiRequest<SellerReturnRefundCase>(`/api/shops/${shopId}/returns/${encodeURIComponent(caseId)}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
  });
}

export async function listShopReviews(
  shopId: string,
  query?: {
    productId?: string;
    rating?: number;
    status?: string;
    q?: string;
  },
  token?: string,
) {
  const params = new URLSearchParams();
  if (query?.productId) params.set("productId", query.productId);
  if (query?.rating) params.set("rating", String(query.rating));
  if (query?.status) params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  const suffix = params.toString() ? `?${params.toString()}` : "";

  return apiRequest<{ items: SellerReviewRecord[] }>(
    `/api/shops/${shopId}/reviews${suffix}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function replyToShopReview(
  shopId: string,
  reviewId: string,
  payload: { reply: string },
  token?: string,
) {
  return apiRequest<SellerReviewRecord>(
    `/api/shops/${shopId}/reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}
