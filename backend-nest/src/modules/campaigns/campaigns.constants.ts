export const SPONSORED_CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'paused',
  'ended',
  'archived',
] as const;

export const SPONSORED_CAMPAIGN_TARGET_STATUSES = [
  'active',
  'paused',
  'removed',
] as const;

export const SPONSORED_CAMPAIGN_SCENARIO_TYPES = [
  'home',
  'similar',
  'search',
] as const;

export const SPONSORED_CAMPAIGN_BILLING_MODES = [
  'none',
  'cpc',
  'cpm',
  'fixed',
] as const;

export const SPONSORED_CAMPAIGN_LIMITS = {
  maxBoost: 20,
  maxNameLength: 255,
  maxDescriptionLength: 1000,
  maxBudgetLimit: 1_000_000,
} as const;

export type SponsoredCampaignStatus =
  (typeof SPONSORED_CAMPAIGN_STATUSES)[number];
export type SponsoredCampaignTargetStatus =
  (typeof SPONSORED_CAMPAIGN_TARGET_STATUSES)[number];
export type SponsoredCampaignScenarioType =
  (typeof SPONSORED_CAMPAIGN_SCENARIO_TYPES)[number];
export type SponsoredCampaignBillingMode =
  (typeof SPONSORED_CAMPAIGN_BILLING_MODES)[number];
