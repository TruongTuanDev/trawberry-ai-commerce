import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { PublicShopsController } from './public-shops.controller';
import { PublicShopsService } from './public-shops.service';

@Module({
  imports: [ProductsModule],
  controllers: [PublicShopsController],
  providers: [PublicShopsService],
})
export class PublicShopsModule {}
