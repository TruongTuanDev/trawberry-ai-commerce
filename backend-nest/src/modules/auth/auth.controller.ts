import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuthRateLimit } from './auth-rate-limit.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookie(res: Response, token: string) {
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'access_token',
    );
    const isSecure =
      this.configService.get<string>('AUTH_COOKIE_SECURE', 'false') === 'true';
    const sameSiteConfig = this.configService.get<string>(
      'AUTH_COOKIE_SAME_SITE',
      'lax',
    );
    const sameSite = (
      ['lax', 'strict', 'none'].includes(sameSiteConfig) &&
      !(sameSiteConfig === 'none' && !isSecure)
        ? sameSiteConfig
        : 'lax'
    ) as boolean | 'lax' | 'strict' | 'none';
    const maxAge = this.configService.get<number>(
      'AUTH_COOKIE_MAX_AGE_SECONDS',
      15 * 60,
    );

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: maxAge * 1000,
      path: '/',
    });
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
    this.setAuthCookie(res, response.accessToken);
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
    this.setAuthCookie(res, response.accessToken);
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
    this.setAuthCookie(res, response.accessToken);
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
    this.setAuthCookie(res, response.accessToken);
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
    this.setAuthCookie(res, response.accessToken);
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear the auth cookie.' })
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'access_token',
    );
    const isSecure =
      this.configService.get<string>('AUTH_COOKIE_SECURE', 'false') === 'true';
    const sameSiteConfig = this.configService.get<string>(
      'AUTH_COOKIE_SAME_SITE',
      'lax',
    );
    const sameSite = (
      ['lax', 'strict', 'none'].includes(sameSiteConfig) &&
      !(sameSiteConfig === 'none' && !isSecure)
        ? sameSiteConfig
        : 'lax'
    ) as boolean | 'lax' | 'strict' | 'none';

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: '/',
    });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}
