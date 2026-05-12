import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { USER_ROLES } from '../../common/constants/roles.constant';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    const role = this.normalizeRequestedRole(dto.role);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
          role,
          status: 'ACTIVE',
        },
      });

      if (role === USER_ROLES.SELLER) {
        await tx.sellerProfile.create({
          data: {
            userId: createdUser.id,
            approvalStatus: 'PENDING',
          },
        });
      }

      return createdUser;
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        sellerProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active.');
    }

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        userId: string;
        email: string;
      }>(dto.refreshToken, {
        secret: this.getJwtSecret(
          this.configService.get<string>('JWT_SECRET') ||
            this.configService.get<string>(
              'JWT_REFRESH_SECRET',
              'dev-refresh-secret',
            ),
        ),
      });

      const user = await this.prisma.user.findUnique({
        where: { email: payload.email.toLowerCase() },
        include: {
          sellerProfile: {
            select: {
              approvalStatus: true,
            },
          },
        },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
  }

  async getCurrentUser(email: string) {
    return this.usersService.getCurrentUserProfileByEmail(email);
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    status: string;
    sellerProfile?: {
      approvalStatus: string;
    } | null;
  }) {
    const payload = {
      sub: user.email,
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getJwtSecret(
          this.configService.get<string>('JWT_SECRET') ||
            this.configService.get<string>(
              'JWT_ACCESS_SECRET',
              'dev-access-secret',
            ),
        ),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ||
          this.configService.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          )) as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getJwtSecret(
          this.configService.get<string>('JWT_SECRET') ||
            this.configService.get<string>(
              'JWT_REFRESH_SECRET',
              'dev-refresh-secret',
            ),
        ),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ||
          this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '7d',
          )) as never,
      }),
    ]);

    return {
      userId: user.id,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      approvalStatus: user.sellerProfile?.approvalStatus ?? null,
    };
  }

  private normalizeRequestedRole(role?: string): string {
    if (!role || role === 'CUSTOMER' || role === 'USER') {
      return USER_ROLES.CUSTOMER;
    }

    if (role === USER_ROLES.SELLER) {
      return USER_ROLES.SELLER;
    }

    throw new BadRequestException('Unsupported registration role.');
  }

  private getJwtSecret(rawSecret: string): string | Buffer {
    try {
      const decoded = Buffer.from(rawSecret, 'base64');
      if (
        decoded.length > 0 &&
        decoded.toString('base64') === rawSecret.replace(/\s+/g, '')
      ) {
        return decoded;
      }
    } catch {
      return rawSecret;
    }

    return rawSecret;
  }
}
