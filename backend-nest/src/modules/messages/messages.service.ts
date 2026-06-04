import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCustomerMessageThreadDto } from './dto/create-customer-message-thread.dto';
import { ListMessageThreadsQueryDto } from './dto/list-message-threads-query.dto';

type ViewerRole = 'CUSTOMER' | 'SELLER' | 'ADMIN';

const threadSummaryInclude = {
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  },
  product: {
    select: {
      id: true,
      localTitle: true,
      wbTitle: true,
      images: {
        orderBy: { createdAt: 'asc' as const },
        take: 1,
        select: {
          id: true,
          localUrl: true,
          wbUrl: true,
        },
      },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
    },
  },
  customer: {
    select: {
      id: true,
      fullName: true,
      email: true,
      preferredLocale: true,
    },
  },
  seller: {
    select: {
      id: true,
      fullName: true,
      email: true,
      preferredLocale: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      senderRole: true,
      message: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ShopMessageThreadInclude;

const threadDetailInclude = {
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  },
  product: {
    select: {
      id: true,
      localTitle: true,
      wbTitle: true,
      images: {
        orderBy: { createdAt: 'asc' as const },
        take: 1,
        select: {
          id: true,
          localUrl: true,
          wbUrl: true,
        },
      },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
    },
  },
  customer: {
    select: {
      id: true,
      fullName: true,
      email: true,
      preferredLocale: true,
    },
  },
  seller: {
    select: {
      id: true,
      fullName: true,
      email: true,
      preferredLocale: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      senderRole: true,
      message: true,
      createdAt: true,
      senderCustomer: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      senderSeller: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      senderAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.ShopMessageThreadInclude;

type ThreadSummaryRecord = Prisma.ShopMessageThreadGetPayload<{
  include: typeof threadSummaryInclude;
}>;

type ThreadDetailRecord = Prisma.ShopMessageThreadGetPayload<{
  include: typeof threadDetailInclude;
}>;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private readonly threadSummaryInclude = threadSummaryInclude;

  private readonly threadDetailInclude = threadDetailInclude;

  async createCustomerThread(
    user: AuthenticatedUser,
    dto: CreateCustomerMessageThreadDto,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const message = this.normalizeMessage(dto.message);
    const shop = await this.findPublicShopForMessaging(
      dto.shopId,
      dto.shopSlug,
    );

    if (dto.orderId) {
      await this.assertCustomerOrderContext(user.userId, dto.orderId, shop.id);
    }

    const product = dto.productId
      ? await this.prisma.product.findFirst({
          where: {
            id: dto.productId,
            shopId: shop.id,
          },
          select: {
            id: true,
            localTitle: true,
            wbTitle: true,
          },
        })
      : null;

    if (dto.productId && !product) {
      throw new BadRequestException({
        code: 'MESSAGE_SHOP_NOT_AVAILABLE',
        message: 'The requested shop context is no longer available.',
      });
    }

    const now = new Date();
    const existing = await this.prisma.shopMessageThread.findFirst({
      where: {
        shopId: shop.id,
        customerId: user.userId,
        productId: dto.productId ?? null,
        orderId: dto.orderId ?? null,
        status: { in: ['OPEN', 'REPORTED'] },
      },
      include: this.threadDetailInclude,
    });

    if (existing) {
      const updated = await this.prisma.shopMessageThread.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: now,
          lastCustomerReadAt: now,
          messages: {
            create: {
              senderRole: 'CUSTOMER',
              senderCustomerId: user.userId,
              message,
            },
          },
        },
        include: this.threadDetailInclude,
      });

      await this.notifySeller(updated, 'CUSTOMER');
      return this.mapThreadDetail(updated, 'CUSTOMER');
    }

    const subject =
      dto.subject?.trim() ||
      product?.localTitle ||
      product?.wbTitle ||
      shop.name;

    const created = await this.prisma.shopMessageThread.create({
      data: {
        shopId: shop.id,
        sellerId: shop.sellerProfile.user.id,
        customerId: user.userId,
        productId: product?.id ?? null,
        orderId: dto.orderId ?? null,
        subject,
        status: 'OPEN',
        lastMessageAt: now,
        lastCustomerReadAt: now,
        messages: {
          create: {
            senderRole: 'CUSTOMER',
            senderCustomerId: user.userId,
            message,
          },
        },
      },
      include: this.threadDetailInclude,
    });

    await this.notifySeller(created, 'CUSTOMER');
    return this.mapThreadDetail(created, 'CUSTOMER');
  }

  async listCustomerThreads(
    user: AuthenticatedUser,
    query: ListMessageThreadsQueryDto,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');

    const items = await this.prisma.shopMessageThread.findMany({
      where: {
        customerId: user.userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                {
                  shop: {
                    name: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  product: {
                    localTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  product: {
                    wbTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      include: this.threadSummaryInclude,
    });

    return {
      items: items
        .map((item) => this.mapThreadSummary(item, 'CUSTOMER'))
        .filter((item) => (query.filter === 'UNREAD' ? item.unread : true)),
    };
  }

  async getCustomerThread(threadId: string, user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: {
        id: threadId,
        customerId: user.userId,
      },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    return this.mapThreadDetail(thread, 'CUSTOMER');
  }

  async addCustomerMessage(
    threadId: string,
    user: AuthenticatedUser,
    input: string,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const message = this.normalizeMessage(input);
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: {
        id: threadId,
        customerId: user.userId,
      },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }
    this.assertThreadWritable(thread.status);

    const now = new Date();
    const updated = await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: {
        status: thread.status === 'REPORTED' ? 'REPORTED' : 'OPEN',
        lastMessageAt: now,
        lastCustomerReadAt: now,
        messages: {
          create: {
            senderRole: 'CUSTOMER',
            senderCustomerId: user.userId,
            message,
          },
        },
      },
      include: this.threadDetailInclude,
    });

    await this.notifySeller(updated, 'CUSTOMER');
    return this.mapThreadDetail(updated, 'CUSTOMER');
  }

  async markCustomerThreadRead(threadId: string, user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: {
        id: threadId,
        customerId: user.userId,
      },
      select: { id: true },
    });

    if (!thread) {
      throw this.notFound();
    }

    await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: {
        lastCustomerReadAt: new Date(),
      },
    });

    return { success: true };
  }

  async reportCustomerThread(
    threadId: string,
    user: AuthenticatedUser,
    reason?: string,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: {
        id: threadId,
        customerId: user.userId,
      },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    const updated = await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: {
        status: 'REPORTED',
        reportedAt: new Date(),
        reportedReason: reason?.trim() || null,
      },
      include: this.threadDetailInclude,
    });

    await this.notificationsService.broadcastToAdmins({
      shopId: updated.shopId,
      orderId: updated.orderId,
      type: 'MESSAGE_REPORTED',
      title: 'Reported conversation',
      message: `Conversation for shop ${updated.shop.name} was reported by a customer.`,
      actionUrl: `/admin/messages/${updated.id}`,
      severity: 'WARNING',
      dedupeKey: `message-report:${updated.id}`,
    });

    return this.mapThreadDetail(updated, 'CUSTOMER');
  }

  async listSellerThreads(
    shopId: string,
    user: AuthenticatedUser,
    query: ListMessageThreadsQueryDto,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);

    const items = await this.prisma.shopMessageThread.findMany({
      where: {
        shopId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                {
                  customer: {
                    fullName: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  product: {
                    localTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  product: {
                    wbTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      include: this.threadSummaryInclude,
    });

    return {
      items: items
        .map((item) => this.mapThreadSummary(item, 'SELLER'))
        .filter((item) =>
          query.filter === 'UNREAD'
            ? item.unread
            : query.filter === 'OPEN'
              ? item.status === 'OPEN'
              : query.filter === 'CLOSED'
                ? item.status === 'CLOSED'
                : query.filter === 'REPORTED'
                  ? item.status === 'REPORTED'
                  : true,
        ),
    };
  }

  async getSellerThread(
    shopId: string,
    threadId: string,
    user: AuthenticatedUser,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: { id: threadId, shopId },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    return this.mapThreadDetail(thread, 'SELLER');
  }

  async addSellerMessage(
    shopId: string,
    threadId: string,
    user: AuthenticatedUser,
    input: string,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);
    const message = this.normalizeMessage(input);
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: { id: threadId, shopId, sellerId: user.userId },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }
    this.assertThreadWritable(thread.status);

    const now = new Date();
    const updated = await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: {
        status: thread.status === 'REPORTED' ? 'REPORTED' : 'OPEN',
        lastMessageAt: now,
        lastSellerReadAt: now,
        messages: {
          create: {
            senderRole: 'SELLER',
            senderSellerId: user.userId,
            message,
          },
        },
      },
      include: this.threadDetailInclude,
    });

    await this.notifyCustomer(updated);
    return this.mapThreadDetail(updated, 'SELLER');
  }

  async markSellerThreadRead(
    shopId: string,
    threadId: string,
    user: AuthenticatedUser,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: { id: threadId, shopId, sellerId: user.userId },
      select: { id: true },
    });

    if (!thread) {
      throw this.notFound();
    }

    await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: {
        lastSellerReadAt: new Date(),
      },
    });

    return { success: true };
  }

  async closeSellerThread(
    shopId: string,
    threadId: string,
    user: AuthenticatedUser,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);
    const thread = await this.prisma.shopMessageThread.findFirst({
      where: { id: threadId, shopId, sellerId: user.userId },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    const updated = await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: {
        status: 'CLOSED',
      },
      include: this.threadDetailInclude,
    });

    return this.mapThreadDetail(updated, 'SELLER');
  }

  async listAdminThreads(query: ListMessageThreadsQueryDto) {
    const items = await this.prisma.shopMessageThread.findMany({
      where: {
        status: query.status ?? 'REPORTED',
      },
      orderBy: { lastMessageAt: 'desc' },
      include: this.threadSummaryInclude,
    });

    return {
      items: items.map((item) => this.mapThreadSummary(item, 'ADMIN')),
    };
  }

  async getAdminThread(threadId: string) {
    const thread = await this.prisma.shopMessageThread.findUnique({
      where: { id: threadId },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    return this.mapThreadDetail(thread, 'ADMIN');
  }

  async closeAdminThread(threadId: string, admin: AuthenticatedUser) {
    this.assertRole(admin, USER_ROLES.ADMIN, 'Admin account is required.');
    const thread = await this.prisma.shopMessageThread.findUnique({
      where: { id: threadId },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    const updated = await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: { status: 'CLOSED' },
      include: this.threadDetailInclude,
    });

    return this.mapThreadDetail(updated, 'ADMIN');
  }

  async reopenAdminThread(threadId: string, admin: AuthenticatedUser) {
    this.assertRole(admin, USER_ROLES.ADMIN, 'Admin account is required.');
    const thread = await this.prisma.shopMessageThread.findUnique({
      where: { id: threadId },
      include: this.threadDetailInclude,
    });

    if (!thread) {
      throw this.notFound();
    }

    const updated = await this.prisma.shopMessageThread.update({
      where: { id: threadId },
      data: { status: 'OPEN' },
      include: this.threadDetailInclude,
    });

    return this.mapThreadDetail(updated, 'ADMIN');
  }

  private async assertCustomerOrderContext(
    customerId: string,
    orderId: string,
    shopId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        shopId,
      },
      select: { id: true },
    });

    if (!order) {
      throw new ForbiddenException({
        code: 'MESSAGE_FORBIDDEN',
        message: 'This order context is not available for messaging.',
      });
    }
  }

  private async findPublicShopForMessaging(shopId?: string, shopSlug?: string) {
    if (!shopId && !shopSlug) {
      throw new BadRequestException({
        code: 'MESSAGE_SHOP_NOT_AVAILABLE',
        message: 'Shop context is required to start a conversation.',
      });
    }

    const shop = await this.prisma.shop.findFirst({
      where: {
        ...(shopId ? { id: shopId } : { slug: shopSlug }),
        status: 'ACTIVE',
        sellerProfile: {
          approvalStatus: 'APPROVED',
        },
      },
      include: {
        sellerProfile: {
          include: {
            user: {
              select: {
                id: true,
                preferredLocale: true,
              },
            },
          },
        },
      },
    });

    if (!shop || !shop.sellerProfile?.user?.id) {
      throw new NotFoundException({
        code: 'MESSAGE_SHOP_NOT_AVAILABLE',
        message: 'This shop is not available for messaging.',
      });
    }

    return shop;
  }

  private async assertSellerOwnsShop(shopId: string, sellerUserId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        id: shopId,
        sellerProfile: {
          userId: sellerUserId,
        },
      },
      select: { id: true },
    });

    if (!shop) {
      throw new ForbiddenException({
        code: 'MESSAGE_FORBIDDEN',
        message: 'You do not have access to this conversation.',
      });
    }
  }

  private assertThreadWritable(status: string) {
    if (status === 'CLOSED') {
      throw new BadRequestException({
        code: 'MESSAGE_THREAD_CLOSED',
        message: 'This conversation is closed.',
      });
    }
  }

  private assertRole(user: AuthenticatedUser, role: string, message: string) {
    if (user.role !== role) {
      throw new ForbiddenException({
        code: 'MESSAGE_FORBIDDEN',
        message,
      });
    }
  }

  private normalizeMessage(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'MESSAGE_EMPTY',
        message: 'Message cannot be empty.',
      });
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException({
        code: 'MESSAGE_TOO_LONG',
        message: 'Message is too long.',
      });
    }
    return trimmed;
  }

  private notFound() {
    return new NotFoundException({
      code: 'MESSAGE_THREAD_NOT_FOUND',
      message: 'Conversation was not found.',
    });
  }

  private mapThreadSummary(thread: ThreadSummaryRecord, viewer: ViewerRole) {
    const latest = thread.messages[0] ?? null;
    const unread =
      latest &&
      latest.senderRole !== viewer &&
      latest.createdAt >
        (viewer === 'CUSTOMER'
          ? (thread.lastCustomerReadAt ?? new Date(0))
          : viewer === 'SELLER'
            ? (thread.lastSellerReadAt ?? new Date(0))
            : new Date(0));

    return {
      id: thread.id,
      status: thread.status,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt.toISOString(),
      reportedAt: thread.reportedAt?.toISOString() ?? null,
      reportedReason: thread.reportedReason ?? null,
      unread: Boolean(unread),
      shop: {
        id: thread.shop.id,
        name: thread.shop.name,
        slug: thread.shop.slug,
        logoUrl: thread.shop.logoUrl,
      },
      product: thread.product
        ? {
            id: thread.product.id,
            name: thread.product.localTitle ?? thread.product.wbTitle,
            imageUrl:
              thread.product.images[0]?.localUrl ??
              thread.product.images[0]?.wbUrl ??
              null,
          }
        : null,
      order: thread.order
        ? {
            id: thread.order.id,
            orderCode: thread.order.orderNumber,
            status: thread.order.status,
            paymentStatus: thread.order.paymentStatus,
          }
        : null,
      customer: {
        id: thread.customer.id,
        fullName: thread.customer.fullName ?? thread.customer.email,
      },
      seller: {
        id: thread.seller.id,
        fullName: thread.seller.fullName ?? thread.seller.email,
      },
      latestMessage: latest
        ? {
            id: latest.id,
            senderRole: latest.senderRole,
            message: latest.message,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
    };
  }

  private mapThreadDetail(thread: ThreadDetailRecord, viewer: ViewerRole) {
    const summary = this.mapThreadSummary(thread, viewer);
    return {
      ...summary,
      canReply: thread.status !== 'CLOSED',
      canReport: viewer === 'CUSTOMER',
      canClose: viewer === 'SELLER' || viewer === 'ADMIN',
      messages: thread.messages.map((message) => ({
        id: message.id,
        senderRole: message.senderRole,
        senderName:
          message.senderCustomer?.fullName ??
          message.senderSeller?.fullName ??
          message.senderAdmin?.fullName ??
          message.senderCustomer?.email ??
          message.senderSeller?.email ??
          message.senderAdmin?.email ??
          message.senderRole,
        message: message.message,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  private async notifySeller(
    thread: ThreadDetailRecord,
    senderRole: 'CUSTOMER',
  ) {
    const locale = this.resolveLocale(thread.seller.preferredLocale, 'SELLER');
    await this.notificationsService.createNotification({
      recipientUserId: thread.sellerId,
      recipientRole: 'SELLER',
      shopId: thread.shopId,
      orderId: thread.orderId,
      type: 'MESSAGE_RECEIVED',
      title: this.translateMessageNotificationTitle(
        'SELLER',
        locale,
        senderRole,
      ),
      message: this.translateMessageNotificationBody(
        'SELLER',
        locale,
        senderRole,
      ),
      actionUrl: `/seller/messages/${thread.id}`,
      severity: 'INFO',
    });
  }

  private async notifyCustomer(thread: ThreadDetailRecord) {
    const locale = this.resolveLocale(
      thread.customer.preferredLocale,
      'CUSTOMER',
    );
    await this.notificationsService.createNotification({
      recipientUserId: thread.customerId,
      recipientRole: 'CUSTOMER',
      shopId: thread.shopId,
      orderId: thread.orderId,
      type: 'MESSAGE_RECEIVED',
      title: this.translateMessageNotificationTitle(
        'CUSTOMER',
        locale,
        'SELLER',
      ),
      message: this.translateMessageNotificationBody(
        'CUSTOMER',
        locale,
        'SELLER',
      ),
      actionUrl: `/customer/messages/${thread.id}`,
      severity: 'INFO',
    });
  }

  private resolveLocale(
    preferredLocale: string | null | undefined,
    role: 'CUSTOMER' | 'SELLER' | 'ADMIN',
  ) {
    if (role === 'ADMIN') {
      return 'en';
    }
    if (role === 'CUSTOMER') {
      return preferredLocale === 'en' ? 'en' : 'ru';
    }
    if (preferredLocale === 'en' || preferredLocale === 'vi') {
      return preferredLocale;
    }
    return 'ru';
  }

  private translateMessageNotificationTitle(
    recipientRole: 'CUSTOMER' | 'SELLER',
    locale: string,
    senderRole: 'CUSTOMER' | 'SELLER',
  ) {
    if (recipientRole === 'CUSTOMER') {
      return locale === 'ru'
        ? 'Новое сообщение от магазина'
        : 'New message from shop';
    }

    if (locale === 'vi') {
      return senderRole === 'CUSTOMER'
        ? 'Tin nhắn mới từ khách hàng'
        : 'Tin nhắn mới từ quản trị viên';
    }

    if (locale === 'en') {
      return senderRole === 'CUSTOMER'
        ? 'New message from customer'
        : 'New message';
    }

    return senderRole === 'CUSTOMER'
      ? 'Новое сообщение от покупателя'
      : 'Новое сообщение';
  }

  private translateMessageNotificationBody(
    recipientRole: 'CUSTOMER' | 'SELLER',
    locale: string,
    senderRole: 'CUSTOMER' | 'SELLER',
  ) {
    if (recipientRole === 'CUSTOMER') {
      return locale === 'ru'
        ? 'У вас новое сообщение от магазина.'
        : 'You have a new message from the shop.';
    }

    if (locale === 'vi') {
      return senderRole === 'CUSTOMER'
        ? 'Bạn có tin nhắn mới từ khách hàng.'
        : 'Bạn có tin nhắn mới.';
    }

    if (locale === 'en') {
      return senderRole === 'CUSTOMER'
        ? 'You have a new message from a customer.'
        : 'You have a new message.';
    }

    return senderRole === 'CUSTOMER'
      ? 'У вас новое сообщение от покупателя.'
      : 'У вас новое сообщение.';
  }
}
