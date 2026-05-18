import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { CategoriesService } from './categories.service';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('api/categories')
  list() {
    return this.categoriesService.listActive();
  }

  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Post('api/admin/categories')
  createCategory(
    @Body() body: Parameters<CategoriesService['createCategory']>[0],
  ) {
    return this.categoriesService.createCategory(body);
  }

  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Patch('api/admin/categories/:categoryId')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: Parameters<CategoriesService['updateCategory']>[1],
  ) {
    return this.categoriesService.updateCategory(categoryId, body);
  }

  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Get('api/admin/category-mappings')
  listMappings() {
    return this.categoriesService.adminListMappings();
  }

  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Post('api/admin/category-mappings')
  createMapping(
    @Body() body: Parameters<CategoriesService['createMapping']>[0],
  ) {
    return this.categoriesService.createMapping(body);
  }

  @UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
  @Patch('api/admin/category-mappings/:mappingId')
  updateMapping(
    @Param('mappingId') mappingId: string,
    @Body() body: Parameters<CategoriesService['updateMapping']>[1],
  ) {
    return this.categoriesService.updateMapping(mappingId, body);
  }
}
