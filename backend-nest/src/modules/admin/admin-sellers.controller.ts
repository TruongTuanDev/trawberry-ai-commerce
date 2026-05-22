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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminSellersService } from './admin-sellers.service';
import { AdminSellerResponseDto } from './dto/admin-seller-response.dto';
import { ListAdminSellersQueryDto } from './dto/list-admin-sellers-query.dto';
import { RejectSellerDto } from './dto/reject-seller.dto';

@ApiTags('admin sellers')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller()
export class AdminSellersController {
  constructor(private readonly adminSellersService: AdminSellersService) {}

  @Get('api/admin/sellers')
  @ApiOperation({ summary: 'List seller accounts for admin review.' })
  @ApiOkResponse({ type: AdminSellerResponseDto, isArray: true })
  listSellers(@Query() query: ListAdminSellersQueryDto) {
    return this.adminSellersService.listSellers(query);
  }

  @Get('api/admin/sellers/:userId')
  @ApiOperation({ summary: 'Get one seller review record.' })
  @ApiOkResponse({ type: AdminSellerResponseDto })
  getSeller(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.adminSellersService.getSeller(userId);
  }

  @Post('api/admin/sellers/:userId/approve')
  @ApiOperation({ summary: 'Approve a seller account.' })
  @ApiOkResponse({ type: AdminSellerResponseDto })
  approveSeller(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSellersService.approveSeller(userId, admin.userId);
  }

  @Post('api/admin/sellers/:userId/reject')
  @ApiOperation({ summary: 'Reject a seller account.' })
  @ApiOkResponse({ type: AdminSellerResponseDto })
  rejectSeller(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RejectSellerDto,
  ) {
    return this.adminSellersService.rejectSeller(
      userId,
      admin.userId,
      dto.reason,
    );
  }

  @Get('api/admin/sellers/:userId/onboarding')
  @ApiOperation({ summary: 'Get seller onboarding profile for admin review.' })
  getOnboarding(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.adminSellersService.getOnboarding(userId);
  }

  @Get('api/admin/sellers/:userId/documents')
  @ApiOperation({ summary: 'List seller KYC documents for admin review.' })
  listDocuments(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.adminSellersService.listDocuments(userId);
  }

  @Post('api/admin/sellers/:userId/documents/:documentId/approve')
  @ApiOperation({ summary: 'Approve one seller KYC document.' })
  approveDocument(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSellersService.approveDocument(
      userId,
      documentId,
      admin.userId,
    );
  }

  @Post('api/admin/sellers/:userId/documents/:documentId/reject')
  @ApiOperation({ summary: 'Reject one seller KYC document.' })
  rejectDocument(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RejectSellerDto,
  ) {
    return this.adminSellersService.rejectDocument(
      userId,
      documentId,
      admin.userId,
      dto.reason,
    );
  }

  @Get('api/admin/audit-logs')
  @ApiOperation({ summary: 'List admin audit logs.' })
  listAuditLogs(@Query('targetUserId') targetUserId?: string) {
    return this.adminSellersService.listAuditLogs(targetUserId);
  }
}
