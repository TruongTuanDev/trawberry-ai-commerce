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
  ],
  controllers: [HealthController],
})
export class AppModule {}
