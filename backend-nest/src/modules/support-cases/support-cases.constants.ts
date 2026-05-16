export const SUPPORT_CASE_ISSUE_TYPES = [
  'PAYMENT_PROOF',
  'DELIVERY_DELAY',
  'WRONG_ITEM',
  'DAMAGED_ITEM',
  'REFUND_REQUEST',
  'CANCEL_REQUEST',
  'OTHER',
] as const;

export const SUPPORT_CASE_STATUSES = [
  'OPEN',
  'IN_REVIEW',
  'WAITING_CUSTOMER',
  'WAITING_SELLER',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;

export const SUPPORT_CASE_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const;

export const SUPPORT_CASE_SENDER_ROLES = [
  'CUSTOMER',
  'SELLER',
  'ADMIN',
  'SYSTEM',
] as const;

export type SupportCaseIssueType = (typeof SUPPORT_CASE_ISSUE_TYPES)[number];
export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];
export type SupportCasePriority = (typeof SUPPORT_CASE_PRIORITIES)[number];
export type SupportCaseSenderRole = (typeof SUPPORT_CASE_SENDER_ROLES)[number];
