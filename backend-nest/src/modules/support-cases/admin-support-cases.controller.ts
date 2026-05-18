import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminCreateSupportCaseMessageDto } from './dto/create-support-case-message.dto';
import { ListAdminSupportCasesQueryDto } from './dto/list-admin-support-cases-query.dto';
import { UpdateAdminSupportCaseDto } from './dto/update-admin-support-case.dto';
import { SupportCasesService } from './support-cases.service';

@ApiTags('admin-support-cases')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/support-cases')
export class AdminSupportCasesController {
  constructor(private readonly supportCasesService: SupportCasesService) {}

  @Get()
  @ApiOperation({ summary: 'List support cases for admin review.' })
  listCases(@Query() query: ListAdminSupportCasesQueryDto) {
    return this.supportCasesService.listAdminCases(query);
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Get one support case for admin review.' })
  getCase(@Param('caseId') caseId: string) {
    return this.supportCasesService.getAdminCase(caseId);
  }

  @Patch(':caseId')
  @ApiOperation({
    summary: 'Update support case status, priority, or resolution note.',
  })
  updateCase(
    @Param('caseId') caseId: string,
    @Body() dto: UpdateAdminSupportCaseDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.supportCasesService.updateAdminCase(caseId, dto, admin);
  }

  @Post(':caseId/messages')
  @ApiOperation({
    summary: 'Add a public or internal admin message to a support case.',
  })
  addMessage(
    @Param('caseId') caseId: string,
    @Body() dto: AdminCreateSupportCaseMessageDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.supportCasesService.addAdminMessage(caseId, admin, dto);
  }
}
