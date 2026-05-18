import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminQueueTasksService } from './admin-queue-tasks.service';
import {
  AssignAdminQueueTaskDto,
  CreateAdminQueueTaskDto,
  EscalateAdminQueueTaskDto,
  ListAdminQueueTasksQueryDto,
  UpdateAdminQueueTaskStatusDto,
} from './dto/admin-queue-task.dto';

@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/queue-tasks')
export class AdminQueueTasksController {
  constructor(private readonly tasksService: AdminQueueTasksService) {}

  @Get()
  list(@Query() query: ListAdminQueueTasksQueryDto) {
    return this.tasksService.list(query);
  }

  @Post()
  create(
    @Body() dto: CreateAdminQueueTaskDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tasksService.create(dto, admin);
  }

  @Post(':taskId/assign')
  assign(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: AssignAdminQueueTaskDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tasksService.assign(taskId, dto, admin);
  }

  @Post(':taskId/unassign')
  unassign(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tasksService.unassign(taskId, admin);
  }

  @Post(':taskId/status')
  updateStatus(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateAdminQueueTaskStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tasksService.updateStatus(taskId, dto, admin);
  }

  @Post(':taskId/escalate')
  escalate(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: EscalateAdminQueueTaskDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tasksService.escalate(taskId, dto, admin);
  }

  @Get(':taskId/events')
  events(@Param('taskId', new ParseUUIDPipe()) taskId: string) {
    return this.tasksService.listEvents(taskId);
  }
}
