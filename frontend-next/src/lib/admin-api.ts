import { API_URL, apiRequest } from "@/lib/api";
import type { SellerDocument, SellerOnboardingProfile } from "@/lib/seller-onboarding-api";
import type {
  DeliveryCommentVisibility,
  DeliveryExceptionReasonCode,
  PaymentDetails,
  SellerPaymentItem,
} from "@/lib/seller-api";

export type SellerApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AdminSeller = {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  sellerApprovalStatus: SellerApprovalStatus;
  sellerApprovedAt: string | null;
  sellerRejectedAt: string | null;
  sellerRejectionReason: string | null;
  createdAt: string;
  onboardingStatus?: string;
  kycStatus?: string;
  shopCount?: number;
  activeShopCount?: number;
  revenueThisMonth?: string;
  pendingPlatformFees?: string;
  currentShopId?: string | null;
  primaryShopName?: string | null;
};

export type AdminSellerListResponse = {
  items: AdminSeller[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

export type AdminSellerDetail = AdminSeller & {
  contactPhone: string | null;
  contactEmail: string | null;
  shops: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    paymentConfigStatus: string;
    allowPrepaidQr: boolean;
    allowPayOnDeliverySellerQr: boolean;
    allowDepositPayment: boolean;
    confirmedRevenueThisMonth: string;
    pendingPlatformFees: string;
  }>;
  financeSummary: {
    revenueThisMonth: string;
    pendingPlatformFees: string;
  };
  recentOrders: Array<{
    id: string;
    orderCode: string;
    shopId: string;
    shopName: string;
    status: string;
    paymentStatus: string;
    totalAmount: string;
    createdAt: string;
  }>;
};

export type AdminSellerOnboarding = {
  seller: AdminSeller;
  profile: SellerOnboardingProfile;
};

export type AdminAuditLog = {
  id: string;
  actorUserId: string;
  targetUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValueJson: unknown;
  newValueJson: unknown;
  reason: string | null;
  createdAt: string;
};

export type AdminDeliveryRow = {
  kind: "SHIPMENT" | "PAID_WITHOUT_DELIVERY";
  id: string;
  deliveryShipmentId: string | null;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  sellerId: string;
  sellerEmail: string;
  sellerName: string | null;
  sellerPhone?: string | null;
  orderStatus: string;
  paymentStatus: string;
  timeWaitingMinutes?: number;
  totalAmount: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
  };
  provider: string | null;
  providerShipmentId: string | null;
  providerOrderNumber: string | null;
  providerStatus: string;
  internalStatus: string;
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
  deliveryNote: string | null;
  failureReasonCode: string | null;
  failureReasonText: string | null;
  failedAt: string | null;
  customerVisibleMessage: string | null;
  lastAdminNote: string | null;
  lastSellerNote: string | null;
  pickupAddress: string | null;
  pickupLatitude: string | null;
  pickupLongitude: string | null;
  dropoffLatitude: string | null;
  dropoffLongitude: string | null;
  pickupGeoReadiness?: {
    hasStructuredAddress: boolean;
    hasCoordinates: boolean;
    geoPrecision: string | null;
    isYandexManualReady: boolean;
    isYandexApiReady: boolean;
    missingFields: string[];
  } | null;
  dropoffGeoReadiness?: {
    hasStructuredAddress: boolean;
    hasCoordinates: boolean;
    geoPrecision: string | null;
    isYandexManualReady: boolean;
    isYandexApiReady: boolean;
    missingFields: string[];
  } | null;
  yandexManualReady?: boolean;
  yandexApiReady?: boolean;
  recipientName: string | null;
  recipientPhone: string | null;
  manualYandexOrderId: string | null;
  yandexClaimId: string | null;
  yandexStatus: string | null;
  yandexPrice: string | null;
  yandexTrackingLink: string | null;
  lastReminderAt?: string | null;
  lastReminderMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  events: Array<{
    id: string;
    eventType: string;
    actorUserId: string | null;
    actorRole: string | null;
    action: string | null;
    oldStatus: string | null;
    newStatus: string | null;
    providerStatus: string | null;
    message: string | null;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    actorUserId: string | null;
    actorRole: string;
    visibility: string;
    message: string;
    createdAt: string;
  }>;
};

