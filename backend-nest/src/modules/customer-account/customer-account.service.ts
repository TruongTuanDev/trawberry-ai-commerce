import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  createSyntheticEmailFromPhone,
  isSyntheticEmail,
  normalizePhone,
} from '../../common/utils/phone.util';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';

@Injectable()
export class CustomerAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer account was not found.');
    }

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
      },
    });

    if (!currentUser) {
      throw new NotFoundException('Customer account was not found.');
    }

    const nextPhone =
      dto.phone !== undefined ? normalizePhone(dto.phone, 'Phone') : undefined;
    const nextEmail =
      dto.email !== undefined
        ? this.normalizeOptionalEmail(dto.email)
        : undefined;
    const nextName = dto.name !== undefined ? dto.name.trim() : undefined;

    if (nextEmail) {
      const duplicateEmail = await this.prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      });
      if (duplicateEmail && duplicateEmail.id !== userId) {
        throw new ConflictException('Email is already registered.');
      }
    }

    if (nextPhone) {
      const duplicatePhone = await this.prisma.user.findUnique({
        where: { phone: nextPhone },
        select: { id: true },
      });
      if (duplicatePhone && duplicatePhone.id !== userId) {
        throw new ConflictException('Phone is already registered.');
      }
    }

    let syntheticEmailReplacement: string | undefined;
    if (
      nextPhone &&
      !nextEmail &&
      isSyntheticEmail(currentUser.email) &&
      currentUser.phone !== nextPhone
    ) {
      syntheticEmailReplacement = createSyntheticEmailFromPhone(nextPhone);
      const duplicateSyntheticEmail = await this.prisma.user.findUnique({
        where: { email: syntheticEmailReplacement },
        select: { id: true },
      });
      if (duplicateSyntheticEmail && duplicateSyntheticEmail.id !== userId) {
        throw new ConflictException('Phone is already registered.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(nextName !== undefined ? { fullName: nextName || null } : {}),
        ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
        ...(nextEmail !== undefined
          ? { email: nextEmail }
          : syntheticEmailReplacement
            ? { email: syntheticEmailReplacement }
            : {}),
      },
    });

    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangeCustomerPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer account was not found.');
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  }

  async listAddresses(userId: string) {
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId: userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      items: addresses.map((address) => this.toAddressResponse(address)),
    };
  }

  async createAddress(userId: string, dto: CreateCustomerAddressDto) {
    const payload = {
      fullName: dto.fullName.trim(),
      phone: normalizePhone(dto.phone, 'Phone'),
      country: dto.country?.trim() || 'RU',
      city: dto.city.trim(),
      region: dto.region.trim(),
      street: dto.street.trim(),
      apartment: dto.apartment?.trim() || null,
      postalCode: dto.postalCode?.trim() || null,
      comment: dto.comment?.trim() || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    };
    const existingCount = await this.prisma.customerAddress.count({
      where: { customerId: userId },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      if (existingCount === 0) {
        return tx.customerAddress.create({
          data: {
            customerId: userId,
            ...payload,
            isDefault: true,
          },
        });
      }

      return tx.customerAddress.create({
        data: {
          customerId: userId,
          ...payload,
          isDefault: false,
        },
      });
    });

    return this.toAddressResponse(created);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    const existing = await this.getOwnedAddressOrThrow(userId, addressId);
    const payload = this.normalizeAddressInput(dto, true);

    const updated = await this.prisma.customerAddress.update({
      where: { id: existing.id },
      data: payload,
    });

    return this.toAddressResponse(updated);
  }

  async deleteAddress(userId: string, addressId: string) {
    const existing = await this.getOwnedAddressOrThrow(userId, addressId);

    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({
        where: { id: existing.id },
      });

      if (!existing.isDefault) {
        return;
      }

      const nextAddress = await tx.customerAddress.findFirst({
        where: { customerId: userId },
        orderBy: { createdAt: 'asc' },
      });

      if (!nextAddress) {
        return;
      }

      await tx.customerAddress.update({
        where: { id: nextAddress.id },
        data: { isDefault: true },
      });
    });

    return { success: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const existing = await this.getOwnedAddressOrThrow(userId, addressId);

    if (existing.isDefault) {
      return this.toAddressResponse(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.customerAddress.update({
        where: { id: existing.id },
        data: { isDefault: true },
      });
    });

    return this.toAddressResponse(updated);
  }

  private async getOwnedAddressOrThrow(userId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Customer address was not found.');
    }

    if (address.customerId !== userId) {
      throw new ForbiddenException(
        'You cannot access another customer address.',
      );
    }

    return address;
  }

  private normalizeOptionalEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Email is required.');
    }
    return normalized;
  }

  private normalizeAddressInput(
    dto: Partial<CreateCustomerAddressDto>,
    partial = false,
  ) {
    const payload = {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.phone !== undefined
        ? { phone: normalizePhone(dto.phone, 'Phone') }
        : {}),
      ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...(dto.region !== undefined ? { region: dto.region.trim() } : {}),
      ...(dto.street !== undefined ? { street: dto.street.trim() } : {}),
      ...(dto.apartment !== undefined
        ? { apartment: dto.apartment.trim() || null }
        : {}),
      ...(dto.postalCode !== undefined
        ? { postalCode: dto.postalCode.trim() || null }
        : {}),
      ...(dto.comment !== undefined
        ? { comment: dto.comment.trim() || null }
        : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
    };

    if (partial) {
      return payload;
    }

    return {
      ...payload,
      country: payload.country || 'RU',
    };
  }

  private toAddressResponse(address: {
    id: string;
    fullName: string;
    phone: string;
    country: string;
    city: string;
    region: string;
    street: string;
    apartment: string | null;
    postalCode: string | null;
    comment: string | null;
    latitude: { toString(): string } | null;
    longitude: { toString(): string } | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: address.id,
      fullName: address.fullName,
      phone: address.phone,
      country: address.country,
      city: address.city,
      region: address.region,
      street: address.street,
      apartment: address.apartment,
      postalCode: address.postalCode,
      comment: address.comment,
      latitude: address.latitude?.toString() ?? null,
      longitude: address.longitude?.toString() ?? null,
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    };
  }
}
