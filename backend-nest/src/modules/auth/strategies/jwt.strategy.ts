import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
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
    });
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
