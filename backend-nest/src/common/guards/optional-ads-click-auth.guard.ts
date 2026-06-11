import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAdsClickAuthGuard extends AuthGuard([
  'jwt-admin',
  'jwt-seller',
  'jwt-customer',
]) {
  handleRequest<TUser = unknown>(err: unknown, user: TUser) {
    if (err) {
      return null;
    }

    return user ?? null;
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
    }>();
  }
}
