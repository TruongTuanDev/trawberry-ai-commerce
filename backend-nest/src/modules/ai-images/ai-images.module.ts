import { Module } from '@nestjs/common';
import { AI_IMAGE_PROVIDER } from './ai-image-provider.interface';
import { MockAiImageProvider } from './ai-image-provider.mock';
import { AiImagesController } from './ai-images.controller';
import { AiImagesService } from './ai-images.service';
import { AiImagesWorkerService } from './ai-images.worker';
import { AiServiceClientService } from './ai-service-client.service';

@Module({
  controllers: [AiImagesController],
  providers: [
    AiImagesService,
    AiImagesWorkerService,
    AiServiceClientService,
    MockAiImageProvider,
    {
      provide: AI_IMAGE_PROVIDER,
      useExisting: MockAiImageProvider,
    },
  ],
})
export class AiImagesModule {}
