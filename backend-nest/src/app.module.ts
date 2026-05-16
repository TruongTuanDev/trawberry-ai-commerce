import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ShopsModule } from './modules/shops/shops.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductImagesModule } from './modules/product-images/product-images.module';
import { FilesModule } from './modules/files/files.module';
import { AiImagesModule } from './modules/ai-images/ai-images.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PublicProductsModule } from './modules/public-products/public-products.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrderTrackingModule } from './modules/order-tracking/order-tracking.module';
import { CustomerOrdersModule } from './modules/customer-orders/customer-orders.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { AdminModule } from './modules/admin/admin.module';
import { SellerOnboardingModule } from './modules/seller-onboarding/seller-onboarding.module';
import { WildberriesImportsModule } from './modules/wb-imports/wildberries-imports.module';
import { WbSyncModule } from './modules/wb-sync/wb-sync.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { QueueModule } from './common/queue/queue.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ShopsModule,
    ProductsModule,
    ProductImagesModule,
    FilesModule,
    AiImagesModule,
    OrdersModule,
    PaymentsModule,
    DeliveryModule,
    AdminModule,
    SellerOnboardingModule,
    WildberriesImportsModule,
    WbSyncModule,
    CategoriesModule,
    PublicProductsModule,
    CheckoutModule,
    OrderTrackingModule,
    CustomerOrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
