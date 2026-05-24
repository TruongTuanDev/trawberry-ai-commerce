import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isSyntheticEmail } from '../../common/utils/phone.util';
import {
  isSellerOnboardingComplete,
  resolveSellerNextStep,
} from '../../common/utils/seller-next-step.util';
import { UpdatePreferredLocaleDto } from './dto/update-preferred-locale.dto';

const ROLE_LOCALE_POLICY = {
  ADMIN: ['en'],
  SELLER: ['ru', 'en', 'vi'],
  CUSTOMER: ['ru', 'en'],
} as const;

type SupportedLocale = 'en' | 'ru' | 'vi';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException(`User ${email} was not found.`);
    }

    return user;
  }

  async getCurrentUserProfileById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: {
          select: {
            id: true,
            currentShopId: true,
            approvalStatus: true,
            rejectionReason: true,
            legalType: true,
            legalName: true,
            inn: true,
            legalAddress: true,
            contactName: true,
            contactPhone: true,
            contactEmail: true,
            bankName: true,
            bankAccount: true,
            bik: true,
            documents: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    const sellerOnboardingComplete =
      user.role === 'SELLER'
        ? isSellerOnboardingComplete({
            approvalStatus: user.sellerProfile?.approvalStatus ?? null,
            rejectionReason: user.sellerProfile?.rejectionReason ?? null,
            legalType: user.sellerProfile?.legalType ?? null,
            legalName: user.sellerProfile?.legalName ?? null,
            inn: user.sellerProfile?.inn ?? null,
            legalAddress: user.sellerProfile?.legalAddress ?? null,
            contactName: user.sellerProfile?.contactName ?? null,
            contactPhone: user.sellerProfile?.contactPhone ?? null,
            contactEmail: user.sellerProfile?.contactEmail ?? null,
            bankName: user.sellerProfile?.bankName ?? null,
            bankAccount: user.sellerProfile?.bankAccount ?? null,
            bik: user.sellerProfile?.bik ?? null,
            documentCount: user.sellerProfile?.documents?.length ?? 0,
          })
        : null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      preferredLocale: user.preferredLocale,
      role: user.role,
      status: user.status,
      sellerProfileId: user.sellerProfile?.id ?? null,
      currentShopId: user.sellerProfile?.currentShopId ?? null,
      sellerApprovalStatus: user.sellerProfile?.approvalStatus ?? null,
      sellerRejectionReason: user.sellerProfile?.rejectionReason ?? null,
      sellerNextStep:
        user.role === 'SELLER'
          ? resolveSellerNextStep({
              approvalStatus: user.sellerProfile?.approvalStatus ?? null,
              rejectionReason: user.sellerProfile?.rejectionReason ?? null,
              legalType: user.sellerProfile?.legalType ?? null,
              legalName: user.sellerProfile?.legalName ?? null,
              inn: user.sellerProfile?.inn ?? null,
              legalAddress: user.sellerProfile?.legalAddress ?? null,
              contactName: user.sellerProfile?.contactName ?? null,
              contactPhone: user.sellerProfile?.contactPhone ?? null,
              contactEmail: user.sellerProfile?.contactEmail ?? null,
              bankName: user.sellerProfile?.bankName ?? null,
              bankAccount: user.sellerProfile?.bankAccount ?? null,
              bik: user.sellerProfile?.bik ?? null,
              documentCount: user.sellerProfile?.documents?.length ?? 0,
            })
          : null,
      sellerOnboardingComplete,
      isSyntheticEmail: isSyntheticEmail(user.email),
    };
  }

  async getCurrentUserProfileByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        sellerProfile: {
          select: {
            id: true,
            currentShopId: true,
            approvalStatus: true,
            rejectionReason: true,
            legalType: true,
            legalName: true,
            inn: true,
            legalAddress: true,
            contactName: true,
            contactPhone: true,
            contactEmail: true,
            bankName: true,
            bankAccount: true,
            bik: true,
            documents: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${email} was not found.`);
    }

    const sellerOnboardingComplete =
      user.role === 'SELLER'
        ? isSellerOnboardingComplete({
            approvalStatus: user.sellerProfile?.approvalStatus ?? null,
            rejectionReason: user.sellerProfile?.rejectionReason ?? null,
            legalType: user.sellerProfile?.legalType ?? null,
            legalName: user.sellerProfile?.legalName ?? null,
            inn: user.sellerProfile?.inn ?? null,
            legalAddress: user.sellerProfile?.legalAddress ?? null,
            contactName: user.sellerProfile?.contactName ?? null,
            contactPhone: user.sellerProfile?.contactPhone ?? null,
            contactEmail: user.sellerProfile?.contactEmail ?? null,
            bankName: user.sellerProfile?.bankName ?? null,
            bankAccount: user.sellerProfile?.bankAccount ?? null,
            bik: user.sellerProfile?.bik ?? null,
            documentCount: user.sellerProfile?.documents?.length ?? 0,
          })
        : null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      preferredLocale: user.preferredLocale,
      role: user.role,
      status: user.status,
      sellerProfileId: user.sellerProfile?.id ?? null,
      currentShopId: user.sellerProfile?.currentShopId ?? null,
      sellerApprovalStatus: user.sellerProfile?.approvalStatus ?? null,
      sellerRejectionReason: user.sellerProfile?.rejectionReason ?? null,
      sellerNextStep:
        user.role === 'SELLER'
          ? resolveSellerNextStep({
              approvalStatus: user.sellerProfile?.approvalStatus ?? null,
              rejectionReason: user.sellerProfile?.rejectionReason ?? null,
              legalType: user.sellerProfile?.legalType ?? null,
              legalName: user.sellerProfile?.legalName ?? null,
              inn: user.sellerProfile?.inn ?? null,
              legalAddress: user.sellerProfile?.legalAddress ?? null,
              contactName: user.sellerProfile?.contactName ?? null,
              contactPhone: user.sellerProfile?.contactPhone ?? null,
              contactEmail: user.sellerProfile?.contactEmail ?? null,
              bankName: user.sellerProfile?.bankName ?? null,
              bankAccount: user.sellerProfile?.bankAccount ?? null,
              bik: user.sellerProfile?.bik ?? null,
              documentCount: user.sellerProfile?.documents?.length ?? 0,
            })
          : null,
      sellerOnboardingComplete,
      isSyntheticEmail: isSyntheticEmail(user.email),
    };
  }

  async updatePreferredLocale(
    userId: string,
    role: string,
    dto: UpdatePreferredLocaleDto,
  ) {
    const preferredLocale = (dto.preferredLocale?.trim() ??
      null) as SupportedLocale | null;
    const supported = (ROLE_LOCALE_POLICY[
      role as keyof typeof ROLE_LOCALE_POLICY
    ] ?? ['en']) as readonly SupportedLocale[];

    if (preferredLocale && !supported.includes(preferredLocale)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Locale ${preferredLocale} is not supported for ${role}.`,
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferredLocale,
      },
      select: {
        preferredLocale: true,
      },
    });

    return updated;
  }
}
