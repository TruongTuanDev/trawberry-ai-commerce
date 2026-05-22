import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { FilesService } from '../files/files.service';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { SellerFinanceService } from '../seller-finance/seller-finance.service';
import { AdminReturnRefundDecisionDto } from './dto/admin-return-refund-decision.dto';
import { CreateReturnRefundCaseDto } from './dto/create-return-refund-case.dto';
import { CreateReturnRefundMessageDto } from './dto/create-return-refund-message.dto';
import { ListReturnRefundCasesQueryDto } from './dto/list-return-refund-cases-query.dto';
import { SellerRefundSentDto } from './dto/seller-refund-sent.dto';
import { SellerRespondReturnRefundDto } from './dto/seller-respond-return-refund.dto';
import {
  ACTIVE_RETURN_REFUND_STATUSES,
  FINAL_PAYMENT_CONFIRMED_STATUSES,
  RETURN_REFUND_CUSTOMER_WINDOW_DAYS,
  RETURN_REFUND_SELLER_RESPONSE_SLA_DAYS,
} from './return-refunds.constants';

@Injectable()
export class ReturnRefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly sellerFinanceService: SellerFinanceService,
  ) {}

  async createCustomerCase(
    orderId: string,
    user: AuthenticatedUser,
    dto: CreateReturnRefundCaseDto,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const order = await this.findOrderForCase(orderId);
    if (order.customerId !== user.userId) {
      throw new NotFoundException('Order was not found.');
    }

    const paidProductAmount = this.resolveProductAmount(
      order.totalAmount,
      order.shippingCost,
    );
    const requestedAmount = this.toMoney(dto.requestedAmount);
    if (requestedAmount.gt(paidProductAmount)) {
      throw new BadRequestException(
        'Requested refund amount cannot exceed paid product amount.',
      );
    }

    const finalPaymentConfirmed = this.isFinalPaymentConfirmed(order);
    if (!finalPaymentConfirmed && dto.type !== 'PAYMENT_DISPUTE_ONLY') {
      throw new BadRequestException(
        'Only payment dispute cases can be opened before final payment is confirmed.',
      );
    }

    this.assertCaseWindow(order);

    const existingActive = await this.prisma.returnRefundCase.findFirst({
      where: {
        orderId,
        status: { in: [...ACTIVE_RETURN_REFUND_STATUSES] },
      },
      select: { id: true },
    });
    if (existingActive) {
      throw new BadRequestException(
        'An active return/refund case already exists for this order.',
      );
    }

    const openedAt = new Date();
    const sellerResponseDueAt = new Date(openedAt);
    sellerResponseDueAt.setUTCDate(
      sellerResponseDueAt.getUTCDate() + RETURN_REFUND_SELLER_RESPONSE_SLA_DAYS,
    );

    const created = await this.prisma.returnRefundCase.create({
      data: {
        id: randomUUID(),
        checkoutId: order.marketplaceCheckoutId,
        orderId: order.id,
        shopId: order.shopId,
        sellerId: order.shop.sellerProfile.userId,
        customerId: user.userId,
        type: dto.type,
        reason: dto.reason,
        status: 'WAITING_SELLER_RESPONSE',
        requestedAmount,
        productAmount: paidProductAmount,
        currency: 'RUB',
        buyerComment: dto.buyerComment.trim(),
        openedAt,
        sellerResponseDueAt,
        messages: {
          create: {
            id: randomUUID(),
            authorId: user.userId,
            authorRole: 'CUSTOMER',
            visibility: 'PUBLIC',
            message: dto.buyerComment.trim(),
          },
        },
      },
      include: this.caseInclude,
    });

    return this.toCaseResponse(created, 'CUSTOMER');
  }

  async listCustomerCases(user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const items = await this.prisma.returnRefundCase.findMany({
      where: { customerId: user.userId },
      include: this.caseInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      items: items.map((item) => this.toCaseResponse(item, 'CUSTOMER')),
    };
  }

  async getCustomerCase(caseId: string, user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, customerId: user.userId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    return this.toCaseResponse(returnCase, 'CUSTOMER');
  }

  async addCustomerMessage(
    caseId: string,
    user: AuthenticatedUser,
    dto: CreateReturnRefundMessageDto,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, customerId: user.userId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    this.assertCaseWritable(returnCase.status);

    const nextStatus =
      returnCase.status === 'WAITING_BUYER_EVIDENCE'
        ? 'WAITING_SELLER_RESPONSE'
        : returnCase.status;
    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        status: nextStatus,
        messages: {
          create: {
            id: randomUUID(),
            authorId: user.userId,
            authorRole: 'CUSTOMER',
            visibility: 'PUBLIC',
            message: dto.message.trim(),
          },
        },
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'CUSTOMER');
  }

  async uploadCustomerEvidence(
    caseId: string,
    user: AuthenticatedUser,
    file: ProductImageUploadFile,
    label?: string,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, customerId: user.userId },
      select: { id: true, shopId: true, status: true },
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    this.assertCaseWritable(returnCase.status);

    this.assertEvidenceFile(file);
    const stored = await this.filesService.storeReturnRefundEvidence(file, {
      shopId: returnCase.shopId,
      caseId: returnCase.id,
      folder: 'evidence',
    });

    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        status:
          returnCase.status === 'WAITING_BUYER_EVIDENCE'
            ? 'WAITING_SELLER_RESPONSE'
            : returnCase.status,
        evidence: {
          create: {
            id: randomUUID(),
            uploadedById: user.userId,
            uploadedByRole: 'CUSTOMER',
            fileUrl: stored.publicUrl,
            storageKey: stored.storageKey,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            size: stored.size,
            fileType: stored.mimeType ?? 'application/octet-stream',
            label: label?.trim() || null,
          },
        },
      },
      include: this.caseInclude,
    });

    return this.toCaseResponse(updated, 'CUSTOMER');
  }

  async confirmRefundReceived(caseId: string, user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    return this.prisma.$transaction(async (tx) => {
      const returnCase = await tx.returnRefundCase.findFirst({
        where: { id: caseId, customerId: user.userId },
        include: {
          manualTransfers: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!returnCase) {
        throw new NotFoundException('Return/refund case was not found.');
      }
      if (
        !['REFUND_MARKED_SENT', 'REFUND_PENDING', 'APPROVED'].includes(
          returnCase.status,
        )
      ) {
        throw new BadRequestException(
          'Refund cannot be confirmed in the current state.',
        );
      }

      const latestTransfer = returnCase.manualTransfers[0];
      if (!latestTransfer) {
        throw new BadRequestException(
          'Seller has not marked a refund transfer yet.',
        );
      }

      await tx.refundManualTransfer.update({
        where: { id: latestTransfer.id },
        data: { status: 'BUYER_CONFIRMED_RECEIVED' },
      });

      const now = new Date();
      await tx.returnRefundCase.update({
        where: { id: caseId },
        data: {
          status: 'REFUND_CONFIRMED',
          refundConfirmedAt: now,
          closedAt: now,
        },
      });

      await this.sellerFinanceService.syncReturnRefundAdjustment(tx, caseId);

      const refreshed = await tx.returnRefundCase.findUnique({
        where: { id: caseId },
        include: this.caseInclude,
      });
      return this.toCaseResponseOrThrow(refreshed, 'CUSTOMER');
    });
  }

  async cancelCustomerCase(caseId: string, user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, customerId: user.userId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    if (
      !['OPENED', 'WAITING_SELLER_RESPONSE', 'WAITING_BUYER_EVIDENCE'].includes(
        returnCase.status,
      )
    ) {
      throw new BadRequestException('This case can no longer be cancelled.');
    }

    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        closedAt: new Date(),
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'CUSTOMER');
  }

  async listShopCases(
    shopId: string,
    user: AuthenticatedUser,
    query?: ListReturnRefundCasesQueryDto,
  ) {
    this.assertSellerAccess(user);
    await this.assertSellerOwnsShop(shopId, user);
    const where = this.buildCaseWhere({ ...query, shopId });
    const items = await this.prisma.returnRefundCase.findMany({
      where,
      include: this.caseInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return { items: items.map((item) => this.toCaseResponse(item, 'SELLER')) };
  }

  async getShopCase(shopId: string, caseId: string, user: AuthenticatedUser) {
    this.assertSellerAccess(user);
    await this.assertSellerOwnsShop(shopId, user);
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, shopId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    return this.toCaseResponse(returnCase, 'SELLER');
  }

  async sellerRespond(
    shopId: string,
    caseId: string,
    user: AuthenticatedUser,
    dto: SellerRespondReturnRefundDto,
  ) {
    this.assertSellerAccess(user);
    await this.assertSellerOwnsShop(shopId, user);
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, shopId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    this.assertCaseWritable(returnCase.status);

    const now = new Date();
    const nextStatus = this.resolveSellerResponseStatus(
      returnCase.type,
      dto.action,
    );
    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        status: nextStatus,
        sellerComment: dto.sellerComment?.trim() || null,
        sellerRespondedAt: now,
        messages: dto.sellerComment?.trim()
          ? {
              create: {
                id: randomUUID(),
                authorId: user.userId,
                authorRole: 'SELLER',
                visibility: 'PUBLIC',
                message: dto.sellerComment.trim(),
              },
            }
          : undefined,
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'SELLER');
  }

  async markReturnReceived(
    shopId: string,
    caseId: string,
    user: AuthenticatedUser,
  ) {
    this.assertSellerAccess(user);
    await this.assertSellerOwnsShop(shopId, user);
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, shopId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        status: 'RETURN_RECEIVED',
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'SELLER');
  }

  async markRefundSent(
    shopId: string,
    caseId: string,
    user: AuthenticatedUser,
    dto: SellerRefundSentDto,
    file?: ProductImageUploadFile,
  ) {
    this.assertSellerAccess(user);
    await this.assertSellerOwnsShop(shopId, user);
    this.assertOptionalEvidenceFile(file);
    return this.prisma.$transaction(async (tx) => {
      const returnCase = await tx.returnRefundCase.findFirst({
        where: { id: caseId, shopId },
      });
      if (!returnCase) {
        throw new NotFoundException('Return/refund case was not found.');
      }

      const amount = this.toMoney(dto.amount);
      const approvedAmount =
        returnCase.approvedAmount ?? returnCase.requestedAmount;
      if (amount.gt(approvedAmount)) {
        throw new BadRequestException(
          'Refund amount cannot exceed approved amount.',
        );
      }

      const stored = file
        ? await this.filesService.storeReturnRefundEvidence(file, {
            shopId,
            caseId,
            folder: 'refund-proof',
          })
        : null;

      await tx.refundManualTransfer.create({
        data: {
          id: randomUUID(),
          caseId,
          sellerId: returnCase.sellerId,
          customerId: returnCase.customerId,
          amount,
          currency: returnCase.currency,
          method: dto.method,
          proofImageUrl: stored?.publicUrl ?? null,
          proofStorageKey: stored?.storageKey ?? null,
          bankReference: dto.bankReference?.trim() || null,
          status: 'MARKED_SENT',
        },
      });

      const updated = await tx.returnRefundCase.update({
        where: { id: caseId },
        data: {
          status: 'REFUND_MARKED_SENT',
          sellerComment: dto.note?.trim() || returnCase.sellerComment,
          messages: dto.note?.trim()
            ? {
                create: {
                  id: randomUUID(),
                  authorId: user.userId,
                  authorRole: 'SELLER',
                  visibility: 'PUBLIC',
                  message: dto.note.trim(),
                },
              }
            : undefined,
        },
        include: this.caseInclude,
      });
      return this.toCaseResponseOrThrow(updated, 'SELLER');
    });
  }

  async addSellerMessage(
    shopId: string,
    caseId: string,
    user: AuthenticatedUser,
    dto: CreateReturnRefundMessageDto,
  ) {
    this.assertSellerAccess(user);
    await this.assertSellerOwnsShop(shopId, user);
    const returnCase = await this.prisma.returnRefundCase.findFirst({
      where: { id: caseId, shopId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    this.assertCaseWritable(returnCase.status);

    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        messages: {
          create: {
            id: randomUUID(),
            authorId: user.userId,
            authorRole: 'SELLER',
            visibility: 'PUBLIC',
            message: dto.message.trim(),
          },
        },
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'SELLER');
  }

  async listAdminCases(query: ListReturnRefundCasesQueryDto) {
    const where = this.buildCaseWhere(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.returnRefundCase.findMany({
        where,
        include: this.caseInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.returnRefundCase.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toCaseResponse(item, 'ADMIN')),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getAdminCase(caseId: string) {
    const returnCase = await this.prisma.returnRefundCase.findUnique({
      where: { id: caseId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    return this.toCaseResponse(returnCase, 'ADMIN');
  }

  async adminDecision(
    caseId: string,
    user: AuthenticatedUser,
    dto: AdminReturnRefundDecisionDto,
  ) {
    this.assertRole(user, USER_ROLES.ADMIN, 'Admin access is required.');
    return this.prisma.$transaction(async (tx) => {
      const returnCase = await tx.returnRefundCase.findUnique({
        where: { id: caseId },
        include: {
          manualTransfers: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!returnCase) {
        throw new NotFoundException('Return/refund case was not found.');
      }

      const approvedAmount =
        dto.approvedAmount !== undefined
          ? this.toMoney(dto.approvedAmount)
          : (returnCase.approvedAmount ?? returnCase.requestedAmount);
      if (approvedAmount.gt(returnCase.productAmount)) {
        throw new BadRequestException(
          'Approved amount cannot exceed paid product amount.',
        );
      }

      let nextStatus = returnCase.status;
      if (dto.decision === 'APPROVE') {
        nextStatus = this.resolveAdminApprovedStatus(
          returnCase.type,
          returnCase.status,
        );
      } else if (dto.decision === 'REJECT') {
        nextStatus = 'REJECTED';
      } else if (dto.decision === 'REQUEST_MORE_EVIDENCE') {
        nextStatus = 'WAITING_BUYER_EVIDENCE';
      } else if (dto.decision === 'CLOSE') {
        nextStatus = 'CLOSED';
      } else if (dto.decision === 'OVERRIDE_REFUND_CONFIRMED') {
        nextStatus = 'REFUND_CONFIRMED';
      }

      if (dto.decision === 'OVERRIDE_REFUND_CONFIRMED') {
        const latestTransfer = returnCase.manualTransfers[0];
        if (latestTransfer) {
          await tx.refundManualTransfer.update({
            where: { id: latestTransfer.id },
            data: { status: 'ADMIN_CONFIRMED' },
          });
        }
      }

      const now = new Date();
      const updated = await tx.returnRefundCase.update({
        where: { id: caseId },
        data: {
          approvedAmount,
          adminDecision: dto.adminNote.trim(),
          adminReviewedAt: now,
          refundConfirmedAt:
            dto.decision === 'OVERRIDE_REFUND_CONFIRMED' ? now : undefined,
          closedAt:
            dto.decision === 'OVERRIDE_REFUND_CONFIRMED' ||
            dto.decision === 'CLOSE'
              ? now
              : undefined,
          status: nextStatus,
          messages: {
            create: {
              id: randomUUID(),
              authorId: user.userId,
              authorRole: 'ADMIN',
              visibility: 'PUBLIC',
              message: dto.adminNote.trim(),
            },
          },
        },
        include: this.caseInclude,
      });

      if (dto.decision === 'OVERRIDE_REFUND_CONFIRMED') {
        await this.sellerFinanceService.syncReturnRefundAdjustment(tx, caseId);
      }

      return this.toCaseResponseOrThrow(updated, 'ADMIN');
    });
  }

  async addAdminMessage(
    caseId: string,
    user: AuthenticatedUser,
    dto: CreateReturnRefundMessageDto,
    visibility: 'PUBLIC' | 'INTERNAL_ADMIN' = 'PUBLIC',
  ) {
    this.assertRole(user, USER_ROLES.ADMIN, 'Admin access is required.');
    const returnCase = await this.prisma.returnRefundCase.findUnique({
      where: { id: caseId },
      include: this.caseInclude,
    });
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }

    const updated = await this.prisma.returnRefundCase.update({
      where: { id: caseId },
      data: {
        messages: {
          create: {
            id: randomUUID(),
            authorId: user.userId,
            authorRole: 'ADMIN',
            visibility,
            message: dto.message.trim(),
          },
        },
      },
      include: this.caseInclude,
    });
    return this.toCaseResponse(updated, 'ADMIN');
  }

  private buildCaseWhere(
    query?: ListReturnRefundCasesQueryDto,
  ): Prisma.ReturnRefundCaseWhereInput {
    const where: Prisma.ReturnRefundCaseWhereInput = {};
    if (!query) return where;
    if (query.status) where.status = query.status;
    if (query.reason) where.reason = query.reason;
    if (query.shopId) where.shopId = query.shopId;
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { id: q },
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { shop: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { fullName: { contains: q, mode: 'insensitive' } } },
        { customer: { email: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private async findOrderForCase(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            sellerProfile: {
              select: {
                userId: true,
              },
            },
          },
        },
        deliveryShipments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            deliveredAt: true,
            internalStatus: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order was not found.');
    }
    return order;
  }

  private isFinalPaymentConfirmed(order: { paymentStatus: string }) {
    return FINAL_PAYMENT_CONFIRMED_STATUSES.has(order.paymentStatus);
  }

  private assertCaseWindow(order: {
    createdAt: Date;
    deliveryShipments: Array<{
      deliveredAt: Date | null;
      internalStatus: string;
    }>;
  }) {
    const deliveredAt = order.deliveryShipments[0]?.deliveredAt;
    if (!deliveredAt) {
      return;
    }
    const deadline = new Date(deliveredAt);
    deadline.setUTCDate(
      deadline.getUTCDate() + RETURN_REFUND_CUSTOMER_WINDOW_DAYS,
    );
    if (new Date() > deadline) {
      throw new BadRequestException(
        `Return/refund window has expired after ${RETURN_REFUND_CUSTOMER_WINDOW_DAYS} days.`,
      );
    }
  }

  private assertCaseWritable(status: string) {
    if (
      ['CLOSED', 'CANCELLED', 'REJECTED', 'REFUND_CONFIRMED'].includes(status)
    ) {
      throw new BadRequestException('This case is already closed.');
    }
  }

  private resolveSellerResponseStatus(type: string, action: string) {
    if (action === 'REQUEST_EVIDENCE') {
      return 'WAITING_BUYER_EVIDENCE';
    }
    if (action === 'ESCALATE_ADMIN') {
      return 'ADMIN_REVIEW';
    }
    if (action === 'REJECT') {
      return 'SELLER_REJECTED';
    }
    if (type === 'RETURN_AND_REFUND' || type === 'EXCHANGE_REQUEST') {
      return 'WAITING_RETURN_SHIPMENT';
    }
    return 'REFUND_PENDING';
  }

  private resolveAdminApprovedStatus(type: string, currentStatus: string) {
    if (type === 'RETURN_AND_REFUND' || type === 'EXCHANGE_REQUEST') {
      if (currentStatus === 'RETURN_RECEIVED') {
        return 'REFUND_PENDING';
      }
      return 'WAITING_RETURN_SHIPMENT';
    }
    return 'REFUND_PENDING';
  }

  private assertRole(user: AuthenticatedUser, role: string, message: string) {
    if (user.role !== role) {
      throw new ForbiddenException(message);
    }
  }

  private assertSellerAccess(user: AuthenticatedUser) {
    if (user.role !== USER_ROLES.SELLER && user.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException('Seller access is required.');
    }
  }

  private async assertSellerOwnsShop(shopId: string, user: AuthenticatedUser) {
    if (user.role === USER_ROLES.ADMIN) {
      return;
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        sellerProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!shop || shop.sellerProfile?.userId !== user.userId) {
      throw new ForbiddenException(
        'You do not have access to return/refund cases for this shop.',
      );
    }
  }

  private assertEvidenceFile(file: ProductImageUploadFile) {
    this.assertOptionalEvidenceFile(file);
  }

  private assertOptionalEvidenceFile(file?: ProductImageUploadFile) {
    if (!file) return;
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported evidence type for ${file.originalname}.`,
      );
    }
  }

  private toMoney(amount: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(amount).toDecimalPlaces(2);
  }

  private resolveProductAmount(
    total: Prisma.Decimal,
    shipping: Prisma.Decimal,
  ) {
    const result = total.minus(shipping ?? new Prisma.Decimal(0));
    return result.greaterThan(0) ? result : new Prisma.Decimal(0);
  }

  private toCaseResponseOrThrow(
    returnCase: ReturnCaseWithRelations | null,
    viewer: 'CUSTOMER' | 'SELLER' | 'ADMIN',
  ) {
    if (!returnCase) {
      throw new NotFoundException('Return/refund case was not found.');
    }
    return this.toCaseResponse(returnCase, viewer);
  }

  toCaseResponse(
    returnCase: ReturnCaseWithRelations,
    viewer: 'CUSTOMER' | 'SELLER' | 'ADMIN',
  ) {
    const messages = returnCase.messages
      .filter(
        (entry) => viewer === 'ADMIN' || entry.visibility !== 'INTERNAL_ADMIN',
      )
      .map((entry) => ({
        id: entry.id,
        authorId: entry.authorId,
        authorRole: entry.authorRole,
        visibility: entry.visibility,
        message: entry.message,
        authorName: entry.author?.fullName ?? entry.author?.email ?? null,
        createdAt: entry.createdAt.toISOString(),
      }));

    return {
      id: returnCase.id,
      checkoutId: returnCase.checkoutId,
      orderId: returnCase.orderId,
      shopId: returnCase.shopId,
      sellerId: returnCase.sellerId,
      customerId: returnCase.customerId,
      type: returnCase.type,
      reason: returnCase.reason,
      status: returnCase.status,
      requestedAmount: returnCase.requestedAmount.toString(),
      approvedAmount: returnCase.approvedAmount?.toString() ?? null,
      productAmount: returnCase.productAmount.toString(),
      deliveryFeeRefundAmount: returnCase.deliveryFeeRefundAmount.toString(),
      platformFeeAdjustmentAmount:
        returnCase.platformFeeAdjustmentAmount.toString(),
      currency: returnCase.currency,
      buyerComment: returnCase.buyerComment,
      sellerComment: returnCase.sellerComment,
      adminDecision: returnCase.adminDecision,
      sellerResponseDueAt:
        returnCase.sellerResponseDueAt?.toISOString() ?? null,
      openedAt: returnCase.openedAt.toISOString(),
      sellerRespondedAt: returnCase.sellerRespondedAt?.toISOString() ?? null,
      adminReviewedAt: returnCase.adminReviewedAt?.toISOString() ?? null,
      refundConfirmedAt: returnCase.refundConfirmedAt?.toISOString() ?? null,
      closedAt: returnCase.closedAt?.toISOString() ?? null,
      cancelledAt: returnCase.cancelledAt?.toISOString() ?? null,
      createdAt: returnCase.createdAt.toISOString(),
      updatedAt: returnCase.updatedAt.toISOString(),
      order: {
        id: returnCase.order.id,
        orderCode: returnCase.order.orderNumber,
        status: returnCase.order.status,
        paymentStatus: returnCase.order.paymentStatus,
        paymentMethod: returnCase.order.paymentMethod,
        totalAmount: returnCase.order.totalAmount.toString(),
        shippingCost: returnCase.order.shippingCost.toString(),
      },
      shop: {
        id: returnCase.shop.id,
        name: returnCase.shop.name,
      },
      customer: {
        id: returnCase.customer.id,
        name: returnCase.customer.fullName,
        email: returnCase.customer.email,
        phone: returnCase.customer.phone,
      },
      seller: {
        id: returnCase.seller.id,
        name: returnCase.seller.fullName,
        email: returnCase.seller.email,
        phone: returnCase.seller.phone,
      },
      messages,
      evidence: returnCase.evidence.map((entry) => ({
        id: entry.id,
        uploadedById: entry.uploadedById,
        uploadedByRole: entry.uploadedByRole,
        fileUrl: entry.fileUrl,
        fileType: entry.fileType,
        label: entry.label,
        originalName: entry.originalName,
        createdAt: entry.createdAt.toISOString(),
      })),
      manualTransfers: returnCase.manualTransfers.map((entry) => ({
        id: entry.id,
        amount: entry.amount.toString(),
        currency: entry.currency,
        method: entry.method,
        proofImageUrl: entry.proofImageUrl,
        bankReference: entry.bankReference,
        status: entry.status,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
      finance: {
        latestLedgerStatus:
          returnCase.order.sellerFeeLedgerEntries[0]?.status ?? null,
        latestLedgerCommission:
          returnCase.order.sellerFeeLedgerEntries[0]?.commissionAmount.toString() ??
          null,
        latestAdjustmentId:
          returnCase.order.sellerFeeLedgerEntries.find(
            (entry) => entry.referenceCaseId === returnCase.id,
          )?.id ?? null,
      },
    };
  }

  private get caseInclude() {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          totalAmount: true,
          shippingCost: true,
          sellerFeeLedgerEntries: {
            orderBy: { createdAt: 'desc' as const },
            select: {
              id: true,
              status: true,
              commissionAmount: true,
              referenceCaseId: true,
            },
          },
        },
      },
      shop: {
        select: {
          id: true,
          name: true,
        },
      },
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          author: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
      evidence: {
        orderBy: { createdAt: 'asc' as const },
      },
      manualTransfers: {
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }
}

type ReturnCaseWithRelations = Prisma.ReturnRefundCaseGetPayload<{
  include: ReturnRefundsService['caseInclude'];
}>;
