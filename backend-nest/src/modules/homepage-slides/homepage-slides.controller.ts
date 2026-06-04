import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { HomepageSlidesService } from './homepage-slides.service';
import { CreateHomepageSlideDto } from './dto/create-homepage-slide.dto';
import { UpdateHomepageSlideDto } from './dto/update-homepage-slide.dto';
import { ReorderHomepageSlidesDto } from './dto/reorder-homepage-slides.dto';
import { FilesService } from '../files/files.service';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { randomUUID } from 'crypto';

@ApiTags('homepage-slides')
@Controller()
export class HomepageSlidesController {
  constructor(
    private readonly slidesService: HomepageSlidesService,
    private readonly filesService: FilesService,
  ) {}

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================
  @Get('api/public/homepage-slides')
  @ApiOperation({ summary: 'Get active slides for public homepage' })
  findAllPublic() {
    return this.slidesService.findAllPublic();
  }

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Get('api/admin/homepage-slides')
  @ApiOperation({ summary: 'List all slides (Admin only)' })
  findAllAdmin() {
    return this.slidesService.findAllAdmin();
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Post('api/admin/homepage-slides')
  @ApiOperation({ summary: 'Create a homepage slide (Admin only)' })
  create(@Body() dto: CreateHomepageSlideDto) {
    return this.slidesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Get('api/admin/homepage-slides/:id')
  @ApiOperation({ summary: 'Get one homepage slide details (Admin only)' })
  findOne(@Param('id') id: string) {
    return this.slidesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Patch('api/admin/homepage-slides/:id')
  @ApiOperation({ summary: 'Update a homepage slide (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateHomepageSlideDto) {
    return this.slidesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Delete('api/admin/homepage-slides/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a homepage slide (Admin only)' })
  remove(@Param('id') id: string) {
    return this.slidesService.delete(id);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Post('api/admin/homepage-slides/:id/toggle')
  @ApiOperation({ summary: 'Toggle active status of a slide (Admin only)' })
  toggleActive(@Param('id') id: string) {
    return this.slidesService.toggleActive(id);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Post('api/admin/homepage-slides/reorder')
  @ApiOperation({ summary: 'Reorder slides display orders (Admin only)' })
  reorder(@Body() dto: ReorderHomepageSlidesDto) {
    return this.slidesService.reorder(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Post('api/admin/homepage-slides/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload slide image banner (Admin only)' })
  async upload(@UploadedFile() file: ProductImageUploadFile) {
    if (!file) {
      throw new BadRequestException('HOMEPAGE_SLIDE_IMAGE_REQUIRED');
    }

    // Validate MIME type
    if (
      !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException(
        'Invalid file type. Only JPG, PNG, and WEBP are allowed.',
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File is too large. Max size is 5MB.');
    }

    const slideId = randomUUID();
    const result = await this.filesService.storeHomepageSlideImage(file, {
      slideId,
    });

    return {
      url: result.publicUrl,
      storageKey: result.storageKey,
      mimeType: result.mimeType,
      sizeBytes: result.size,
    };
  }
}
