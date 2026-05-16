import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { WbApiClientService } from './wb-api-client.service';
import { WbProductMapperService } from './wb-product-mapper.service';
import { WbProductSyncService } from './wb-product-sync.service';
import { WbSyncController } from './wb-sync.controller';

@Module({
  imports: [CategoriesModule],
  controllers: [WbSyncController],
  providers: [WbApiClientService, WbProductMapperService, WbProductSyncService],
})
export class WbSyncModule {}
