import { Module } from '@nestjs/common';
import { PublicProductsController } from './public-products.controller';
import { PublicProductsService } from './public-products.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [PublicProductsController],
  providers: [PublicProductsService],
})
export class PublicProductsModule {}
