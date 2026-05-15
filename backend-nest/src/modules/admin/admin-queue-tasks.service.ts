import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  AdminQueuePriority,
  AdminQueueTaskStatus,
  AssignAdminQueueTaskDto,
  CreateAdminQueueTaskDto,
  EscalateAdminQueueTaskDto,
  ListAdminQueueTasksQueryDto,
  UpdateAdminQueueTaskStatusDto,
} from './dto/admin-queue-task.dto';

@Injectable()
export class AdminQueueTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminQueueTasksQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const where: Prisma.AdminQueueTaskWhereInput = {
      ...(query.status
        ? { status: query.status }
        : { status: { not: 'RESOLVED' } }),
      ...(query.assignedTo ? { assignedToUserId: query.assignedTo } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.slaStatus ? { slaStatus: query.slaStatus } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.adminQueueTask.count({ where }),
      this.prisma.adminQueueTask.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);
    return {
      items: rows.map((task) => this.mapTask(task)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      total,
      filters: query,
    };
  }

  async create(dto: CreateAdminQueueTaskDto, admin: AuthenticatedUser) {
    const existing = await this.prisma.adminQueueTask.findUnique({
      where: {
        entityType_entityId: {
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
      include: {
        assignedTo: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (existing) return this.mapTask(existing);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminQueueTask.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          shopId: dto.shopId,
          sellerId: dto.sellerId,
          title: dto.title,
          summary: dto.summary,
          priority: dto.priority ?? 'NORMAL',
          slaStatus: dto.slaStatus ?? 'OK',
          status: 'OPEN',
        },
      });
      await this.createEvent(tx, created.id, admin.userId, 'CREATED', {
        toStatus: 'OPEN',
      });
      await this.createAudit(
        tx,
        admin.userId,
        'ADMIN_QUEUE_TASK_CREATED',
        created,
      );
      return tx.adminQueueTask.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      });
    });
    return this.mapTask(task);
  }

  async assign(
    taskId: string,
    dto: AssignAdminQueueTaskDto,
    admin: AuthenticatedUser,
  ) {
    const task = await this.findTask(taskId);
    const assignedToUserId =
      !dto.assignedToUserId || dto.assignedToUserId === 'me'
        ? admin.userId
        : dto.assignedToUserId;
    await this.assertAssignableAdmin(assignedToUserId);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.adminQueueTask.update({
        where: { id: task.id },
        data: {
          assignedToUserId,
          assignedAt: now,
          status: task.status === 'OPEN' ? 'IN_PROGRESS' : task.status,
        },
      });
      await this.createEvent(tx, saved.id, admin.userId, 'ASSIGNED', {
        fromAssigneeId: task.assignedToUserId,
        toAssigneeId: assignedToUserId,
        fromStatus: task.status,
        toStatus: saved.status,
      });
      await this.createAudit(
        tx,
        admin.userId,
        'ADMIN_QUEUE_TASK_ASSIGNED',
        saved,
      );
      return tx.adminQueueTask.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      });
    });
    return this.mapTask(updated);
  }

  async unassign(taskId: string, admin: AuthenticatedUser) {
    const task = await this.findTask(taskId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.adminQueueTask.update({
        where: { id: task.id },
        data: { assignedToUserId: null, assignedAt: null },
      });
      await this.createEvent(tx, saved.id, admin.userId, 'UNASSIGNED', {
        fromAssigneeId: task.assignedToUserId,
      });
      await this.createAudit(
        tx,
        admin.userId,
        'ADMIN_QUEUE_TASK_UNASSIGNED',
        saved,
      );
      return tx.adminQueueTask.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      });
    });
    return this.mapTask(updated);
  }

  async updateStatus(
    taskId: string,
    dto: UpdateAdminQueueTaskStatusDto,
    admin: AuthenticatedUser,
  ) {
    const task = await this.findTask(taskId);
    const now = new Date();
    const data: Prisma.AdminQueueTaskUpdateInput = {
      status: dto.status,
      lastNote: dto.note,
      resolvedAt: dto.status === 'RESOLVED' ? now : task.resolvedAt,
      escalatedAt: dto.status === 'ESCALATED' ? now : task.escalatedAt,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.adminQueueTask.update({
        where: { id: task.id },
        data,
      });
      await this.createEvent(tx, saved.id, admin.userId, 'STATUS_CHANGED', {
        fromStatus: task.status,
        toStatus: dto.status,
        note: dto.note,
      });
      await this.createAudit(
        tx,
        admin.userId,
        'ADMIN_QUEUE_TASK_STATUS_CHANGED',
        saved,
        dto.note,
      );
      return tx.adminQueueTask.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      });
    });
    return this.mapTask(updated);
  }

  async escalate(
    taskId: string,
    dto: EscalateAdminQueueTaskDto,
    admin: AuthenticatedUser,
  ) {
    const task = await this.findTask(taskId);
    const now = new Date();
    const priority: AdminQueuePriority = dto.priority ?? 'HIGH';
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.adminQueueTask.update({
        where: { id: task.id },
        data: {
          status: 'ESCALATED',
          priority,
          escalatedAt: now,
          lastNote: dto.note,
        },
      });
      await this.createEvent(tx, saved.id, admin.userId, 'ESCALATED', {
        fromStatus: task.status,
        toStatus: 'ESCALATED',
        note: dto.note,
      });
      await this.createAudit(
        tx,
        admin.userId,
        'ADMIN_QUEUE_TASK_ESCALATED',
        saved,
        dto.note,
      );
      return tx.adminQueueTask.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      });
    });
    return this.mapTask(updated);
  }

  async listEvents(taskId: string) {
    await this.findTask(taskId);
    const events = await this.prisma.adminQueueTaskEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, email: true, fullName: true } } },
    });
    return events.map((event) => ({
      id: event.id,
      taskId: event.taskId,
      actorUserId: event.actorUserId,
      actorEmail: event.actor.email,
      actorName: event.actor.fullName,
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      fromAssigneeId: event.fromAssigneeId,
      toAssigneeId: event.toAssigneeId,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  async findTasksForEntities(
    entities: Array<{ entityType: string; entityId: string }>,
  ) {
    if (entities.length === 0)
      return new Map<string, ReturnType<typeof this.mapTask>>();
    const tasks = await this.prisma.adminQueueTask.findMany({
      where: {
        OR: entities.map((entity) => ({
          entityType: entity.entityType,
          entityId: entity.entityId,
        })),
      },
      include: {
        assignedTo: { select: { id: true, email: true, fullName: true } },
      },
    });
    return new Map(
      tasks.map((task) => [
        `${task.entityType}:${task.entityId}`,
        this.mapTask(task),
      ]),
    );
  }

  private async findTask(taskId: string) {
    const task = await this.prisma.adminQueueTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Admin queue task was not found.');
    return task;
  }

  private async assertAssignableAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      throw new BadRequestException('Only active admin users can be assigned.');
    }
  }

  private async createEvent(
    tx: Prisma.TransactionClient,
    taskId: string,
    actorUserId: string,
    action: string,
    data: {
      fromStatus?: string | null;
      toStatus?: string | null;
      fromAssigneeId?: string | null;
      toAssigneeId?: string | null;
      note?: string | null;
    } = {},
  ) {
    await tx.adminQueueTaskEvent.create({
      data: { taskId, actorUserId, action, ...data },
    });
  }

  private async createAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    action: string,
    task: {
      id: string;
      entityType: string;
      entityId: string;
      status: string;
      assignedToUserId: string | null;
    },
    reason?: string,
  ) {
    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action,
        entityType: 'ADMIN_QUEUE_TASK',
        entityId: task.id,
        reason,
        newValueJson: {
          entityType: task.entityType,
          entityId: task.entityId,
          status: task.status,
          assignedToUserId: task.assignedToUserId,
        },
      },
    });
  }

  private mapTask(
    task: Prisma.AdminQueueTaskGetPayload<{
      include: {
        assignedTo: { select: { id: true; email: true; fullName: true } };
      };
    }>,
  ) {
    return {
      id: task.id,
      entityType: task.entityType,
      entityId: task.entityId,
      shopId: task.shopId,
      sellerId: task.sellerId,
      assignedToUserId: task.assignedToUserId,
      assignedToEmail: task.assignedTo?.email ?? null,
      assignedToName: task.assignedTo?.fullName ?? null,
      status: task.status as AdminQueueTaskStatus,
      priority: task.priority,
      slaStatus: task.slaStatus,
      title: task.title,
      summary: task.summary,
      lastNote: task.lastNote,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      assignedAt: task.assignedAt?.toISOString() ?? null,
      resolvedAt: task.resolvedAt?.toISOString() ?? null,
      escalatedAt: task.escalatedAt?.toISOString() ?? null,
    };
  }
}
