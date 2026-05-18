import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tryNormalizePhone } from '../../common/utils/phone.util';
import {
  AUTH_RATE_LIMIT_METADATA,
  type AuthRateLimitConfig,
} from './auth-rate-limit.decorator';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authRateLimitService: AuthRateLimitService,
  ) {}

  canActivate(context: ExecutionContext) {
    const config = this.reflector.getAllAndOverride<AuthRateLimitConfig>(
      AUTH_RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.resolveIp(request);
    const keyParts = [config.keyPrefix, ip];

    if (config.includeIdentifier) {
      keyParts.push(this.resolveIdentifierFingerprint(request));
    }

    this.authRateLimitService.consume(
      keyParts.join(':'),
      config.limit,
      config.windowMs,
    );
    return true;
  }

  private resolveIp(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private resolveIdentifierFingerprint(request: Request) {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const rawIdentifier =
      this.asString(body.identifier) ??
      this.asString(body.email) ??
      this.asString(body.phone) ??
      'anonymous';
    const trimmed = rawIdentifier.trim();

    if (!trimmed) {
      return 'anonymous';
    }

    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }

    return tryNormalizePhone(trimmed) ?? trimmed.replace(/\s+/g, '');
  }

  private asString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }
}
