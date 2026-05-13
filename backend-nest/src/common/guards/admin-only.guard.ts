import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { USER_ROLES } from '../constants/roles.constant';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    if (request.user?.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException('Admin access is required.');
    }

    return true;
  }
}
