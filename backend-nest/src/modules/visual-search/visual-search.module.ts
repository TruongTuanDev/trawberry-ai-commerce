import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import {
  AdminVisualSearchController,
  VisualSearchController,
} from './visual-search.controller';
import { VisualSearchService } from './visual-search.service';
import { VisualEmbeddingClient } from './visual-embedding.client';

@Module({
  imports: [ProductsModule],
  controllers: [VisualSearchController, AdminVisualSearchController],
  providers: [VisualSearchService, VisualEmbeddingClient],
})
export class VisualSearchModule {}
