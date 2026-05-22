import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { CreateReturnRefundCaseDto } from './dto/create-return-refund-case.dto';
import { CreateReturnRefundMessageDto } from './dto/create-return-refund-message.dto';
import { UploadReturnRefundEvidenceDto } from './dto/upload-return-refund-evidence.dto';
import { ReturnRefundsService } from './return-refunds.service';

@ApiTags('customer-returns')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('api/customer')
export class CustomerReturnRefundsController {
  constructor(private readonly returnRefundsService: ReturnRefundsService) {}

  @Get('returns')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.returnRefundsService.listCustomerCases(user);
  }

  @Get('returns/:caseId')
  detail(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnRefundsService.getCustomerCase(caseId, user);
  }

  @Post('orders/:orderId/returns')
  create(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnRefundCaseDto,
  ) {
    return this.returnRefundsService.createCustomerCase(orderId, user, dto);
  }

  @Post('returns/:caseId/messages')
  addMessage(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnRefundMessageDto,
  ) {
    return this.returnRefundsService.addCustomerMessage(caseId, user, dto);
  }

  @Post('returns/:caseId/evidence')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadEvidence(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadReturnRefundEvidenceDto,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: ProductImageUploadFile,
  ) {
    return this.returnRefundsService.uploadCustomerEvidence(
      caseId,
      user,
      file,
      dto.label,
    );
  }

  @Post('returns/:caseId/confirm-refund-received')
  @HttpCode(200)
  confirmRefundReceived(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnRefundsService.confirmRefundReceived(caseId, user);
  }

  @Post('returns/:caseId/cancel')
  @HttpCode(200)
  cancel(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnRefundsService.cancelCustomerCase(caseId, user);
  }
}
