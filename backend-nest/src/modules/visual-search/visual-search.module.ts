import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { VisualSearchController } from './visual-search.controller';
import { VisualSearchService } from './visual-search.service';

@Module({
  imports: [ProductsModule],
  controllers: [VisualSearchController],
  providers: [VisualSearchService],
})
export class VisualSearchModule {}
