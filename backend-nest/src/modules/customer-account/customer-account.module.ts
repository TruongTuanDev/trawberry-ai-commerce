import { Module } from '@nestjs/common';
import { AddressGeocoderService } from './address-geocoder.service';
import { CustomerAccountController } from './customer-account.controller';
import { CustomerAccountService } from './customer-account.service';

@Module({
  controllers: [CustomerAccountController],
  providers: [CustomerAccountService, AddressGeocoderService],
  exports: [CustomerAccountService],
})
export class CustomerAccountModule {}
