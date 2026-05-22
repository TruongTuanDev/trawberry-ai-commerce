import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { CreateReturnRefundMessageDto } from './dto/create-return-refund-message.dto';
import { ListReturnRefundCasesQueryDto } from './dto/list-return-refund-cases-query.dto';
import { SellerRefundSentDto } from './dto/seller-refund-sent.dto';
import { SellerRespondReturnRefundDto } from './dto/seller-respond-return-refund.dto';
import { ReturnRefundsService } from './return-refunds.service';

@ApiTags('seller-returns')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/returns')
export class SellerReturnRefundsController {
  constructor(private readonly returnRefundsService: ReturnRefundsService) {}

  @Get()
  list(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReturnRefundCasesQueryDto,
  ) {
    return this.returnRefundsService.listShopCases(shopId, user, query);
  }

  @Get(':caseId')
  detail(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnRefundsService.getShopCase(shopId, caseId, user);
  }

  @Post(':caseId/respond')
  respond(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SellerRespondReturnRefundDto,
  ) {
    return this.returnRefundsService.sellerRespond(shopId, caseId, user, dto);
  }

  @Post(':caseId/mark-return-received')
  @HttpCode(200)
  markReturnReceived(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnRefundsService.markReturnReceived(shopId, caseId, user);
  }

  @Post(':caseId/refund-sent')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        method: { type: 'string' },
        bankReference: { type: 'string' },
        note: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['amount', 'method'],
    },
  })
  markRefundSent(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SellerRefundSentDto,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: false }))
    file?: ProductImageUploadFile,
  ) {
    return this.returnRefundsService.markRefundSent(
      shopId,
      caseId,
      user,
      dto,
      file,
    );
  }

  @Post(':caseId/messages')
  addMessage(
    @Param('shopId') shopId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnRefundMessageDto,
  ) {
    return this.returnRefundsService.addSellerMessage(
      shopId,
      caseId,
      user,
      dto,
    );
  }
}
