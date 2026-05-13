import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { SellerOnboardingController } from './seller-onboarding.controller';
import { SellerOnboardingService } from './seller-onboarding.service';

@Module({
  imports: [FilesModule],
  controllers: [SellerOnboardingController],
  providers: [SellerOnboardingService],
})
export class SellerOnboardingModule {}
