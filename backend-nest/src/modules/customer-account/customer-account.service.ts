import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  createSyntheticEmailFromPhone,
  isSyntheticEmail,
  normalizePhone,
} from '../../common/utils/phone.util';
import {
  buildYandexAddressFullname,
  computeAddressGeoReadiness,
  validateYandexManualAddress,
} from '../../common/utils/customer-address.util';
import { AddressGeocoderService } from './address-geocoder.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';

@Injectable()
export class CustomerAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addressGeocoderService: AddressGeocoderService,
  ) {}

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

  listAddressSuggestions(query: string, city?: string) {
    return {
      items: this.addressGeocoderService.suggest(query, city),
    };
  }

  async createAddress(userId: string, dto: CreateCustomerAddressDto) {
    const payload = this.normalizeAddressInput(dto);
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
    const payload = this.normalizeAddressInput(dto, true, existing);

    const updated = await this.prisma.customerAddress.update({
      where: { id: existing.id },
      data: payload,
    });

    return this.toAddressResponse(updated);
  }

  async geocodeAddress(userId: string, addressId: string) {
    const existing = await this.getOwnedAddressOrThrow(userId, addressId);
    const geocoded = this.addressGeocoderService.geocode(existing);

    if (!geocoded) {
      const unchanged = await this.prisma.customerAddress.update({
        where: { id: existing.id },
        data: {
          geoPrecision: 'UNKNOWN',
          geoProvider: 'MANUAL',
          geoProviderUri: null,
          geoRawPayload: Prisma.JsonNull,
          addressFullName: buildYandexAddressFullname(existing),
          addressShortName: this.buildShortAddress(existing),
        },
      });
      return this.toAddressResponse(unchanged);
    }

    const updated = await this.prisma.customerAddress.update({
      where: { id: existing.id },
      data: {
        city: geocoded.city,
        district: geocoded.district,
        street: geocoded.street,
        building: geocoded.building,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        geoPrecision: geocoded.geoPrecision,
        geoProvider: geocoded.geoProvider,
        geoProviderUri: geocoded.geoProviderUri,
        geoRawPayload: geocoded.geoRawPayload,
        addressFullName: geocoded.addressFullName,
        addressShortName: geocoded.addressShortName,
      },
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
    existing?: Record<string, unknown> | null,
  ) {
    const next = {
      fullName:
        dto.fullName !== undefined
          ? dto.fullName.trim()
          : this.readExistingString(existing, 'fullName'),
      phone:
        dto.phone !== undefined
          ? normalizePhone(dto.phone, 'Phone')
          : this.readExistingString(existing, 'phone'),
      country:
        dto.country !== undefined
          ? dto.country.trim() || 'Russia'
          : this.readExistingString(existing, 'country', 'Russia'),
      countryCode:
        dto.countryCode !== undefined
          ? dto.countryCode.trim().toUpperCase() || 'RU'
          : this.readExistingString(existing, 'countryCode', 'RU'),
      city:
        dto.city !== undefined
          ? dto.city.trim()
          : this.readExistingString(existing, 'city'),
      region:
        dto.region !== undefined
          ? dto.region.trim()
          : this.readExistingString(existing, 'region'),
      federalSubject:
        dto.federalSubject !== undefined
          ? dto.federalSubject.trim() || null
          : ((existing?.federalSubject as string | null | undefined) ?? null),
      cityType:
        dto.cityType !== undefined
          ? dto.cityType.trim() || null
          : ((existing?.cityType as string | null | undefined) ?? null),
      district:
        dto.district !== undefined
          ? dto.district.trim() || null
          : ((existing?.district as string | null | undefined) ?? null),
      settlement:
        dto.settlement !== undefined
          ? dto.settlement.trim() || null
          : ((existing?.settlement as string | null | undefined) ?? null),
      street:
        dto.street !== undefined
          ? dto.street.trim()
          : this.readExistingString(existing, 'street'),
      streetType:
        dto.streetType !== undefined
          ? dto.streetType.trim() || null
          : ((existing?.streetType as string | null | undefined) ?? null),
      building:
        dto.building !== undefined
          ? dto.building.trim()
          : this.readExistingString(existing, 'building'),
      buildingBlock:
        dto.buildingBlock !== undefined
          ? dto.buildingBlock.trim() || null
          : ((existing?.buildingBlock as string | null | undefined) ?? null),
      entrance:
        dto.entrance !== undefined
          ? dto.entrance.trim() || null
          : ((existing?.entrance as string | null | undefined) ?? null),
      noEntrance:
        dto.noEntrance !== undefined
          ? Boolean(dto.noEntrance)
          : ((existing?.noEntrance as boolean | null | undefined) ?? false),
      intercom:
        dto.intercom !== undefined
          ? dto.intercom.trim() || null
          : ((existing?.intercom as string | null | undefined) ?? null),
      floor:
        dto.floor !== undefined
          ? dto.floor.trim() || null
          : ((existing?.floor as string | null | undefined) ?? null),
      noFloor:
        dto.noFloor !== undefined
          ? Boolean(dto.noFloor)
          : ((existing?.noFloor as boolean | null | undefined) ?? false),
      apartment:
        dto.apartment !== undefined
          ? dto.apartment.trim() || null
          : ((existing?.apartment as string | null | undefined) ?? null),
      noApartment:
        dto.noApartment !== undefined
          ? Boolean(dto.noApartment)
          : ((existing?.noApartment as boolean | null | undefined) ?? false),
      postalCode:
        dto.postalCode !== undefined
          ? dto.postalCode.trim() || null
          : ((existing?.postalCode as string | null | undefined) ?? null),
      comment:
        dto.comment !== undefined
          ? dto.comment.trim() || null
          : ((existing?.comment as string | null | undefined) ?? null),
      latitude:
        dto.latitude !== undefined
          ? dto.latitude
          : ((existing?.latitude as number | null | undefined) ?? null),
      longitude:
        dto.longitude !== undefined
          ? dto.longitude
          : ((existing?.longitude as number | null | undefined) ?? null),
      geoPrecision:
        dto.geoPrecision !== undefined
          ? dto.geoPrecision.trim() || 'UNKNOWN'
          : this.readExistingString(existing, 'geoPrecision', 'UNKNOWN'),
      geoProvider:
        dto.geoProvider !== undefined
          ? dto.geoProvider.trim() || 'MANUAL'
          : this.readExistingString(existing, 'geoProvider', 'MANUAL'),
      geoProviderUri:
        dto.geoProviderUri !== undefined
          ? dto.geoProviderUri.trim() || null
          : ((existing?.geoProviderUri as string | null | undefined) ?? null),
    };

    if (!next.building) {
      const parsed = this.extractBuildingFromStreet(next.street);
      if (parsed) {
        next.street = parsed.street;
        next.building = parsed.building;
      }
    }

    if (next.entrance) {
      next.noEntrance = false;
    } else if (next.noEntrance) {
      next.entrance = null;
    }

    if (next.floor) {
      next.noFloor = false;
    } else if (next.noFloor) {
      next.floor = null;
    }

    if (next.apartment) {
      next.noApartment = false;
    } else if (next.noApartment) {
      next.apartment = null;
    }

    if (!partial) {
      if (!next.fullName) {
        throw new BadRequestException('fullName is required.');
      }
      if (!next.phone) {
        throw new BadRequestException('phone is required.');
      }
      if (!next.city) {
        throw new BadRequestException('city is required.');
      }
      if (!next.street) {
        throw new BadRequestException('street is required.');
      }
      if (!next.building) {
        throw new BadRequestException('building is required.');
      }
    }

    const geocoded =
      next.latitude === null || next.longitude === null
        ? this.addressGeocoderService.geocode(next)
        : null;

    const merged = {
      ...next,
      city: geocoded?.city ?? next.city,
      district: geocoded?.district ?? next.district,
      street: geocoded?.street ?? next.street,
      building: geocoded?.building ?? next.building,
      latitude: geocoded?.latitude ?? next.latitude,
      longitude: geocoded?.longitude ?? next.longitude,
      geoPrecision:
        geocoded?.geoPrecision ??
        (next.latitude !== null && next.longitude !== null
          ? next.geoPrecision || 'MANUAL_PIN'
          : 'UNKNOWN'),
      geoProvider:
        geocoded?.geoProvider ??
        (next.latitude !== null && next.longitude !== null
          ? next.geoProvider || 'MANUAL'
          : 'MANUAL'),
      geoProviderUri: geocoded?.geoProviderUri ?? next.geoProviderUri,
      geoRawPayload: geocoded?.geoRawPayload ?? Prisma.JsonNull,
    };

    const addressFullName = buildYandexAddressFullname(merged);
    const addressShortName = this.buildShortAddress(merged);

    if (partial) {
      return {
        ...merged,
        addressFullName,
        addressShortName,
      };
    }

    return {
      ...merged,
      country: merged.country || 'Russia',
      countryCode: merged.countryCode || 'RU',
      addressFullName,
      addressShortName,
    };
  }

  private toAddressResponse(address: {
    id: string;
    fullName: string;
    phone: string;
    country: string;
    countryCode: string;
    city: string;
    region: string;
    federalSubject: string | null;
    cityType: string | null;
    district: string | null;
    settlement: string | null;
    street: string;
    building: string;
    streetType: string | null;
    buildingBlock: string | null;
    entrance: string | null;
    noEntrance: boolean;
    intercom: string | null;
    floor: string | null;
    noFloor: boolean;
    apartment: string | null;
    noApartment: boolean;
    postalCode: string | null;
    comment: string | null;
    latitude: { toString(): string } | null;
    longitude: { toString(): string } | null;
    geoPrecision: string;
    geoProvider: string;
    geoProviderUri: string | null;
    addressFullName: string;
    addressShortName: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const geoReadiness = computeAddressGeoReadiness(address);
    const manualValidation = validateYandexManualAddress(address);

    return {
      id: address.id,
      fullName: address.fullName,
      phone: address.phone,
      country: address.country,
      countryCode: address.countryCode,
      city: address.city,
      region: address.region,
      federalSubject: address.federalSubject,
      cityType: address.cityType,
      district: address.district,
      settlement: address.settlement,
      street: address.street,
      building: address.building,
      streetType: address.streetType,
      buildingBlock: address.buildingBlock,
      entrance: address.entrance,
      noEntrance: address.noEntrance,
      intercom: address.intercom,
      floor: address.floor,
      noFloor: address.noFloor,
      apartment: address.apartment,
      noApartment: address.noApartment,
      postalCode: address.postalCode,
      comment: address.comment,
      latitude: address.latitude?.toString() ?? null,
      longitude: address.longitude?.toString() ?? null,
      geoPrecision: address.geoPrecision,
      geoProvider: address.geoProvider,
      geoProviderUri: address.geoProviderUri,
      addressFullName:
        address.addressFullName || buildYandexAddressFullname(address),
      addressShortName:
        address.addressShortName || this.buildShortAddress(address),
      geoReadiness,
      missingYandexFields: manualValidation.missingFields,
      yandexManualReady: manualValidation.yandexManualReady,
      yandexApiReady: manualValidation.yandexApiReady,
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    };
  }

  private buildShortAddress(address: {
    street: string;
    building: string;
    buildingBlock?: string | null;
  }) {
    return [
      address.street.trim(),
      address.building.trim(),
      address.buildingBlock?.trim() || null,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private readExistingString(
    existing: Record<string, unknown> | null | undefined,
    key: string,
    fallback = '',
  ) {
    const value = existing?.[key];
    return typeof value === 'string' ? value : fallback;
  }

  private extractBuildingFromStreet(street: string) {
    const match =
      street.trim().match(/^(.*?)(?:,\s*|\s+)(\d+[A-Za-zА-Яа-я0-9/\\-]*)$/u) ??
      null;
    if (!match) {
      return null;
    }

    const [, name, building] = match;
    if (!name?.trim() || !building?.trim()) {
      return null;
    }

    return {
      street: name.trim(),
      building: building.trim(),
    };
  }
}
