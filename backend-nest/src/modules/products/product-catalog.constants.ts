export const PRODUCT_CATALOG_STATUSES = [
  'IMPORTED',
  'DRAFT',
  'READY',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;

export type ProductCatalogStatus = (typeof PRODUCT_CATALOG_STATUSES)[number];

export const PRODUCT_SOURCES = [
  'MANUAL',
  'WILDBERRIES_EXCEL',
  'WILDBERRIES_API',
] as const;

export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PRODUCT_READINESS_REASONS = [
  'SELLER_NOT_APPROVED',
  'SHOP_INACTIVE',
  'PRODUCT_ARCHIVED',
  'PRODUCT_DELETED',
  'MISSING_NAME',
  'MISSING_IMAGE',
  'MISSING_CATEGORY',
  'NO_ACTIVE_VARIANT',
  'MISSING_PRICE',
  'MISSING_STOCK',
] as const;

export type ProductReadinessReason = (typeof PRODUCT_READINESS_REASONS)[number];