export type AdminFulfillmentBucket =
  | "ALL"
  | "NEW"
  | "ASSEMBLING"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type AdminFulfillmentAction = "VIEW" | "REMIND_SELLER";

export type AdminFulfillmentRow = {
  orderId: string;
  orderCode: string;
  sellerId: string;
  sellerName: string | null;
  sellerEmail: string;
  sellerPhone: string | null;
  shopId: string;
  shopName: string;
  customerName: string;
  customerPhone: string;
  customer: {
    name: string;
    phone: string;
  };
  paymentMethod: string | null;
  paymentStatus: string;
  fulfillmentBucket: Exclude<AdminFulfillmentBucket, "ALL">;
  fulfillmentLabel: string;
  deliveryStatus: string | null;
  deliveryShipmentId: string | null;
  manualYandexOrderId: string | null;
  yandexTrackingUrl: string | null;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
  sellerArchivedAt: string | null;
  isOverdue: boolean;
  ageMinutes: number;
  lastReminderAt: string | null;
  nextAdminActions: AdminFulfillmentAction[];
  items: Array<{
    id: string;
    productTitleSnapshot: string;
    quantity: number;
  }>;
};

export type AdminFulfillmentResponse = {
  items: AdminFulfillmentRow[];
  meta: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
  summary: Record<AdminFulfillmentBucket, number>;
};

export type AdminDashboardSummary = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    shopId: string | null;
    sellerId: string | null;
    defaultRange: string;
  };
  orders: {
    total: number;
    pending: number;
    paid: number;
    paidWithoutDelivery: number;
    inTransit: number;
    delivered: number;
    cancelled: number;
  };
  payments: {
    pending: number;
    paid: number;
    rejected: number;
  };
  deliveries: {
    notCreated: number;
    created: number;
    inTransit: number;
    delivered: number;
    deliveredToday: number;
    deliveredThisWeek: number;
    failed: number;
    cancelled: number;
    exceptions: number;
  };
  inventory: {
    outOfStock: number;
    lowStock: number;
  };
  sellers: {
    pending: number;
    approved: number;
    rejected: number;
    withPaidOrdersWithoutDelivery: number;
  };
  recent: {
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      totalAmount: string;
      customerName: string;
      shopId: string;
      shopName: string;
      createdAt: string;
    }>;
    paymentReviews: Array<{
      id: string;
      action: string;
      fromStatus: string | null;
      toStatus: string | null;
      note: string | null;
      orderId: string;
      orderNumber: string;
      shopId: string;
      shopName: string;
      createdAt: string;
    }>;
    deliveryExceptions: Array<{
      id: string;
      orderId: string;
      orderNumber: string;
      customerName: string;
      shopId: string;
      shopName: string;
      status: string;
      reasonCode: string | null;
      customerVisibleMessage: string | null;
      updatedAt: string;
    }>;
    auditLogs: Array<{
      id: string;
      actorUserId: string;
      targetUserId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      reason: string | null;
      createdAt: string;
    }>;
  };
};

export type AdminQueueSlaStatus = "OK" | "WARNING" | "BREACHED";

export type AdminQueueResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total: number;
  filters: Record<string, unknown>;
  summary: Record<string, number>;
};

