import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt-customer') {
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
