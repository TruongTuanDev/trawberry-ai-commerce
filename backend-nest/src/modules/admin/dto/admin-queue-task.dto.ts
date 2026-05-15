import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const ADMIN_QUEUE_ENTITY_TYPES = [
  'SELLER',
  'PAYMENT',
  'DELIVERY',
  'INVENTORY',
  'ORDER',
] as const;
export const ADMIN_QUEUE_TASK_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_SELLER',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'ESCALATED',
] as const;
export const ADMIN_QUEUE_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const;
export const ADMIN_QUEUE_SLA_STATUSES = ['OK', 'WARNING', 'BREACHED'] as const;

export type AdminQueueEntityType = (typeof ADMIN_QUEUE_ENTITY_TYPES)[number];
export type AdminQueueTaskStatus = (typeof ADMIN_QUEUE_TASK_STATUSES)[number];
export type AdminQueuePriority = (typeof ADMIN_QUEUE_PRIORITIES)[number];

export class ListAdminQueueTasksQueryDto {
  @IsOptional()
  @IsIn(ADMIN_QUEUE_TASK_STATUSES)
  status?: AdminQueueTaskStatus;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsIn(ADMIN_QUEUE_ENTITY_TYPES)
  entityType?: AdminQueueEntityType;

  @IsOptional()
  @IsIn(ADMIN_QUEUE_PRIORITIES)
  priority?: AdminQueuePriority;

  @IsOptional()
  @IsIn(ADMIN_QUEUE_SLA_STATUSES)
  slaStatus?: 'OK' | 'WARNING' | 'BREACHED';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class CreateAdminQueueTaskDto {
  @IsIn(ADMIN_QUEUE_ENTITY_TYPES)
  entityType!: AdminQueueEntityType;

  @IsString()
  @MaxLength(100)
  entityId!: string;

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsIn(ADMIN_QUEUE_PRIORITIES)
  priority?: AdminQueuePriority;

  @IsOptional()
  @IsIn(ADMIN_QUEUE_SLA_STATUSES)
  slaStatus?: 'OK' | 'WARNING' | 'BREACHED';

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class AssignAdminQueueTaskDto {
  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}

export class UpdateAdminQueueTaskStatusDto {
  @IsIn(ADMIN_QUEUE_TASK_STATUSES)
  status!: AdminQueueTaskStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class EscalateAdminQueueTaskDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsIn(['HIGH', 'URGENT'])
  priority?: 'HIGH' | 'URGENT';
}
