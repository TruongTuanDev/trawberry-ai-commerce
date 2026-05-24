import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AdminJwtAuthGuard,
  CustomerJwtAuthGuard,
  JwtAuthGuard,
  SellerJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthCookieService } from './auth-cookie.service';
import { AuthRateLimit } from './auth-rate-limit.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ROLE_REFRESH_COOKIE_NAMES } from './auth-session.constants';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  private getRefreshCookie(req: Request, role: keyof typeof USER_ROLES) {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[ROLE_REFRESH_COOKIE_NAMES[USER_ROLES[role]]];
  }

  @Post('register')
  @AuthRateLimit({
    keyPrefix: 'auth-register-legacy',
    limit: 3,
    windowMs: 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Register a new customer or seller account.' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('customer/register')
  @AuthRateLimit({
    keyPrefix: 'auth-register-customer',
    limit: 3,
    windowMs: 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Register a new customer account.' })
  @ApiOkResponse({ type: AuthResponseDto })
  registerCustomer(@Body() dto: RegisterDto) {
    return this.authService.registerCustomer(dto);
  }

  @Post('seller/register')
  @AuthRateLimit({
    keyPrefix: 'auth-register-seller',
    limit: 3,
    windowMs: 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Register a new seller account.' })
  @ApiOkResponse({ type: AuthResponseDto })
  registerSeller(@Body() dto: RegisterDto) {
    return this.authService.registerSeller(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit({
    keyPrefix: 'auth-login-legacy',
    limit: 5,
    windowMs: 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Log in with email and password.' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.login(dto);
    res.cookie(
      this.configService.get<string>('AUTH_COOKIE_NAME', 'access_token'),
      response.accessToken,
      this.authCookieService.getAuthCookieOptions(),
    );
    this.authCookieService.setAccessTokenCookie(
      res,
      response.role as (typeof USER_ROLES)[keyof typeof USER_ROLES],
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      response.role as (typeof USER_ROLES)[keyof typeof USER_ROLES],
      response.refreshToken,
    );
    return response;
  }

  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit({
    keyPrefix: 'auth-login-customer',
    limit: 5,
    windowMs: 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Log in to a customer account.' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginCustomer(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.loginCustomer(dto);
    this.authCookieService.setAccessTokenCookie(
      res,
      USER_ROLES.CUSTOMER,
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      USER_ROLES.CUSTOMER,
      response.refreshToken,
    );
    return response;
  }

  @Post('seller/login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit({
    keyPrefix: 'auth-login-seller',
    limit: 5,
    windowMs: 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Log in to a seller account.' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginSeller(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.loginSeller(dto);
    this.authCookieService.setAccessTokenCookie(
      res,
      USER_ROLES.SELLER,
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      USER_ROLES.SELLER,
      response.refreshToken,
    );
    return response;
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit({
    keyPrefix: 'auth-login-admin',
    limit: 5,
    windowMs: 5 * 60_000,
    includeIdentifier: true,
  })
  @ApiOperation({ summary: 'Log in to an admin account.' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginAdmin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.loginAdmin(dto);
    this.authCookieService.setAccessTokenCookie(
      res,
      USER_ROLES.ADMIN,
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      USER_ROLES.ADMIN,
      response.refreshToken,
    );
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a fresh access token.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.refresh(dto);
    res.cookie(
      this.configService.get<string>('AUTH_COOKIE_NAME', 'access_token'),
      response.accessToken,
      this.authCookieService.getAuthCookieOptions(),
    );
    this.authCookieService.setAccessTokenCookie(
      res,
      response.role as (typeof USER_ROLES)[keyof typeof USER_ROLES],
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      response.role as (typeof USER_ROLES)[keyof typeof USER_ROLES],
      response.refreshToken,
    );
    return response;
  }

  @Post('customer/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh a customer session using the customer refresh cookie.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  async refreshCustomer(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.refreshCustomer(
      this.getRefreshCookie(req, 'CUSTOMER'),
    );
    this.authCookieService.setAccessTokenCookie(
      res,
      USER_ROLES.CUSTOMER,
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      USER_ROLES.CUSTOMER,
      response.refreshToken,
    );
    return response;
  }

  @Post('seller/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh a seller session using the seller refresh cookie.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  async refreshSeller(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.refreshSeller(
      this.getRefreshCookie(req, 'SELLER'),
    );
    this.authCookieService.setAccessTokenCookie(
      res,
      USER_ROLES.SELLER,
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      USER_ROLES.SELLER,
      response.refreshToken,
    );
    return response;
  }

  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh an admin session using the admin refresh cookie.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  async refreshAdmin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.refreshAdmin(
      this.getRefreshCookie(req, 'ADMIN'),
    );
    this.authCookieService.setAccessTokenCookie(
      res,
      USER_ROLES.ADMIN,
      response.accessToken,
    );
    this.authCookieService.setRefreshTokenCookie(
      res,
      USER_ROLES.ADMIN,
      response.refreshToken,
    );
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear the auth cookie.' })
  logout(@Res({ passthrough: true }) res: Response) {
    this.authCookieService.clearLegacyCookie(res);
    return { success: true };
  }

  @Post('customer/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear the customer auth cookie.' })
  logoutCustomer(@Res({ passthrough: true }) res: Response) {
    this.authCookieService.clearRoleCookies(res, USER_ROLES.CUSTOMER);
    return { success: true };
  }

  @Post('seller/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear the seller auth cookie.' })
  logoutSeller(@Res({ passthrough: true }) res: Response) {
    this.authCookieService.clearRoleCookies(res, USER_ROLES.SELLER);
    return { success: true };
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear the admin auth cookie.' })
  logoutAdmin(@Res({ passthrough: true }) res: Response) {
    this.authCookieService.clearRoleCookies(res, USER_ROLES.ADMIN);
    return { success: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear all role auth cookies.' })
  logoutAll(@Res({ passthrough: true }) res: Response) {
    this.authCookieService.clearAllAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }

  @Get('customer/me')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated customer.' })
  customerMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUserForRole(
      user.userId,
      USER_ROLES.CUSTOMER,
    );
  }

  @Get('seller/me')
  @UseGuards(SellerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated seller.' })
  sellerMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUserForRole(
      user.userId,
      USER_ROLES.SELLER,
    );
  }

  @Get('admin/me')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated admin.' })
  adminMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUserForRole(
      user.userId,
      USER_ROLES.ADMIN,
    );
  }
}
