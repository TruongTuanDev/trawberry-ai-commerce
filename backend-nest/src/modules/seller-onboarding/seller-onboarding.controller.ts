import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { UpdateSellerOnboardingProfileDto } from './dto/update-seller-onboarding-profile.dto';
import { UploadSellerDocumentDto } from './dto/upload-seller-document.dto';
import { SellerOnboardingService } from './seller-onboarding.service';

@ApiTags('seller-onboarding')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard)
@Controller('api/seller/onboarding')
export class SellerOnboardingController {
  constructor(
    private readonly sellerOnboardingService: SellerOnboardingService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current seller legal onboarding profile.' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.sellerOnboardingService.getProfile(user);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Create or update current seller legal profile.' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSellerOnboardingProfileDto,
  ) {
    return this.sellerOnboardingService.updateProfile(user, dto);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List current seller KYC documents.' })
  listDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.sellerOnboardingService.listDocuments(user);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['documentType', 'file'],
    },
  })
  @ApiOperation({ summary: 'Upload one seller KYC document.' })
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadSellerDocumentDto,
    @UploadedFile(
      new ParseFilePipeBuilder().build({
        fileIsRequired: true,
      }),
    )
    file: ProductImageUploadFile,
  ) {
    return this.sellerOnboardingService.uploadDocument(user, dto, file);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one unreviewed seller KYC document.' })
  async deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    await this.sellerOnboardingService.deleteDocument(user, documentId);
  }
}
