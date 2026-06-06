import { ApiProperty } from '@nestjs/swagger';
import { BillingLedgerEntryResponseDto } from './billing-ledger-entry-response.dto';
import { SellerWalletResponseDto } from './seller-wallet-response.dto';

export class DevCreditWalletResponseDto {
  @ApiProperty({ type: SellerWalletResponseDto })
  wallet!: SellerWalletResponseDto;

  @ApiProperty({ type: BillingLedgerEntryResponseDto })
  entry!: BillingLedgerEntryResponseDto;
}
