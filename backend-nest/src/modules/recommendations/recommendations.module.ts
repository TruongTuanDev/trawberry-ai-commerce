import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { RecommendationScoringService } from './recommendation-scoring.service';
import { RecommendationsQaController } from './recommendations-qa.controller';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [ProductsModule],
  controllers: [RecommendationsController, RecommendationsQaController],
  providers: [RecommendationsService, RecommendationScoringService],
})
export class RecommendationsModule {}
