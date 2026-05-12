export type OrderStatus = 'NEW' | 'ASSEMBLING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'WAITING_CONFIRMATION' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

/**
 * Mirrors backend OrderItemResponseDto exactly.
 * Field names use snapshot suffixes as returned by the server.
 */
export interface OrderItem {
  id: string;
  variantId: string;
  quantity: number;
  priceAtPurchase: number;
  productTitleSnapshot: string;
  productSlugSnapshot?: string;
  variantAttributesSnapshot?: string;
  productImageSnapshot?: string;
  wbNmIdSnapshot?: number;
  reviewId?: string;
  reviewRate?: number;
  reviewContent?: string;
  reviewCreatedAt?: string;
}

export interface DeliveryIssue {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  customerNote?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  shipmentId?: string;
  carrier?: string;
  trackingNumber?: string;
  shipmentStatus?: string;
}

/**
 * Mirrors backend OrderResponseDto exactly.
 */
export interface Order {
  id: string;
  orderNumber: string;
  shopId?: string;
  shopName?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  shippingCost?: number;
  shippingMethodName?: string;
  shippingZoneName?: string;
  shippingAddress?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerNote?: string;
  receiptImageUrl?: string;
  payerName?: string;
  transferAmount?: number;
  transferTime?: string;
  paymentSubmittedAt?: string;
  paymentReviewedAt?: string;
  paymentReviewNote?: string;
  shopPaymentInstructions?: string;
  customerCompletedAt?: string;
  deliveryIssue?: DeliveryIssue | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface CheckoutRequest {
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote?: string;
  shippingMethodId: string;
  shippingZoneId: string;
}

/** Tracking info derived from a ShipmentResponseDto, used on the order detail page */
export interface Tracking {
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  shipmentStatus?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface PaymentConfirmationUploadRequest {
  receiptImage: File;
  payerName: string;
  transferAmount: number;
  transferTime: string;
}

export interface ReviewCreateRequest {
  rate: number;
  content?: string;
}
