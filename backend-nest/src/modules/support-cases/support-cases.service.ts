import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SupportCaseMessage } from '@prisma/client';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateCustomerSupportCaseDto } from './dto/create-customer-support-case.dto';
import {
  AdminCreateSupportCaseMessageDto,
  CreateSupportCaseMessageDto,
} from './dto/create-support-case-message.dto';
import { ListAdminSupportCasesQueryDto } from './dto/list-admin-support-cases-query.dto';
import { UpdateAdminSupportCaseDto } from './dto/update-admin-support-case.dto';
import {
  type SupportCasePriority,
  type SupportCaseSenderRole,
  type SupportCaseStatus,
} from './support-cases.constants';

@Injectable()
export class SupportCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomerCase(
    checkoutCode: string,
    user: AuthenticatedUser,
    dto: CreateCustomerSupportCaseDto,
  ) {
    this.assertCustomer(user);
    const checkout = await this.prisma.marketplaceCheckout.findFirst({
      where: {
        checkoutCode: checkoutCode.trim(),
        customerUserId: user.userId,
      },
      include: {
        orders: {
          select: {
            id: true,
            shopId: true,
          },
        },
      },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout receipt was not found.');
    }

    let orderId: string | null = null;
    let shopId: string | null = null;
    if (dto.orderId) {
      const order = checkout.orders.find((entry) => entry.id === dto.orderId);
      if (!order) {
        throw new BadRequestException(
          'Selected order does not belong to this checkout.',
        );
      }
      orderId = order.id;
      shopId = order.shopId;
    }

    const supportCase = await this.prisma.supportCase.create({
      data: {
        checkoutId: checkout.id,
        checkoutCode: checkout.checkoutCode,
        orderId,
        shopId,
        customerUserId: user.userId,
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        customerEmail: checkout.customerEmail,
        issueType: dto.issueType,
        status: 'OPEN',
        priority: this.defaultPriority(dto.issueType),
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        messages: {
          create: {
            senderUserId: user.userId,
            senderRole: 'CUSTOMER',
            message: dto.description.trim(),
            isInternal: false,
          },
        },
        events: {
          create: {
            actorUserId: user.userId,
            action: 'CASE_CREATED',
            toStatus: 'OPEN',
            note: dto.subject.trim(),
          },
        },
      },
      include: this.caseInclude,
    });

    return this.toCaseResponse(supportCase, 'CUSTOMER');
  }

  async listCustomerCases(user: AuthenticatedUser) {
    this.assertCustomer(user);
    const items = await this.prisma.supportCase.findMany({
      where: { customerUserId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: this.caseInclude,
    });

    return {
      items: items.map((entry) => this.toCaseResponse(entry, 'CUSTOMER')),
    };
  }

  async getCustomerCase(caseId: string, user: AuthenticatedUser) {
    this.assertCustomer(user);
    const supportCase = await this.prisma.supportCase.findFirst({
      where: {
        id: caseId,
        customerUserId: user.userId,
      },
      include: this.caseInclude,
    });

    if (!supportCase) {
      throw new NotFoundException('Support case was not found.');
    }

    return this.toCaseResponse(supportCase, 'CUSTOMER');
  }

  async addCustomerMessage(
    caseId: string,
    user: AuthenticatedUser,
    dto: CreateSupportCaseMessageDto,
  ) {
    this.assertCustomer(user);
    const supportCase = await this.prisma.supportCase.findFirst({
      where: {
        id: caseId,
        customerUserId: user.userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!supportCase) {
      throw new NotFoundException('Support case was not found.');
    }
    if (supportCase.status === 'CLOSED') {
      throw new BadRequestException('Closed support cases cannot be updated.');
    }

    const nextStatus =
      supportCase.status === 'WAITING_CUSTOMER' ? 'IN_REVIEW' : undefined;

    const updated = await this.prisma.supportCase.update({
      where: { id: caseId },
      data: {
        status: nextStatus,
        messages: {
          create: {
            senderUserId: user.userId,
            senderRole: 'CUSTOMER',
            message: dto.message.trim(),
            isInternal: false,
          },
        },
        events: nextStatus
          ? {
              create: {
                actorUserId: user.userId,
                action: 'CUSTOMER_REPLIED',
                fromStatus: supportCase.status,
                toStatus: nextStatus,
                note: dto.message.trim(),
              },
            }
          : undefined,
      },
      include: this.caseInclude,
    });

    return this.toCaseResponse(updated, 'CUSTOMER');
  }

  async listAdminCases(query: ListAdminSupportCasesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SupportCaseWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.issueType) where.issueType = query.issueType;
    if (query.priority) where.priority = query.priority;
    if (query.checkoutCode?.trim())
      where.checkoutCode = query.checkoutCode.trim();
    if (query.shopId) where.shopId = query.shopId;

    const [items, total] = await Promise.all([
      this.prisma.supportCase.findMany({
        where,
        include: this.caseInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportCase.count({ where }),
    ]);

    return {
      items: items.map((entry) => this.toCaseResponse(entry, 'ADMIN')),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getAdminCase(caseId: string) {
    const supportCase = await this.prisma.supportCase.findUnique({
      where: { id: caseId },
      include: this.caseInclude,
    });
    if (!supportCase) {
      throw new NotFoundException('Support case was not found.');
    }
    return this.toCaseResponse(supportCase, 'ADMIN');
  }

  async updateAdminCase(
    caseId: string,
    dto: UpdateAdminSupportCaseDto,
    admin: AuthenticatedUser,
  ) {
    if (admin.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException('Admin access is required.');
    }

    const current = await this.prisma.supportCase.findUnique({
      where: { id: caseId },
      include: this.caseInclude,
    });
    if (!current) {
      throw new NotFoundException('Support case was not found.');
    }

    if (dto.status) {
      this.assertStatusTransition(
        current.status as SupportCaseStatus,
        dto.status,
      );
    }

    const updated = await this.prisma.supportCase.update({
      where: { id: caseId },
      data: {
        status: dto.status,
        priority: dto.priority,
        resolutionNote:
          dto.resolutionNote === undefined
            ? undefined
            : dto.resolutionNote?.trim() || null,
        resolvedAt:
          dto.status === 'RESOLVED'
            ? new Date()
            : dto.status
              ? null
              : undefined,
        closedAt:
          dto.status === 'CLOSED' ? new Date() : dto.status ? null : undefined,
        events:
          dto.status || dto.priority || dto.resolutionNote !== undefined
            ? {
                create: {
                  actorUserId: admin.userId,
                  action: 'ADMIN_UPDATED_CASE',
                  fromStatus: dto.status ? current.status : undefined,
                  toStatus: dto.status,
                  note: dto.resolutionNote?.trim() || null,
                },
              }
            : undefined,
      },
      include: this.caseInclude,
    });

    return this.toCaseResponse(updated, 'ADMIN');
  }

  async addAdminMessage(
    caseId: string,
    admin: AuthenticatedUser,
    dto: AdminCreateSupportCaseMessageDto,
  ) {
    if (admin.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException('Admin access is required.');
    }

    await this.getAdminCase(caseId);
    const updated = await this.prisma.supportCase.update({
      where: { id: caseId },
      data: {
        messages: {
          create: {
            senderUserId: admin.userId,
            senderRole: 'ADMIN',
            message: dto.message.trim(),
            isInternal: dto.isInternal ?? false,
          },
        },
        events: {
          create: {
            actorUserId: admin.userId,
            action: dto.isInternal
              ? 'ADMIN_INTERNAL_MESSAGE'
              : 'ADMIN_PUBLIC_MESSAGE',
            note: dto.message.trim(),
          },
        },
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'ADMIN');
  }

  async listSellerCases(shopId: string, user: AuthenticatedUser) {
    this.assertSeller(user);
    const items = await this.prisma.supportCase.findMany({
      where: { shopId },
      include: this.caseInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      items: items.map((entry) => this.toCaseResponse(entry, 'SELLER')),
    };
  }

  async getSellerCase(shopId: string, caseId: string, user: AuthenticatedUser) {
    this.assertSeller(user);
    const supportCase = await this.prisma.supportCase.findFirst({
      where: {
        id: caseId,
        shopId,
      },
      include: this.caseInclude,
    });
    if (!supportCase) {
      throw new NotFoundException('Support case was not found.');
    }
    return this.toCaseResponse(supportCase, 'SELLER');
  }

  async addSellerMessage(
    shopId: string,
    caseId: string,
    user: AuthenticatedUser,
    dto: CreateSupportCaseMessageDto,
  ) {
    this.assertSeller(user);
    const existing = await this.prisma.supportCase.findFirst({
      where: { id: caseId, shopId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Support case was not found.');
    }
    if (existing.status === 'CLOSED') {
      throw new BadRequestException('Closed support cases cannot be updated.');
    }

    const updated = await this.prisma.supportCase.update({
      where: { id: caseId },
      data: {
        messages: {
          create: {
            senderUserId: user.userId,
            senderRole: 'SELLER',
            message: dto.message.trim(),
            isInternal: false,
          },
        },
        events: {
          create: {
            actorUserId: user.userId,
            action: 'SELLER_REPLIED',
            note: dto.message.trim(),
          },
        },
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'SELLER');
  }

  buildSummary(supportCase: {
    id: string;
    issueType: string;
    status: string;
    subject: string;
    orderId: string | null;
    createdAt: Date;
  }) {
    return {
      id: supportCase.id,
      issueType: supportCase.issueType,
      status: supportCase.status,
      subject: supportCase.subject,
      orderId: supportCase.orderId,
      createdAt: supportCase.createdAt.toISOString(),
    };
  }

  private defaultPriority(issueType: string): SupportCasePriority {
    if (issueType === 'REFUND_REQUEST' || issueType === 'DAMAGED_ITEM') {
      return 'HIGH';
    }
    if (issueType === 'PAYMENT_PROOF' || issueType === 'DELIVERY_DELAY') {
      return 'NORMAL';
    }
    return 'LOW';
  }

  private assertCustomer(user: AuthenticatedUser) {
    if (user.role !== USER_ROLES.CUSTOMER) {
      throw new ForbiddenException('Customer account is required.');
    }
  }

  private assertSeller(user: AuthenticatedUser) {
    if (user.role !== USER_ROLES.SELLER && user.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException('Seller access is required.');
    }
  }

  private assertStatusTransition(
    currentStatus: SupportCaseStatus,
    nextStatus: SupportCaseStatus,
  ) {
    if (currentStatus === nextStatus) return;
    const allowed: Record<SupportCaseStatus, SupportCaseStatus[]> = {
      OPEN: ['IN_REVIEW'],
      IN_REVIEW: ['WAITING_CUSTOMER', 'WAITING_SELLER', 'RESOLVED', 'REJECTED'],
      WAITING_CUSTOMER: ['IN_REVIEW', 'RESOLVED'],
      WAITING_SELLER: ['IN_REVIEW', 'RESOLVED'],
      RESOLVED: ['CLOSED'],
      REJECTED: ['CLOSED'],
      CLOSED: [],
    };
    if (!allowed[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid support case status transition from ${currentStatus} to ${nextStatus}.`,
      );
    }
  }

  private toCaseResponse(
    supportCase: SupportCaseWithRelations,
    viewer: SupportCaseSenderRole | 'CUSTOMER' | 'SELLER' | 'ADMIN',
  ) {
    const messages = supportCase.messages
      .filter((message) => viewer === 'ADMIN' || !message.isInternal)
      .map((message) => this.toMessageResponse(message));
    return {
      id: supportCase.id,
      checkoutId: supportCase.checkoutId,
      checkoutCode: supportCase.checkoutCode,
      orderId: supportCase.orderId,
      shopId: supportCase.shopId,
      shopName: supportCase.shop?.name ?? null,
      customerUserId: supportCase.customerUserId,
      customerName: supportCase.customerName,
      customerPhone: supportCase.customerPhone,
      customerEmail: supportCase.customerEmail,
      issueType: supportCase.issueType,
      status: supportCase.status,
      priority: supportCase.priority,
      subject: supportCase.subject,
      description: supportCase.description,
      resolutionNote: supportCase.resolutionNote,
      createdAt: supportCase.createdAt.toISOString(),
      updatedAt: supportCase.updatedAt.toISOString(),
      resolvedAt: supportCase.resolvedAt?.toISOString() ?? null,
      closedAt: supportCase.closedAt?.toISOString() ?? null,
      order: supportCase.order
        ? {
            id: supportCase.order.id,
            orderCode: supportCase.order.orderNumber,
            status: supportCase.order.status,
            paymentStatus: supportCase.order.paymentStatus,
          }
        : null,
      messages,
      events:
        viewer === 'ADMIN'
          ? supportCase.events.map((event) => ({
              id: event.id,
              actorUserId: event.actorUserId,
              action: event.action,
              fromStatus: event.fromStatus,
              toStatus: event.toStatus,
              note: event.note,
              createdAt: event.createdAt.toISOString(),
            }))
          : undefined,
    };
  }

  private toMessageResponse(
    message: SupportCaseMessage & {
      sender: { id: string; fullName: string | null; email: string } | null;
    },
  ) {
    return {
      id: message.id,
      senderUserId: message.senderUserId,
      senderRole: message.senderRole,
      senderName: message.sender?.fullName ?? message.sender?.email ?? null,
      message: message.message,
      isInternal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private get caseInclude() {
    return {
      shop: {
        select: {
          id: true,
          name: true,
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
      messages: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }
}

type SupportCaseWithRelations = Prisma.SupportCaseGetPayload<{
  include: SupportCasesService['caseInclude'];
}>;
