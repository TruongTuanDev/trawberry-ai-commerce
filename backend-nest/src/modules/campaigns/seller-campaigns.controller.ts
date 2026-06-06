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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { CampaignsService } from './campaigns.service';
import { CreateSponsoredCampaignDto } from './dto/create-sponsored-campaign.dto';
import { ListSponsoredCampaignsQueryDto } from './dto/list-sponsored-campaigns-query.dto';
import { SponsoredCampaignResponseDto } from './dto/sponsored-campaign-response.dto';
import { UpdateSponsoredCampaignDto } from './dto/update-sponsored-campaign.dto';
import { UpsertSponsoredCampaignTargetDto } from './dto/upsert-sponsored-campaign-target.dto';

@ApiTags('seller-campaigns')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/seller/shops/:shopId/campaigns')
export class SellerCampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List seller sponsored campaigns for a shop.' })
  @ApiOkResponse({ type: SponsoredCampaignResponseDto, isArray: true })
  list(
    @Param('shopId') shopId: string,
    @Query() query: ListSponsoredCampaignsQueryDto,
  ) {
    return this.campaignsService.listByShop(shopId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a seller sponsored campaign.' })
  @ApiCreatedResponse({ type: SponsoredCampaignResponseDto })
  create(
    @Param('shopId') shopId: string,
    @Body() dto: CreateSponsoredCampaignDto,
  ) {
    return this.campaignsService.create(shopId, dto);
  }

  @Get(':campaignId')
  @ApiOperation({ summary: 'Get a single seller sponsored campaign.' })
  @ApiOkResponse({ type: SponsoredCampaignResponseDto })
  findOne(
    @Param('shopId') shopId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.findOneByShop(shopId, campaignId);
  }

  @Patch(':campaignId')
  @ApiOperation({ summary: 'Update a seller sponsored campaign.' })
  @ApiOkResponse({ type: SponsoredCampaignResponseDto })
  update(
    @Param('shopId') shopId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateSponsoredCampaignDto,
  ) {
    return this.campaignsService.update(shopId, campaignId, dto);
  }

  @Post(':campaignId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a seller sponsored campaign.' })
  @ApiOkResponse({ type: SponsoredCampaignResponseDto })
  archive(
    @Param('shopId') shopId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.archive(shopId, campaignId);
  }

  @Delete(':campaignId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Soft delete a seller sponsored campaign by moving it to archived status.',
  })
  @ApiNoContentResponse()
  async remove(
    @Param('shopId') shopId: string,
    @Param('campaignId') campaignId: string,
  ) {
    await this.campaignsService.archive(shopId, campaignId);
  }

  @Post(':campaignId/targets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add or update a sponsored campaign target.' })
  @ApiOkResponse({ type: SponsoredCampaignResponseDto })
  upsertTarget(
    @Param('shopId') shopId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpsertSponsoredCampaignTargetDto,
  ) {
    return this.campaignsService.upsertTarget(shopId, campaignId, dto);
  }

  @Delete(':campaignId/targets/:targetId')
  @ApiOperation({ summary: 'Remove a sponsored campaign target.' })
  @ApiOkResponse({ type: SponsoredCampaignResponseDto })
  removeTarget(
    @Param('shopId') shopId: string,
    @Param('campaignId') campaignId: string,
    @Param('targetId') targetId: string,
  ) {
    return this.campaignsService.removeTarget(shopId, campaignId, targetId);
  }
}
