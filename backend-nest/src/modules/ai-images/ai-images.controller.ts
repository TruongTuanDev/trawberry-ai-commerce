import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ProductImageResponseDto } from '../product-images/dto/product-image-response.dto';
import { AiImagesService } from './ai-images.service';
import { AiCreditResponseDto } from './dto/ai-credit-response.dto';
import { AiImageTaskResponseDto } from './dto/ai-image-task-response.dto';
import { AiRuntimeStatusResponseDto } from './dto/ai-runtime-status-response.dto';
import { CreateAiImageTaskDto } from './dto/create-ai-image-task.dto';
import { ListAiImageTasksQueryDto } from './dto/list-ai-image-tasks-query.dto';

@ApiTags('ai-images')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId')
export class AiImagesController {
  constructor(private readonly aiImagesService: AiImagesService) {}

  @Post('products/:productId/ai-images/tasks')
  @ApiOperation({
    summary: 'Create a seller AI image generation task for one product.',
  })
  @ApiCreatedResponse({ type: AiImageTaskResponseDto })
  createTask(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateAiImageTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiImagesService.createTask(shopId, productId, dto, user.userId);
  }

  @Get('ai-images/tasks')
  @ApiOperation({ summary: 'List AI image generation tasks for a shop.' })
  @ApiOkResponse({ type: AiImageTaskResponseDto, isArray: true })
  listTasks(
    @Param('shopId') shopId: string,
    @Query() query: ListAiImageTasksQueryDto,
  ) {
    return this.aiImagesService.listTasks(shopId, query);
  }

  @Get('ai-images/tasks/:taskId')
  @ApiOperation({ summary: 'Get one AI image generation task by id.' })
  @ApiOkResponse({ type: AiImageTaskResponseDto })
  getTask(@Param('shopId') shopId: string, @Param('taskId') taskId: string) {
    return this.aiImagesService.getTask(shopId, taskId);
  }

  @Get('ai-credits')
  @ApiOperation({ summary: 'Get AI credits for one shop.' })
  @ApiOkResponse({ type: AiCreditResponseDto })
  getCredits(@Param('shopId') shopId: string) {
    return this.aiImagesService.getCredits(shopId);
  }

  @Get('ai-images/runtime')
  @ApiOperation({
    summary: 'Get seller-safe runtime status for AI image generation.',
  })
  @ApiOkResponse({ type: AiRuntimeStatusResponseDto })
  getRuntimeStatus(@Param('shopId') shopId: string) {
    return this.aiImagesService.getRuntimeStatus(shopId);
  }

  @Post('ai-images/tasks/:taskId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry one failed or pending AI image generation task.',
  })
  @ApiOkResponse({ type: AiImageTaskResponseDto })
  retryTask(@Param('shopId') shopId: string, @Param('taskId') taskId: string) {
    return this.aiImagesService.retryTask(shopId, taskId);
  }

  @Post('products/:productId/ai-images/:imageId/attach')
  @ApiOperation({
    summary: 'Attach one generated AI image back into the product gallery.',
  })
  @ApiCreatedResponse({ type: ProductImageResponseDto })
  attachGeneratedImage(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.aiImagesService.attachGeneratedImage(
      shopId,
      productId,
      imageId,
    );
  }

  @Post('products/:productId/images/:imageId/attach')
  @ApiOperation({
    summary:
      'Backward-compatible attach route for current frontend integration.',
  })
  @ApiCreatedResponse({ type: ProductImageResponseDto })
  attachGeneratedImageLegacy(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.aiImagesService.attachGeneratedImage(
      shopId,
      productId,
      imageId,
    );
  }
}
