import { Module } from '@nestjs/common';
import { AdminSupportCasesController } from './admin-support-cases.controller';
import { CustomerSupportCasesController } from './customer-support-cases.controller';
import { SellerSupportCasesController } from './seller-support-cases.controller';
import { SupportCasesService } from './support-cases.service';

@Module({
  controllers: [
    CustomerSupportCasesController,
    AdminSupportCasesController,
    SellerSupportCasesController,
  ],
  providers: [SupportCasesService],
  exports: [SupportCasesService],
})
export class SupportCasesModule {}