export type AdminQueueItem = {
  id: string;
  entityType: "SELLER" | "PAYMENT" | "DELIVERY" | "INVENTORY" | "ORDER";
  entityId: string;
  shopId: string | null;
  shopName: string | null;
  sellerId: string;
  sellerEmail: string;
  sellerName?: string | null;
  orderCode?: string;
  productId?: string;
  productName?: string;
  customerName?: string;
  status: string;
  orderStatus?: string;
  deliveryStatus?: string;
  provider?: string | null;
  reasonCode?: string | null;
  stockQuantity?: number;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
  ageMinutes: number;
  ageHours: number;
  slaStatus: AdminQueueSlaStatus;
  actionUrl: string;
  taskId: string | null;
  taskStatus: string | null;
  taskPriority: string | null;
  assignedToUserId: string | null;
  assignedToEmail: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
};

export type AdminQueueTask = {
  id: string;
  entityType: string;
  entityId: string;
  shopId: string | null;
  sellerId: string | null;
  assignedToUserId: string | null;
  assignedToEmail: string | null;
  assignedToName: string | null;
  status: string;
  priority: string;
  slaStatus: string;
  title: string;
  summary: string | null;
  lastNote: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
};

export type AdminQueueTaskEvent = {
  id: string;
  taskId: string;
  actorUserId: string;
  actorEmail: string;
  actorName: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromAssigneeId: string | null;
  toAssigneeId: string | null;
  note: string | null;
  createdAt: string;
};

export type AdminReportResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total: number;
  filters: Record<string, unknown>;
};

export type AdminOpsSummaryReport = {
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  escalatedTasks: number;
  resolvedTasks: number;
  breachedTasks: number;
  averageResolutionHours: number;
  pendingPayments: number;
  paidWithoutDelivery: number;
  deliveryExceptions: number;
  lowStockProducts: number;
  outOfStockProducts: number;
};

export type AdminSlaBreachReportRow = {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  status: string;
  priority: string;
  slaStatus: string;
  assignedToEmail: string | null;
  ageHours: number;
  createdAt: string;
  updatedAt: string;
  actionUrl: string;
};

export type AdminWorkloadReportRow = {
  adminUserId: string;
  adminEmail: string;
  adminName: string | null;
  assignedTasks: number;
  openTasks: number;
  inProgressTasks: number;
  escalatedTasks: number;
  resolvedTasks: number;
  averageResolutionHours: number;
};

export type SupportCaseMessage = {
  id: string;
  senderUserId: string | null;
  senderRole: string;
  senderName: string | null;
  message: string;
  isInternal: boolean;
  createdAt: string;
};

export type SupportCaseDetail = {
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
  messages: SupportCaseMessage[];
  events?: Array<{
    id: string;
    actorUserId: string | null;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type AdminDeliveryExceptionReportRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  shopName: string;
  sellerEmail: string;
  provider: string;
  status: string;
  reasonCode: string | null;
  reasonText: string | null;
  customerVisibleMessage: string | null;
  ageHours: number;
  updatedAt: string;
  actionUrl: string;
};

export type AdminPaymentAgingReportRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  shopName: string;
  sellerEmail: string;
  paymentStatus: string;
  totalAmount: string;
  ageHours: number;
  ageBucket: string;
  updatedAt: string;
  actionUrl: string;
};

export type AdminPaymentSupervisionRow = SellerPaymentItem & {
  paymentDetails: PaymentDetails;
  paymentMethodLabel?: string | null;
  sellerId?: string;
  sellerName?: string | null;
  sellerEmail?: string | null;
  ledgerStatus?: string | null;
  ledgerCommissionAmount?: string | null;
  ledgerInvoiceStatus?: string | null;
  activeReturnRefundCase?: {
    id: string;
    type: string;
    reason: string;
    status: string;
    requestedAmount: string;
    approvedAmount: string | null;
    createdAt: string;
  } | null;
};

export type AdminSellerFeeRow = {
  shopId: string;
  shopName: string;
  sellerName: string | null;
  sellerEmail: string;
  sellerPhone: string | null;
  ordersToday: number;
  revenueToday: string;
  ordersThisMonth: number;
  revenueThisMonth: string;
  confirmedRevenueThisMonth: string;
  commissionPercent: string;
  platformFeeDue: string;
  billingPeriod: string;
  daysLeftInMonth: number;
  invoiceStatus: string | null;
};

