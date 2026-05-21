import { Module } from '@nestjs/common';
import { CustomerAccountController } from './customer-account.controller';
import { CustomerAccountService } from './customer-account.service';

@Module({
  controllers: [CustomerAccountController],
  providers: [CustomerAccountService],
  exports: [CustomerAccountService],
})
export class CustomerAccountModule {}
