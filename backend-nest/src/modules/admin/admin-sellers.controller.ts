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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminSellersService } from './admin-sellers.service';
import { AdminSellerResponseDto } from './dto/admin-seller-response.dto';
import { ListAdminSellersQueryDto } from './dto/list-admin-sellers-query.dto';
import { RejectSellerDto } from './dto/reject-seller.dto';

@ApiTags('admin sellers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/sellers')
export class AdminSellersController {
  constructor(private readonly adminSellersService: AdminSellersService) {}

  @Get()
  @ApiOperation({ summary: 'List seller accounts for admin review.' })
  @ApiOkResponse({ type: AdminSellerResponseDto, isArray: true })
  listSellers(@Query() query: ListAdminSellersQueryDto) {
    return this.adminSellersService.listSellers(query.status);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get one seller review record.' })
  @ApiOkResponse({ type: AdminSellerResponseDto })
  getSeller(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.adminSellersService.getSeller(userId);
  }

  @Post(':userId/approve')
  @ApiOperation({ summary: 'Approve a seller account.' })
  @ApiOkResponse({ type: AdminSellerResponseDto })
  approveSeller(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSellersService.approveSeller(userId, admin.userId);
  }

  @Post(':userId/reject')
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
}
