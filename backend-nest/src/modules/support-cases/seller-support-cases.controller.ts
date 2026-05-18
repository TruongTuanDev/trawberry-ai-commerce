import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateSupportCaseMessageDto } from './dto/create-support-case-message.dto';
import { SupportCasesService } from './support-cases.service';

@ApiTags('seller-support-cases')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/support-cases')
export class SellerSupportCasesController {
  constructor(private readonly supportCasesService: SupportCasesService) {}

  @Get()
  @ApiOperation({ summary: 'List support cases for one seller shop.' })
  listCases(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportCasesService.listSellerCases(shopId, user);
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Get one support case for one seller shop.' })
  getCase(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportCasesService.getSellerCase(shopId, caseId, user);
  }

  @Post(':caseId/messages')
  @ApiOperation({ summary: 'Add a seller reply to a support case.' })
  addMessage(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportCaseMessageDto,
  ) {
    return this.supportCasesService.addSellerMessage(shopId, caseId, user, dto);
  }
}
