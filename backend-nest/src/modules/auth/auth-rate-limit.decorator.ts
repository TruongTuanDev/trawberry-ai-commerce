import { SetMetadata } from '@nestjs/common';

export type AuthRateLimitConfig = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  includeIdentifier?: boolean;
};

export const AUTH_RATE_LIMIT_METADATA = 'auth-rate-limit';

export const AuthRateLimit = (config: AuthRateLimitConfig) =>
  SetMetadata(AUTH_RATE_LIMIT_METADATA, config);
