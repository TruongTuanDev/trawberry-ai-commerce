export const AI_IMAGE_QUEUE = 'ai-images';
export const AI_IMAGE_JOB_GENERATE = 'generate-product-image';
export const AI_DEFAULT_PROVIDER = 'mock-provider';
export const AI_DEFAULT_DEV_CREDITS = 50;

export const AI_TASK_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const AI_TASK_TYPES = {
  PRODUCT_MODEL_IMAGE: 'PRODUCT_MODEL_IMAGE',
  TRY_ON: 'TRY_ON',
  BACKGROUND_REPLACE: 'BACKGROUND_REPLACE',
  DETAIL_SHOT: 'DETAIL_SHOT',
} as const;
