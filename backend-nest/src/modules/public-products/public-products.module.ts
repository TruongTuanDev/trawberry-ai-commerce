import { Module } from '@nestjs/common';
import { PublicProductsController } from './public-products.controller';
import { PublicProductsService } from './public-products.service';

@Module({
  controllers: [PublicProductsController],
  providers: [PublicProductsService],
})
export class PublicProductsModule {}
