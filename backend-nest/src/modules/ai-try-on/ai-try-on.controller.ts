import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AiTryOnService } from './ai-try-on.service';
import { AiTryOnTaskResponseDto } from './dto/ai-try-on-task-response.dto';
import {
  AiTryOnSettingsResponseDto,
  PublicAiTryOnConfigResponseDto,
  UpdateAiTryOnSettingsDto,
  UploadAiTryOnReferenceResponseDto,
} from './dto/ai-try-on-settings.dto';
import { CreateAiTryOnTaskDto } from './dto/create-ai-try-on-task.dto';

@ApiTags('admin-ai-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('api/admin/ai-settings')
export class AdminAiTryOnSettingsController {
  constructor(private readonly aiTryOnService: AiTryOnService) {}

  @Get()
  @ApiOkResponse({ type: AiTryOnSettingsResponseDto })
  @ApiOperation({ summary: 'Get marketplace AI try-on settings.' })
  getSettings() {
    return this.aiTryOnService.getAdminSettings();
  }

  @Patch()
  @ApiOkResponse({ type: AiTryOnSettingsResponseDto })
  @ApiOperation({ summary: 'Update marketplace AI try-on settings.' })
  updateSettings(@Body() dto: UpdateAiTryOnSettingsDto) {
    return this.aiTryOnService.updateAdminSettings(dto);
  }
}

@ApiTags('public-ai-try-on')
@Controller('api/public')
export class PublicAiTryOnController {
  constructor(private readonly aiTryOnService: AiTryOnService) {}

  @Get('ai-try-on/config')
  @ApiOkResponse({ type: PublicAiTryOnConfigResponseDto })
  @ApiOperation({ summary: 'Get public AI try-on runtime config.' })
  getConfig() {
    return this.aiTryOnService.getPublicConfig();
  }

  @Post('ai-try-on/uploads')
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: UploadAiTryOnReferenceResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a public AI try-on reference image.' })
  uploadReference(
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.aiTryOnService.uploadReferenceImage(file, request, user);
  }

  @Post('products/:productId/try-on/tasks')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiCreatedResponse({ type: AiTryOnTaskResponseDto })
  @ApiOperation({ summary: 'Create a public AI try-on task for one product.' })
  createTask(
    @Param('productId') productId: string,
    @Body() dto: CreateAiTryOnTaskDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.aiTryOnService.createTask(productId, dto, request, user);
  }

  @Get('ai-try-on/tasks/:taskId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: AiTryOnTaskResponseDto })
  @ApiOperation({ summary: 'Get one public AI try-on task.' })
  getTask(
    @Param('taskId') taskId: string,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.aiTryOnService.getTask(taskId, request, user);
  }
}
