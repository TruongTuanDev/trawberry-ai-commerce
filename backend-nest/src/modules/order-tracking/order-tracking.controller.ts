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
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { PublicOrderTrackingResponseDto } from './dto/public-order-tracking-response.dto';
import { TrackPublicOrderQueryDto } from './dto/track-public-order-query.dto';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { OrderTrackingService } from './order-tracking.service';

@ApiTags('public-orders')
@Controller('api/public/orders')
export class OrderTrackingController {
  constructor(private readonly orderTrackingService: OrderTrackingService) {}

  @Get('track')
  @ApiOperation({
    summary: 'Track a public customer order by order code and phone.',
  })
  @ApiQuery({ name: 'orderCode', required: true })
  @ApiQuery({ name: 'phone', required: true })
  @ApiOkResponse({ type: PublicOrderTrackingResponseDto })
  trackByCode(@Query() query: TrackPublicOrderQueryDto) {
    return this.orderTrackingService.trackByQuery(query);
  }

  @Get(':orderId/track')
  @ApiOperation({
    summary: 'Track a public customer order by order id and phone.',
  })
  @ApiQuery({ name: 'phone', required: true })
  @ApiOkResponse({ type: PublicOrderTrackingResponseDto })
  trackByOrderId(
    @Param('orderId') orderId: string,
    @Query('phone') phone: string,
  ) {
    return this.orderTrackingService.trackByOrderId(orderId, phone);
  }

  @Post(':orderId/payment-proof')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload customer payment proof for a manual transfer order.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
        },
        buyerNote: {
          type: 'string',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['phone', 'file'],
    },
  })
  @ApiOkResponse({ type: PublicOrderTrackingResponseDto })
  uploadPaymentProof(
    @Param('orderId') orderId: string,
    @Body() dto: UploadPaymentProofDto,
    @UploadedFile(
      new ParseFilePipeBuilder().build({
        fileIsRequired: true,
      }),
    )
    file: ProductImageUploadFile,
  ) {
    return this.orderTrackingService.uploadPaymentProof(
      orderId,
      dto.phone,
      dto.buyerNote,
      file,
    );
  }
}
