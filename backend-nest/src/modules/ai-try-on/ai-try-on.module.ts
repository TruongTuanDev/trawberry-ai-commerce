import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ProductsModule } from '../products/products.module';
import { AiTryOnAiServiceClientService } from './ai-try-on-ai-service-client.service';
import {
  AdminAiTryOnSettingsController,
  PublicAiTryOnController,
} from './ai-try-on.controller';
import { AiTryOnService } from './ai-try-on.service';
import { AiTryOnWorkerService } from './ai-try-on.worker';
import { SizeRecommendationService } from './size-recommendation.service';

@Module({
  imports: [FilesModule, ProductsModule],
  controllers: [AdminAiTryOnSettingsController, PublicAiTryOnController],
  providers: [
    AiTryOnService,
    AiTryOnWorkerService,
    AiTryOnAiServiceClientService,
    SizeRecommendationService,
  ],
})
export class AiTryOnModule {}
