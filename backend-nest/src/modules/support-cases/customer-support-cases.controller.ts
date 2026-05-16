import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateCustomerSupportCaseDto } from './dto/create-customer-support-case.dto';
import { CreateSupportCaseMessageDto } from './dto/create-support-case-message.dto';
import { SupportCasesService } from './support-cases.service';

@ApiTags('customer-support-cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/customer')
export class CustomerSupportCasesController {
  constructor(private readonly supportCasesService: SupportCasesService) {}

  @Post('checkouts/:checkoutCode/support-cases')
  @ApiOperation({ summary: 'Create a support case for one checkout receipt.' })
  createCase(
    @Param('checkoutCode') checkoutCode: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerSupportCaseDto,
  ) {
    return this.supportCasesService.createCustomerCase(checkoutCode, user, dto);
  }

  @Get('support-cases')
  @ApiOperation({ summary: 'List support cases for the current customer.' })
  listCases(@CurrentUser() user: AuthenticatedUser) {
    return this.supportCasesService.listCustomerCases(user);
  }

  @Get('support-cases/:caseId')
  @ApiOperation({ summary: 'Get one support case for the current customer.' })
  getCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportCasesService.getCustomerCase(caseId, user);
  }

  @Post('support-cases/:caseId/messages')
  @ApiOperation({ summary: 'Add a customer reply to a support case.' })
  addMessage(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportCaseMessageDto,
  ) {
    return this.supportCasesService.addCustomerMessage(caseId, user, dto);
  }
}
