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
  noEntrance?: boolean | null;
  intercom?: string | null;
  floor?: string | null;
  noFloor?: boolean | null;
  apartment?: string | null;
  noApartment?: boolean | null;
  postalCode?: string | null;
  comment?: string | null;
  latitude?: number | { toString(): string } | null;
  longitude?: number | { toString(): string } | null;
  geoPrecision?: string | null;
  addressFullName?: string | null;
  addressShortName?: string | null;
};

export type AddressGeoReadiness = {
  hasStructuredAddress: boolean;
  hasCoordinates: boolean;
  geoPrecision: string | null;
  isYandexManualReady: boolean;
  isYandexApiReady: boolean;
  missingFields: string[];
};

export type YandexManualAddressValidation = {
  valid: boolean;
  missingFields: string[];
  yandexManualReady: boolean;
  yandexApiReady: boolean;
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
    address.entrance?.trim()
      ? `Entrance ${address.entrance.trim()}`
      : address.noEntrance
        ? 'No private entrance'
        : null,
    address.intercom?.trim() ? `Intercom ${address.intercom.trim()}` : null,
    address.floor?.trim()
      ? `Floor ${address.floor.trim()}`
      : address.noFloor
        ? 'Floor unknown'
        : null,
    address.apartment?.trim()
      ? `Apartment ${address.apartment.trim()}`
      : address.noApartment
        ? 'No apartment'
        : null,
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
  const readiness = computeAddressGeoReadiness(address);

  return {
    valid: readiness.isYandexApiReady,
    issues: readiness.missingFields,
  };
}

export function validateYandexManualAddress(
  address: CustomerAddressSnapshot & {
    fullName?: string | null;
    phone?: string | null;
  },
): YandexManualAddressValidation {
  const missingFields: string[] = [];
  const hasCity = Boolean(address.city?.trim());
  const hasStreet = Boolean(address.street?.trim());
  const hasBuilding = Boolean(address.building?.trim());
  const hasFullName = Boolean(address.fullName?.trim());
  const hasPhone = Boolean(address.phone?.trim());
  const hasEntranceDecision = Boolean(
    address.entrance?.trim() || address.noEntrance,
  );
  const hasFloorDecision = Boolean(address.floor?.trim() || address.noFloor);
  const hasApartmentDecision = Boolean(
    address.apartment?.trim() || address.noApartment,
  );

  if (!hasCity) missingFields.push('city');
  if (!hasStreet) missingFields.push('street');
  if (!hasBuilding) missingFields.push('building');
  if (!hasFullName) missingFields.push('fullName');
  if (!hasPhone) missingFields.push('phone');
  if (!hasEntranceDecision) missingFields.push('entranceDecision');
  if (!hasFloorDecision) missingFields.push('floorDecision');
  if (!hasApartmentDecision) missingFields.push('apartmentDecision');

  const geoReadiness = computeAddressGeoReadiness(address);
  const yandexManualReady = missingFields.length === 0;
  const yandexApiReady =
    yandexManualReady &&
    geoReadiness.hasCoordinates &&
    (geoReadiness.geoPrecision === 'BUILDING' ||
      geoReadiness.geoPrecision === 'MANUAL_PIN');

  return {
    valid: yandexManualReady,
    missingFields,
    yandexManualReady,
    yandexApiReady,
  };
}

export function computeAddressGeoReadiness(
  address: CustomerAddressSnapshot & {
    fullName?: string | null;
    phone?: string | null;
  },
): AddressGeoReadiness {
  const missingFields: string[] = [];
  const hasCity = Boolean(address.city?.trim());
  const hasStreet = Boolean(address.street?.trim());
  const hasBuilding = Boolean(address.building?.trim());
  const hasPhone = Boolean(address.phone?.trim());
  const coordinates = buildYandexCoordinates(address);
  const hasCoordinates = Boolean(coordinates);
  const geoPrecision = address.geoPrecision?.trim() || null;
  const hasStructuredAddress = hasCity && hasStreet && hasBuilding;

  if (!hasCity) {
    missingFields.push('city');
  }
  if (!hasStreet) {
    missingFields.push('street');
  }
  if (!hasBuilding) {
    missingFields.push('building');
  }
  if (!hasPhone) {
    missingFields.push('recipient phone');
  }
  if (!hasCoordinates) {
    missingFields.push('coordinates');
  }

  const isYandexManualReady = hasStructuredAddress && hasPhone;
  const isYandexApiReady =
    isYandexManualReady &&
    hasCoordinates &&
    (geoPrecision === 'BUILDING' || geoPrecision === 'MANUAL_PIN');

  return {
    hasStructuredAddress,
    hasCoordinates,
    geoPrecision,
    isYandexManualReady,
    isYandexApiReady,
    missingFields,
  };
}

function toNumber(value: number | { toString(): string } | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'number' ? value : Number(value.toString());
}
