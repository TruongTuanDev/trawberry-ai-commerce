import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { CustomerAddressResponseDto } from './dto/customer-address-response.dto';
import { CustomerProfileResponseDto } from './dto/customer-profile-response.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CustomerAccountService } from './customer-account.service';

@ApiTags('customer-account')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('api/customer')
export class CustomerAccountController {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the current customer profile.' })
  @ApiOkResponse({ type: CustomerProfileResponseDto })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    this.assertCustomer(user);
    return this.customerAccountService.getProfile(user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update the current customer profile.' })
  @ApiOkResponse({ type: CustomerProfileResponseDto })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.updateProfile(user.userId, dto);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change the current customer password.' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeCustomerPasswordDto,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.changePassword(user.userId, dto);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'List saved addresses for the current customer.' })
  listAddresses(@CurrentUser() user: AuthenticatedUser) {
    this.assertCustomer(user);
    return this.customerAccountService.listAddresses(user.userId);
  }

  @Get('address-suggestions')
  @ApiOperation({
    summary:
      'Return deterministic customer address suggestions for mock/manual geocoder mode.',
  })
  listAddressSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('query') query: string,
    @Query('city') city?: string,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.listAddressSuggestions(query, city);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Create a saved address for the current customer.' })
  @ApiOkResponse({ type: CustomerAddressResponseDto })
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.createAddress(user.userId, dto);
  }

  @Patch('addresses/:addressId')
  @ApiOperation({ summary: 'Update one saved customer address.' })
  @ApiOkResponse({ type: CustomerAddressResponseDto })
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.updateAddress(
      user.userId,
      addressId,
      dto,
    );
  }

  @Post('addresses/:addressId/geocode')
  @ApiOperation({
    summary: 'Apply the configured mock/manual geocoder to one address.',
  })
  geocodeAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.geocodeAddress(user.userId, addressId);
  }

  @Delete('addresses/:addressId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete one saved customer address.' })
  deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.deleteAddress(user.userId, addressId);
  }

  @Post('addresses/:addressId/default')
  @ApiOperation({ summary: 'Mark one customer address as the default.' })
  @ApiOkResponse({ type: CustomerAddressResponseDto })
  setDefaultAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId') addressId: string,
  ) {
    this.assertCustomer(user);
    return this.customerAccountService.setDefaultAddress(
      user.userId,
      addressId,
    );
  }

  private assertCustomer(user: AuthenticatedUser) {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('Customer account is required.');
    }
  }
}
