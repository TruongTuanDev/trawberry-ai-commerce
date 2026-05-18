import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { USER_ROLES } from '../../../common/constants/roles.constant';
import {
  LEGACY_AUTH_COOKIE_NAME,
  ROLE_ACCESS_COOKIE_NAMES,
} from '../auth-session.constants';

function getJwtSecret(configService: ConfigService): string | Buffer {
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
}

function extractCookie(request: Request, cookieNames: string[]): string | null {
  const cookies = request?.cookies as Record<string, string> | undefined;
  if (!cookies) {
    return null;
  }

  for (const cookieName of cookieNames) {
    const token = cookies[cookieName];
    if (token) {
      return token;
    }
  }

  return null;
}

function buildStrategyOptions(
  configService: ConfigService,
  cookieNames: string[],
) {
  return {
    jwtFromRequest: ExtractJwt.fromExtractors([
      (request: Request) => extractCookie(request, cookieNames),
      ExtractJwt.fromAuthHeaderAsBearerToken(),
    ]),
    ignoreExpiration: false,
    secretOrKey: getJwtSecret(configService),
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super(
      buildStrategyOptions(configService, [
        LEGACY_AUTH_COOKIE_NAME,
        ROLE_ACCESS_COOKIE_NAMES[USER_ROLES.CUSTOMER],
        ROLE_ACCESS_COOKIE_NAMES[USER_ROLES.SELLER],
        ROLE_ACCESS_COOKIE_NAMES[USER_ROLES.ADMIN],
      ]),
    );
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(configService: ConfigService) {
    super(
      buildStrategyOptions(configService, [
        ROLE_ACCESS_COOKIE_NAMES[USER_ROLES.ADMIN],
      ]),
    );
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}

@Injectable()
export class SellerJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-seller',
) {
  constructor(configService: ConfigService) {
    super(
      buildStrategyOptions(configService, [
        ROLE_ACCESS_COOKIE_NAMES[USER_ROLES.SELLER],
      ]),
    );
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-customer',
) {
  constructor(configService: ConfigService) {
    super(
      buildStrategyOptions(configService, [
        ROLE_ACCESS_COOKIE_NAMES[USER_ROLES.CUSTOMER],
      ]),
    );
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
