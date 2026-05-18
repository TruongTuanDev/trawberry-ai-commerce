import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ConfirmWildberriesImportDto } from './dto/confirm-wildberries-import.dto';
import { WildberriesImportOptionsDto } from './dto/wildberries-import-options.dto';
import { WildberriesImportsService } from './wildberries-imports.service';

@ApiTags('wildberries imports')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/imports/wildberries')
export class WildberriesImportsController {
  constructor(private readonly importsService: WildberriesImportsService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview a Wildberries Excel product import.' })
  @ApiBody({ type: WildberriesImportOptionsDto })
  @ApiOkResponse()
  preview(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() options: WildberriesImportOptionsDto,
  ) {
    return this.importsService.preview(shopId, user, file, options);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm a previewed Wildberries Excel import.' })
  @ApiOkResponse()
  confirm(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmWildberriesImportDto,
  ) {
    return this.importsService.confirm(shopId, user, dto.importId);
  }

  @Get(':importId')
  @ApiOperation({ summary: 'Get Wildberries Excel import session status.' })
  @ApiOkResponse()
  getStatus(
    @Param('shopId') shopId: string,
    @Param('importId') importId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.getStatus(shopId, user, importId);
  }
}
