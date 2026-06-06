import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ProductsModule } from '../products/products.module';
import { RecommendationScoringService } from './recommendation-scoring.service';
import { RecommendationsQaController } from './recommendations-qa.controller';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [ProductsModule, CampaignsModule, BillingModule],
  controllers: [RecommendationsController, RecommendationsQaController],
  providers: [RecommendationsService, RecommendationScoringService],
})
export class RecommendationsModule {}
