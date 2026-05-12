export interface ShippingZone {
  id: string;
  name: string;
  country: string;
  region?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  estimatedDays?: number;
}

// ---- Seller Shipment DTOs (mirrors backend ShipmentResponseDto) ----
export type ShipmentStatus = 'CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface ShipmentResponseDto {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber?: string;
  shipmentStatus: ShipmentStatus;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface CreateShipmentRequestDto {
  carrier: string;
  trackingNumber?: string;
}

export type DeliveryIssueStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export interface DeliveryIssueResponseDto {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: DeliveryIssueStatus;
  customerNote?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  shipmentId?: string;
  carrier?: string;
  trackingNumber?: string;
  shipmentStatus?: ShipmentStatus;
}

/**
 * Mirrors backend SyncJobResponseDto.
 * Note: the backend returns syncJobId (UUID) not jobId.
 * Fields for totals/duration are NOT in SyncJobResponseDto — they come from
 * a separate SyncHistory query or enriched service response (if available).
 * The SyncHealthDto endpoint (/sync/stats) is used for health metrics.
 */
export interface SyncHistoryDto {
  syncJobId: string;
  shopId: string;
  syncType: string; // FULL | INCREMENTAL
  status: string;   // RUNNING | SUCCESS | FAILED | PARTIAL_SUCCESS — from SyncStatus enum
  startedAt?: string;
}

/**
 * Mirrors backend SyncHealthDto exactly.
 */
export interface SyncHealthDto {
  lastSuccessfulSyncAt?: string;
  lastFailedSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncDurationMs?: number;
  consecutiveFailureCount?: number;
  syncIntervalMinutes?: number;
  isSyncPaused?: boolean;
  nextSyncExpectedAt?: string;
}
