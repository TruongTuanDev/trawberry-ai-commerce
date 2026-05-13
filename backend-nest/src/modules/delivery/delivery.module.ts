import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CdekDeliveryClient } from './cdek-delivery.client';
import { DELIVERY_PROVIDER } from './delivery.constants';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { MockDeliveryProvider } from './providers/mock-delivery.provider';
import { CdekDeliveryProvider } from './providers/cdek-delivery.provider';
import { YandexDeliveryProvider } from './providers/yandex-delivery.provider';
import { YandexDeliveryClient } from './yandex-delivery.client';

@Module({
  imports: [PrismaModule],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    MockDeliveryProvider,
    CdekDeliveryProvider,
    YandexDeliveryProvider,
    CdekDeliveryClient,
    YandexDeliveryClient,
    {
      provide: DELIVERY_PROVIDER,
      inject: [
        ConfigService,
        MockDeliveryProvider,
        CdekDeliveryProvider,
        YandexDeliveryProvider,
      ],
      useFactory: (
        configService: ConfigService,
        mockProvider: MockDeliveryProvider,
        cdekProvider: CdekDeliveryProvider,
        yandexProvider: YandexDeliveryProvider,
      ) => {
        const mode = configService.get<string>(
          'DELIVERY_PROVIDER_MODE',
          'mock',
        );
        if (mode === 'cdek') {
          const enabled =
            configService.get<string>('CDEK_DELIVERY_ENABLED', 'false') ===
            'true';
          if (!enabled) {
            throw new Error(
              'DELIVERY_PROVIDER_MODE=cdek requires CDEK_DELIVERY_ENABLED=true.',
            );
          }
          return cdekProvider;
        }

        if (mode === 'yandex') {
          const enabled =
            configService.get<string>('YANDEX_DELIVERY_ENABLED', 'false') ===
            'true';
          if (!enabled) {
            throw new Error(
              'DELIVERY_PROVIDER_MODE=yandex requires YANDEX_DELIVERY_ENABLED=true.',
            );
          }
          return yandexProvider;
        }

        return mockProvider;
      },
    },
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
