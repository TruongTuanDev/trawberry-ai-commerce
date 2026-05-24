import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { PublicCartController } from './public-cart.controller';
import { CartValidationService } from './cart-validation.service';
import { CheckoutService } from './checkout.service';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ProductsModule, NotificationsModule],
  controllers: [CheckoutController, PublicCartController],
  providers: [CheckoutService, CartValidationService],
  exports: [CartValidationService],
})
export class CheckoutModule {}
