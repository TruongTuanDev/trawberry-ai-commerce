export type ShippingLabelParsedAccess = {
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  noApartment: boolean;
  noEntrance: boolean;
  noFloor: boolean;
  remainderNote: string | null;
  systemGenerated: boolean;
};

function trimOrNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeShippingLabelPickupAddress(
  value: string | null | undefined,
  localizedSellerManagedPickup: string,
) {
  const normalized = trimOrNull(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(
    /\bSeller-managed pickup\b/gi,
    localizedSellerManagedPickup,
  );
}

export function parseShippingLabelSystemNote(
  note: string | null | undefined,
): ShippingLabelParsedAccess {
  const normalized = trimOrNull(note);
  if (!normalized) {
    return {
      apartment: null,
      entrance: null,
      floor: null,
      intercom: null,
      noApartment: false,
      noEntrance: false,
      noFloor: false,
      remainderNote: null,
      systemGenerated: false,
    };
  }

  const parts = normalized
    .split(/\s*(?:,|\n|;)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  let entrance: string | null = null;
  let noEntrance = false;
  let intercom: string | null = null;
  let floor: string | null = null;
  let noFloor = false;
  let apartment: string | null = null;
  let noApartment = false;
  let systemGenerated = false;
  const remainder: string[] = [];

  for (const part of parts) {
    let match: RegExpMatchArray | null = null;

    if (/^No private entrance$/i.test(part)) {
      noEntrance = true;
      systemGenerated = true;
      continue;
    }

    if (/^Floor unknown$/i.test(part)) {
      noFloor = true;
      systemGenerated = true;
      continue;
    }

    if (/^No apartment$/i.test(part)) {
      noApartment = true;
      systemGenerated = true;
      continue;
    }

    match = part.match(/^Entrance:?\s+(.+)$/i);
    if (match) {
      entrance = trimOrNull(match[1]);
      systemGenerated = true;
      continue;
    }

    match = part.match(/^Intercom(?::|\s)+(.*)$/i);
    if (match) {
      intercom = trimOrNull(match[1]);
      systemGenerated = true;
      continue;
    }

    match = part.match(/^Floor:?\s+(.+)$/i);
    if (match) {
      floor = trimOrNull(match[1]);
      systemGenerated = true;
      continue;
    }

    match = part.match(/^Apartment:?\s+(.+)$/i);
    if (match) {
      apartment = trimOrNull(match[1]);
      systemGenerated = true;
      continue;
    }

    remainder.push(part);
  }

  return {
    apartment,
    entrance,
    floor,
    intercom,
    noApartment,
    noEntrance,
    noFloor,
    remainderNote: remainder.length > 0 ? remainder.join(", ") : null,
    systemGenerated,
  };
}
