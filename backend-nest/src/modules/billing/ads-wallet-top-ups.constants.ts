export const ADS_MANUAL_TOP_UP_ENABLED_FLAG = 'ADS_MANUAL_TOP_UP_ENABLED';
export const ADS_DEMO_FUNDING_ENABLED_FLAG = 'ADS_DEMO_FUNDING_ENABLED';
export const ADS_WALLET_TOP_UP_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
] as const;

export type AdsWalletTopUpStatus = (typeof ADS_WALLET_TOP_UP_STATUSES)[number];
