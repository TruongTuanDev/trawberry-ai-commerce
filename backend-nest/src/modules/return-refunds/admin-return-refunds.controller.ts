import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminReturnRefundDecisionDto } from './dto/admin-return-refund-decision.dto';
import { CreateReturnRefundMessageDto } from './dto/create-return-refund-message.dto';
import { ListReturnRefundCasesQueryDto } from './dto/list-return-refund-cases-query.dto';
import { ReturnRefundsService } from './return-refunds.service';

@ApiTags('admin-returns')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('api/admin/returns')
export class AdminReturnRefundsController {
  constructor(private readonly returnRefundsService: ReturnRefundsService) {}

  @Get()
  list(@Query() query: ListReturnRefundCasesQueryDto) {
    return this.returnRefundsService.listAdminCases(query);
  }

  @Get(':caseId')
  detail(@Param('caseId') caseId: string) {
    return this.returnRefundsService.getAdminCase(caseId);
  }

  @Post(':caseId/decision')
  decision(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminReturnRefundDecisionDto,
  ) {
    return this.returnRefundsService.adminDecision(caseId, user, dto);
  }

  @Post(':caseId/messages')
  addMessage(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnRefundMessageDto,
  ) {
    return this.returnRefundsService.addAdminMessage(
      caseId,
      user,
      dto,
      'PUBLIC',
    );
  }

  @Post(':caseId/internal-note')
  addInternalNote(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnRefundMessageDto,
  ) {
    return this.returnRefundsService.addAdminMessage(
      caseId,
      user,
      dto,
      'INTERNAL_ADMIN',
    );
  }
}
