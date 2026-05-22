import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildYandexAddressFullname,
  type CustomerAddressSnapshot,
} from '../../common/utils/customer-address.util';

type AddressSuggestion = {
  title: string;
  city: string;
  district: string | null;
  street: string;
  building: string;
  latitude: number;
  longitude: number;
  geoPrecision: string;
  geoProvider: string;
  geoProviderUri: string | null;
};

const MOCK_MOSCOW_SUGGESTIONS: AddressSuggestion[] = [
  {
    title: 'Moscow, Tverskaya, 12',
    city: 'Moscow',
    district: 'Tverskoy District',
    street: 'Tverskaya',
    building: '12',
    latitude: 55.765369,
    longitude: 37.605192,
    geoPrecision: 'BUILDING',
    geoProvider: 'MOCK',
    geoProviderUri: 'mock://moscow/tverskaya-12',
  },
  {
    title: 'Moscow, Arbat, 21',
    city: 'Moscow',
    district: 'Arbat District',
    street: 'Arbat',
    building: '21',
    latitude: 55.749473,
    longitude: 37.592392,
    geoPrecision: 'BUILDING',
    geoProvider: 'MOCK',
    geoProviderUri: 'mock://moscow/arbat-21',
  },
  {
    title: 'Moscow, Lenina, 10',
    city: 'Moscow',
    district: 'Basmanny District',
    street: 'Lenina',
    building: '10',
    latitude: 55.751244,
    longitude: 37.618423,
    geoPrecision: 'BUILDING',
    geoProvider: 'MOCK',
    geoProviderUri: 'mock://moscow/lenina-10',
  },
];

@Injectable()
export class AddressGeocoderService {
  constructor(private readonly configService: ConfigService) {}

  suggest(query: string, city?: string | null) {
    const provider = this.resolveProvider();
    if (provider === 'YANDEX') {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const normalizedCity = (city?.trim() || 'Moscow').toLowerCase();

    return MOCK_MOSCOW_SUGGESTIONS.filter((entry) => {
      if (
        normalizedCity &&
        !entry.city.toLowerCase().includes(normalizedCity)
      ) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return entry.title.toLowerCase().includes(normalizedQuery);
    }).map((entry) => ({
      ...entry,
      country: 'Russia',
      countryCode: 'RU',
      federalSubject: entry.city,
      streetType: 'street',
      addressFullName: entry.title,
      addressShortName: `${entry.street}, ${entry.building}`,
    }));
  }

  geocode(address: CustomerAddressSnapshot) {
    const provider = this.resolveProvider();
    if (provider === 'YANDEX') {
      return null;
    }

    const fullName = buildYandexAddressFullname(address).toLowerCase();
    const matched =
      MOCK_MOSCOW_SUGGESTIONS.find(
        (entry) =>
          fullName.includes(entry.street.toLowerCase()) &&
          fullName.includes(entry.building.toLowerCase()),
      ) ?? null;

    if (!matched) {
      return null;
    }

    return {
      latitude: matched.latitude,
      longitude: matched.longitude,
      geoPrecision: matched.geoPrecision,
      geoProvider: matched.geoProvider,
      geoProviderUri: matched.geoProviderUri,
      geoRawPayload: {
        mock: true,
        title: matched.title,
      },
      addressFullName: matched.title,
      addressShortName: `${matched.street}, ${matched.building}`,
      city: matched.city,
      district: matched.district,
      street: matched.street,
      building: matched.building,
    };
  }

  private resolveProvider() {
    return this.configService
      .get<string>('ADDRESS_GEOCODER_PROVIDER', 'mock')
      .trim()
      .toUpperCase();
  }
}
