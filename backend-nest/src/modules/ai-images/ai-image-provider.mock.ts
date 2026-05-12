import { Injectable } from '@nestjs/common';
import {
  AiImageGenerationRequest,
  AiImageGenerationResult,
  AiImageProvider,
} from './ai-image-provider.interface';
import { AI_DEFAULT_PROVIDER } from './ai-images.constants';

@Injectable()
export class MockAiImageProvider implements AiImageProvider {
  generateProductImage(
    input: AiImageGenerationRequest,
  ): Promise<AiImageGenerationResult> {
    return Promise.resolve({
      providerTaskId: `mock-provider-${input.taskId}`,
      provider: AI_DEFAULT_PROVIDER,
      images: Array.from({ length: input.quantity }, (_, index) => {
        const primaryUrl =
          input.inputFrontImageUrl ??
          input.inputModelImageUrl ??
          input.inputBackImageUrl ??
          `https://mock-ai.local/generated/${input.taskId}/placeholder.png`;

        return {
          imageUrl: `${primaryUrl}${primaryUrl.includes('?') ? '&' : '?'}variant=${index + 1}`,
          storageKey: null,
          thumbnailUrl: `${primaryUrl}${primaryUrl.includes('?') ? '&' : '?'}thumb=${index + 1}`,
          mimeType: 'image/png',
          width: 1024,
          height: 1024,
          metadata: {
            provider: AI_DEFAULT_PROVIDER,
            taskType: input.taskType,
            stylePreset: input.stylePreset ?? null,
            variant: index + 1,
          },
        };
      }),
    });
  }
}
