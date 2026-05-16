import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryMappingService } from './category-mapping.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryMappingService],
  exports: [CategoriesService, CategoryMappingService],
})
export class CategoriesModule {}
