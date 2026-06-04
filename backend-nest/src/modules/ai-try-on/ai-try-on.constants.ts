export const AI_TRY_ON_SETTINGS_ID = 'default';
export const AI_TRY_ON_QUEUE = 'ai-try-on';
export const AI_TRY_ON_JOB_GENERATE = 'generate-try-on';
export const AI_TRY_ON_GUEST_HEADER = 'x-guest-session-id';

export const AI_TRY_ON_PROVIDER_MODES = ['mock', 'demo', 'openai'] as const;
export type AiTryOnProviderMode = (typeof AI_TRY_ON_PROVIDER_MODES)[number];

export const AI_TRY_ON_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export const AI_TRY_ON_BODY_TYPES = ['slim', 'regular', 'large'] as const;
export const AI_TRY_ON_GENDERS = ['male', 'female', 'other'] as const;
export const AI_TRY_ON_BODY_TRAITS = [
  'wide_shoulders',
  'long_legs',
  'large_belly',
] as const;

export const AI_TRY_ON_CONFIDENCE = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
