import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { UserRole } from '../../common/constants/roles.constant';
import {
  ALL_ROLE_ACCESS_COOKIE_NAMES,
  ALL_ROLE_REFRESH_COOKIE_NAMES,
  LEGACY_AUTH_COOKIE_NAME,
  ROLE_ACCESS_COOKIE_NAMES,
  ROLE_REFRESH_COOKIE_NAMES,
} from './auth-session.constants';

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  getAuthCookieOptions() {
    const isSecure =
      this.configService.get<string>('AUTH_COOKIE_SECURE', 'false') === 'true';
    const sameSiteConfig = this.configService.get<string>(
      'AUTH_COOKIE_SAME_SITE',
      'lax',
    );
    const sameSite = (
      ['lax', 'strict', 'none'].includes(sameSiteConfig) &&
      !(sameSiteConfig === 'none' && !isSecure)
        ? sameSiteConfig
        : 'lax'
    ) as boolean | 'lax' | 'strict' | 'none';
    const maxAgeSeconds = this.configService.get<number>(
      'AUTH_COOKIE_MAX_AGE_SECONDS',
      15 * 60,
    );

    return {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: maxAgeSeconds * 1000,
      path: '/',
    };
  }

  setAccessTokenCookie(res: Response, role: UserRole, token: string) {
    res.cookie(
      ROLE_ACCESS_COOKIE_NAMES[role],
      token,
      this.getAuthCookieOptions(),
    );
  }

  clearRoleCookies(res: Response, role: UserRole) {
    res.clearCookie(
      ROLE_ACCESS_COOKIE_NAMES[role],
      this.getAuthCookieOptions(),
    );
    res.clearCookie(
      ROLE_REFRESH_COOKIE_NAMES[role],
      this.getAuthCookieOptions(),
    );
  }

  clearLegacyCookie(res: Response) {
    res.clearCookie(LEGACY_AUTH_COOKIE_NAME, this.getAuthCookieOptions());
  }

  clearAllAuthCookies(res: Response) {
    for (const cookieName of [
      LEGACY_AUTH_COOKIE_NAME,
      ...ALL_ROLE_ACCESS_COOKIE_NAMES,
      ...ALL_ROLE_REFRESH_COOKIE_NAMES,
    ]) {
      res.clearCookie(cookieName, this.getAuthCookieOptions());
    }
  }
}
