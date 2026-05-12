import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: (() => {
          const raw =
            configService.get<string>('JWT_SECRET') ||
            configService.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret');
          try {
            const decoded = Buffer.from(raw, 'base64');
            if (
              decoded.length > 0 &&
              decoded.toString('base64') === raw.replace(/\s+/g, '')
            ) {
              return decoded;
            }
          } catch {
            return raw;
          }

          return raw;
        })(),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ||
            configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m')) as never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
