import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { USER_ROLES } from '../constants/roles.constant';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class ShopAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { shopId?: string };
      user?: AuthenticatedUser;
      shop?: unknown;
    }>();

    const shopId = request.params?.shopId;
    const user = request.user;

    if (!shopId || !user) {
      return true;
    }

    if (user.role === USER_ROLES.ADMIN) {
      return true;
    }

    if (user.role !== USER_ROLES.SELLER) {
      throw new ForbiddenException(
        'Only sellers or admins can access shop-scoped resources.',
      );
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        sellerProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }

    if (shop.sellerProfile.userId !== user.userId) {
      throw new ForbiddenException('You do not have access to this shop.');
    }

    request.shop = shop;
    return true;
  }
}
