import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('jwt-admin') {}

@Injectable()
export class SellerJwtAuthGuard extends AuthGuard('jwt-seller') {}

@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('jwt-customer') {}
