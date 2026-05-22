export type CustomerAddressSnapshot = {
  country: string;
  countryCode?: string | null;
  city: string;
  region?: string | null;
  federalSubject?: string | null;
  district?: string | null;
  street: string;
  building?: string | null;
  entrance?: string | null;
  intercom?: string | null;
  floor?: string | null;
  apartment?: string | null;
  postalCode?: string | null;
  comment?: string | null;
  latitude?: number | { toString(): string } | null;
  longitude?: number | { toString(): string } | null;
  geoPrecision?: string | null;
  addressFullName?: string | null;
  addressShortName?: string | null;
};

export function formatCustomerAddressSnapshot(
  address: CustomerAddressSnapshot,
) {
  const legacyStreet = [address.street.trim(), address.building?.trim() || null]
    .filter(Boolean)
    .join(' ');
  return [
    legacyStreet,
    address.apartment?.trim(),
    [
      address.city.trim(),
      address.region?.trim() || address.federalSubject?.trim() || '',
    ]
      .filter(Boolean)
      .join(', '),
    address.postalCode?.trim(),
    address.countryCode?.trim() || address.country.trim(),
  ]
    .filter((part) => !!part)
    .join(', ');
}

export function buildYandexAddressFullname(address: CustomerAddressSnapshot) {
  const city = address.city?.trim() || '';
  const street = address.street?.trim() || '';
  const building = address.building?.trim() || '';

  return [city, street, building].filter(Boolean).join(', ');
}

export function buildYandexAddressComment(address: CustomerAddressSnapshot) {
  return [
    address.entrance?.trim() ? `Entrance ${address.entrance.trim()}` : null,
    address.intercom?.trim() ? `Intercom ${address.intercom.trim()}` : null,
    address.floor?.trim() ? `Floor ${address.floor.trim()}` : null,
    address.apartment?.trim() ? `Apartment ${address.apartment.trim()}` : null,
    address.comment?.trim() || null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function buildYandexCoordinates(address: CustomerAddressSnapshot) {
  const latitude = toNumber(address.latitude);
  const longitude = toNumber(address.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  return [longitude, latitude] as const;
}

export function validateAddressForYandex(
  address: CustomerAddressSnapshot & {
    fullName?: string | null;
    phone?: string | null;
  },
) {
  const issues: string[] = [];

  if (!address.city?.trim()) {
    issues.push('city');
  }
  if (!address.street?.trim()) {
    issues.push('street');
  }
  if (!address.building?.trim()) {
    issues.push('building');
  }
  if (!address.phone?.trim()) {
    issues.push('recipient phone');
  }
  if (!buildYandexCoordinates(address)) {
    issues.push('coordinates');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function toNumber(value: number | { toString(): string } | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'number' ? value : Number(value.toString());
}