export type AdminSellerFeeInvoice = {
  id: string;
  sellerId: string;
  shopId: string;
  shopName: string;
  sellerName: string | null;
  sellerEmail: string;
  sellerPhone: string | null;
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

export type AdminReturnRefundCase = {
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

export type AdminReviewRecord = {
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
};

export async function getAdminDashboardSummary(query?: {
  dateFrom?: string;
  dateTo?: string;
  shopId?: string;
  sellerId?: string;
}) {
  const params = new URLSearchParams();
  if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query?.dateTo) params.set("dateTo", query.dateTo);
  if (query?.shopId) params.set("shopId", query.shopId);
  if (query?.sellerId) params.set("sellerId", query.sellerId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminDashboardSummary>(`/api/admin/dashboard/summary${suffix}`, {
    method: "GET",
  });
}

function queueSuffix(query?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString() ? `?${params.toString()}` : "";
}

function reportSuffix(query?: Record<string, string | number | undefined>) {
  return queueSuffix(query);
}

export function adminReportCsvUrl(report: "sla-breaches" | "workload" | "delivery-exceptions" | "payment-aging", query?: Record<string, string | number | undefined>) {
  return `${API_URL}/api/admin/reports/${report}.csv${reportSuffix(query)}`;
}

export async function getAdminOpsSummaryReport(query?: {
  dateFrom?: string;
  dateTo?: string;
  shopId?: string;
  sellerId?: string;
  assignedToUserId?: string;
}) {
  return apiRequest<AdminOpsSummaryReport>(`/api/admin/reports/ops-summary${reportSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminSlaBreachesReport(query?: {
  dateFrom?: string;
  dateTo?: string;
  entityType?: string;
  assignedToUserId?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminReportResponse<AdminSlaBreachReportRow>>(`/api/admin/reports/sla-breaches${reportSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminWorkloadReport(query?: { dateFrom?: string; dateTo?: string }) {
  return apiRequest<{ filters: Record<string, unknown>; items: AdminWorkloadReportRow[] }>(`/api/admin/reports/workload${reportSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminDeliveryExceptionsReport(query?: {
  dateFrom?: string;
  dateTo?: string;
  provider?: string;
  reasonCode?: string;
  shopId?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminReportResponse<AdminDeliveryExceptionReportRow>>(`/api/admin/reports/delivery-exceptions${reportSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminPaymentAgingReport(query?: {
  dateFrom?: string;
  dateTo?: string;
  ageBucket?: string;
  shopId?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminReportResponse<AdminPaymentAgingReportRow>>(`/api/admin/reports/payment-aging${reportSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminPayments(query?: {
  status?: string;
  proofStatus?: string;
  shopId?: string;
  page?: number;
  size?: number;
}) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.proofStatus) params.set("proofStatus", query.proofStatus);
  if (query?.shopId) params.set("shopId", query.shopId);
  if (query?.page) params.set("page", String(query.page));
  if (query?.size) params.set("size", String(query.size));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ items: AdminPaymentSupervisionRow[]; meta: { page: number; size: number; total: number; totalPages: number } }>(
    `/api/admin/payments${suffix}`,
    {
      method: "GET",
    },
  );
}

export async function listAdminSellerFees() {
  return apiRequest<AdminSellerFeeRow[]>("/api/admin/finance/seller-fees", {
    method: "GET",
  });
}

export async function updateAdminShopCommission(
  shopId: string,
  payload: { commissionPercent: number },
) {
  return apiRequest<{
    shopId: string;
    shopName: string;
    commissionPercent: string;
    activeFrom: string;
  }>(`/api/admin/finance/shops/${shopId}/commission`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function generateAdminSellerFeeInvoice(
  shopId: string,
  payload: { billingPeriod: string },
) {
  return apiRequest<AdminSellerFeeInvoice>(
    `/api/admin/finance/shops/${shopId}/invoices/generate`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function markAdminSellerFeeInvoicePaid(invoiceId: string) {
  return apiRequest<AdminSellerFeeInvoice>(
    `/api/admin/finance/invoices/${invoiceId}/mark-paid`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function listAdminSellerFeeInvoices() {
  return apiRequest<AdminSellerFeeInvoice[]>("/api/admin/finance/invoices", {
    method: "GET",
  });
}

export async function getAdminPayment(orderId: string) {
  return apiRequest<AdminPaymentSupervisionRow>(`/api/admin/payments/${orderId}`, {
    method: "GET",
  });
}

export async function adminConfirmPayment(orderId: string, payload?: { note?: string }) {
  return apiRequest<AdminPaymentSupervisionRow>(`/api/admin/payments/${orderId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function adminRejectPayment(orderId: string, payload?: { note?: string }) {
  return apiRequest<AdminPaymentSupervisionRow>(`/api/admin/payments/${orderId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function listAdminQueueSellers(query?: {
  status?: string;
  q?: string;
  ageBucket?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminQueueResponse<AdminQueueItem>>(`/api/admin/queues/sellers${queueSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminQueuePayments(query?: {
  status?: string;
  ageBucket?: string;
  shopId?: string;
  sellerId?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminQueueResponse<AdminQueueItem>>(`/api/admin/queues/payments${queueSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminQueueDeliveries(query?: {
  queueType?: string;
  provider?: string;
  ageBucket?: string;
  shopId?: string;
  sellerId?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminQueueResponse<AdminQueueItem>>(`/api/admin/queues/deliveries${queueSuffix(query)}`, {
    method: "GET",
  });
}

export async function listAdminQueueInventory(query?: {
  stockStatus?: string;
  shopId?: string;
  sellerId?: string;
  page?: number;
  limit?: number;
}) {
  return apiRequest<AdminQueueResponse<AdminQueueItem>>(`/api/admin/queues/inventory${queueSuffix(query)}`, {
    method: "GET",
  });
}

export async function createAdminQueueTask(payload: {
  entityType: AdminQueueItem["entityType"];
  entityId: string;
  shopId?: string | null;
  sellerId?: string | null;
  title: string;
  summary?: string;
  priority?: string;
  slaStatus?: AdminQueueSlaStatus;
}) {
  return apiRequest<AdminQueueTask>("/api/admin/queue-tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function assignAdminQueueTask(taskId: string, assignedToUserId?: string) {
  return apiRequest<AdminQueueTask>(`/api/admin/queue-tasks/${taskId}/assign`, {
    method: "POST",
    body: JSON.stringify({ assignedToUserId }),
  });
}

export async function updateAdminQueueTaskStatus(taskId: string, status: string, note?: string) {
  return apiRequest<AdminQueueTask>(`/api/admin/queue-tasks/${taskId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, note }),
  });
}

export async function escalateAdminQueueTask(taskId: string, note?: string, priority = "HIGH") {
  return apiRequest<AdminQueueTask>(`/api/admin/queue-tasks/${taskId}/escalate`, {
    method: "POST",
    body: JSON.stringify({ note, priority }),
  });
}

export async function listAdminQueueTaskEvents(taskId: string) {
  return apiRequest<AdminQueueTaskEvent[]>(`/api/admin/queue-tasks/${taskId}/events`, {
    method: "GET",
  });
}

export async function listAdminSellers(query: {
  status: SellerApprovalStatus | "ALL";
  q?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams({ status: query.status });
  if (query.q) params.set("q", query.q);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return apiRequest<AdminSellerListResponse>(`/api/admin/sellers?${params.toString()}`, {
    method: "GET",
  });
}

export async function getAdminSeller(userId: string) {
  return apiRequest<AdminSellerDetail>(`/api/admin/sellers/${userId}`, {
    method: "GET",
  });
}

export async function approveAdminSeller(userId: string) {
  return apiRequest<AdminSeller>(`/api/admin/sellers/${userId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectAdminSeller(userId: string, reason?: string) {
  return apiRequest<AdminSeller>(`/api/admin/sellers/${userId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getAdminSellerOnboarding(userId: string) {
  return apiRequest<AdminSellerOnboarding>(`/api/admin/sellers/${userId}/onboarding`, {
    method: "GET",
  });
}

export async function listAdminSellerDocuments(userId: string) {
  return apiRequest<SellerDocument[]>(`/api/admin/sellers/${userId}/documents`, {
    method: "GET",
  });
}

export async function approveAdminSellerDocument(userId: string, documentId: string) {
  return apiRequest<SellerDocument>(`/api/admin/sellers/${userId}/documents/${documentId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectAdminSellerDocument(userId: string, documentId: string, reason?: string) {
  return apiRequest<SellerDocument>(`/api/admin/sellers/${userId}/documents/${documentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function listAdminAuditLogs(targetUserId?: string) {
  const query = targetUserId ? `?targetUserId=${encodeURIComponent(targetUserId)}` : "";
  return apiRequest<AdminAuditLog[]>(`/api/admin/audit-logs${query}`, {
    method: "GET",
  });
}

export async function listAdminDeliveries(query?: {
  status?: string;
  provider?: string;
  shopId?: string;
  sellerId?: string;
  paidWithoutDelivery?: boolean;
  exceptionOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  geoReady?: boolean;
  missingCoordinates?: boolean;
}) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.provider) params.set("provider", query.provider);
  if (query?.shopId) params.set("shopId", query.shopId);
  if (query?.sellerId) params.set("sellerId", query.sellerId);
  if (query?.paidWithoutDelivery) params.set("paidWithoutDelivery", "true");
  if (query?.exceptionOnly) params.set("exceptionOnly", "true");
  if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query?.dateTo) params.set("dateTo", query.dateTo);
  if (query?.search) params.set("search", query.search);
  if (query?.geoReady) params.set("geoReady", "true");
  if (query?.missingCoordinates) params.set("missingCoordinates", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ items: AdminDeliveryRow[] }>(`/api/admin/deliveries${suffix}`, {
    method: "GET",
  });
}

export async function listAdminFulfillmentOrders(query?: {
  page?: number;
  size?: number;
  bucket?: Exclude<AdminFulfillmentBucket, "ALL">;
  search?: string;
  shopId?: string;
  sellerId?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  provider?: string;
  overdueOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminFulfillmentResponse>(`/api/admin/orders/fulfillment${suffix}`, {
    method: "GET",
  });
}

export async function adminMoveOrderToAssembling(orderId: string) {
  return apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/move-to-assembling`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function adminArchiveOrder(orderId: string) {
  return apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/archive`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function adminMarkDeliveryInTransit(deliveryShipmentId: string, note?: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-in-transit`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminMarkDeliveryCourierAssigned(
  deliveryShipmentId: string,
  payload?: { note?: string; courierName?: string | null; courierPhone?: string | null; estimatedDeliveryAt?: string | null },
) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-courier-assigned`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function adminMarkDeliveryPickedUp(
  deliveryShipmentId: string,
  payload?: { note?: string; courierName?: string | null; courierPhone?: string | null; estimatedDeliveryAt?: string | null },
) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-picked-up`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function adminMarkDeliveryDelivered(deliveryShipmentId: string, note?: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-delivered`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminCancelDelivery(deliveryShipmentId: string, note?: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminMarkDeliveryFailed(
  deliveryShipmentId: string,
  payload: {
    reasonCode: DeliveryExceptionReasonCode;
    reasonText?: string | null;
    customerVisibleMessage?: string | null;
  },
) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-failed`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminAddDeliveryComment(
  deliveryShipmentId: string,
  payload: { visibility: DeliveryCommentVisibility; message: string },
) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAdminSupportCases(query?: {
  status?: string;
  issueType?: string;
  priority?: string;
  checkoutCode?: string;
  shopId?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.issueType) params.set("issueType", query.issueType);
  if (query?.priority) params.set("priority", query.priority);
  if (query?.checkoutCode) params.set("checkoutCode", query.checkoutCode);
  if (query?.shopId) params.set("shopId", query.shopId);
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ items: SupportCaseDetail[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/api/admin/support-cases${suffix}`, {
    method: "GET",
  });
}

export async function getAdminSupportCase(caseId: string) {
  return apiRequest<SupportCaseDetail>(`/api/admin/support-cases/${encodeURIComponent(caseId)}`, {
    method: "GET",
  });
}

export async function updateAdminSupportCase(
  caseId: string,
  payload: { status?: string; priority?: string; resolutionNote?: string | null },
) {
  return apiRequest<SupportCaseDetail>(`/api/admin/support-cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function addAdminSupportCaseMessage(
  caseId: string,
  payload: { message: string; isInternal?: boolean },
) {
  return apiRequest<SupportCaseDetail>(`/api/admin/support-cases/${encodeURIComponent(caseId)}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAdminReturnRefundCases(query?: {
  status?: string;
  reason?: string;
  shopId?: string;
  sellerId?: string;
  customerId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ items: AdminReturnRefundCase[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/api/admin/returns${suffix}`, {
    method: "GET",
  });
}

export async function getAdminReturnRefundCase(caseId: string) {
  return apiRequest<AdminReturnRefundCase>(`/api/admin/returns/${encodeURIComponent(caseId)}`, {
    method: "GET",
  });
}

export async function decideAdminReturnRefundCase(
  caseId: string,
  payload: {
    decision: "APPROVE" | "REJECT" | "REQUEST_MORE_EVIDENCE" | "CLOSE" | "OVERRIDE_REFUND_CONFIRMED";
    approvedAmount?: number;
    adminNote: string;
  },
) {
  return apiRequest<AdminReturnRefundCase>(`/api/admin/returns/${encodeURIComponent(caseId)}/decision`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addAdminReturnRefundMessage(
  caseId: string,
  payload: { message: string },
) {
  return apiRequest<AdminReturnRefundCase>(`/api/admin/returns/${encodeURIComponent(caseId)}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addAdminReturnRefundInternalNote(
  caseId: string,
  payload: { message: string },
) {
  return apiRequest<AdminReturnRefundCase>(`/api/admin/returns/${encodeURIComponent(caseId)}/internal-note`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateDeliveryCustomerMessage(deliveryShipmentId: string, customerVisibleMessage: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/customer-message`, {
    method: "PATCH",
    body: JSON.stringify({ customerVisibleMessage }),
  });
}

export async function adminRemindYandex(orderId: string) {
  return apiRequest<{
    reminderCreated: boolean;
    lastReminderAt: string | null;
    nextAllowedAt: string | null;
  }>(`/api/admin/deliveries/${encodeURIComponent(orderId)}/remind-yandex`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listAdminReviews(query?: {
  productId?: string;
  rating?: number;
  status?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (query?.productId) params.set("productId", query.productId);
  if (query?.rating) params.set("rating", String(query.rating));
  if (query?.status) params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  const suffix = params.toString() ? `?${params.toString()}` : "";

  return apiRequest<{ items: AdminReviewRecord[] }>(
    `/api/admin/reviews${suffix}`,
    {
      method: "GET",
    },
  );
}

export async function hideAdminReview(reviewId: string, reason?: string) {
  return apiRequest<AdminReviewRecord>(
    `/api/admin/reviews/${encodeURIComponent(reviewId)}/hide`,
    {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    },
  );
}

export async function restoreAdminReview(reviewId: string) {
  return apiRequest<AdminReviewRecord>(
    `/api/admin/reviews/${encodeURIComponent(reviewId)}/restore`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    },
  );
}
