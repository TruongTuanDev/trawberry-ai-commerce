import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CustomerJwtAuthGuard,
  JwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CurrentUserResponseDto } from './dto/current-user-response.dto';
import { UpdatePreferredLocaleDto } from './dto/update-preferred-locale.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user profile.' })
  @ApiOkResponse({ type: CurrentUserResponseDto })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUserProfileById(user.userId);
  }

  @Patch('locale')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update the current authenticated user preferred locale.',
  })
  updatePreferredLocale(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferredLocaleDto,
  ) {
    return this.usersService.updatePreferredLocale(user.userId, user.role, dto);
  }
}
