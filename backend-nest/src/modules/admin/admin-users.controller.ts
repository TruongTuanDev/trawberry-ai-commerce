import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdminUsersService } from './admin-users.service';
import {
  CreateAdminUserDto,
  ListAdminUsersQueryDto,
  UpdateAdminUserDto,
} from './dto/admin-users.dto';

@ApiTags('admin users')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all users in the system with pagination and filters.',
  })
  listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific user.' })
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminUsersService.getUser(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user.' })
  createUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.createUser(dto, admin.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update an existing user's information." })
  updateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateUser(id, dto, admin.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user if they have no dependencies.' })
  deleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.deleteUser(id, admin.userId);
  }
}
