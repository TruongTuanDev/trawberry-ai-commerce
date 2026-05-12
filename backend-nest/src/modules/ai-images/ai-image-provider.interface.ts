export type AiImageGenerationRequest = {
  taskId: string;
  shopId: string;
  productId: string;
  taskType: string;
  quantity: number;
  prompt: string;
  stylePreset?: string | null;
  inputFrontImageUrl?: string | null;
  inputBackImageUrl?: string | null;
  inputModelImageUrl?: string | null;
};

export type AiImageGenerationResult = {
  providerTaskId: string;
  provider: string;
  images: Array<{
    imageUrl: string;
    storageKey?: string | null;
    thumbnailUrl?: string | null;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
    metadata?: Record<string, unknown> | null;
  }>;
};

export interface AiImageProvider {
  generateProductImage(
    input: AiImageGenerationRequest,
  ): Promise<AiImageGenerationResult>;
}

export const AI_IMAGE_PROVIDER = 'AI_IMAGE_PROVIDER';
