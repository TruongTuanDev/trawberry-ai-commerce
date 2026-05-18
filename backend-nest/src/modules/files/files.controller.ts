import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard)
@Controller('api/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Create a placeholder S3/MinIO upload descriptor.' })
  createUploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.filesService.createUploadDescriptor(dto);
  }
}
