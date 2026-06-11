import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ProductsModule } from '../products/products.module';
import { AdminRecommendationsAnalyticsController } from './admin-recommendations-analytics.controller';
import { RecommendationScoringService } from './recommendation-scoring.service';
import { RecommendationsQaController } from './recommendations-qa.controller';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { SellerRecommendationsAnalyticsController } from './seller-recommendations-analytics.controller';
import { AdminRecommendationTuningController } from './admin-recommendation-tuning.controller';
import { RecommendationTuningService } from './recommendation-tuning.service';

@Module({
  imports: [ProductsModule, CampaignsModule, BillingModule],
  controllers: [
    RecommendationsController,
    RecommendationsQaController,
    AdminRecommendationsAnalyticsController,
    SellerRecommendationsAnalyticsController,
    AdminRecommendationTuningController,
  ],
  providers: [
    RecommendationsService,
    RecommendationScoringService,
    RecommendationTuningService,
  ],
})
export class RecommendationsModule {}
