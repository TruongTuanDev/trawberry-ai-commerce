import type { CustomerAddress } from "@/lib/customer-api";

export function formatCustomerAddress(address: CustomerAddress) {
  return [
    address.addressFullName || [address.city, address.street, address.building].filter(Boolean).join(", "),
    formatCustomerAddressComment(address),
    [address.district, address.region].filter(Boolean).join(", "),
    address.postalCode || null,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatCustomerAddressComment(
  address: Pick<CustomerAddress, "entrance" | "noEntrance" | "intercom" | "floor" | "noFloor" | "apartment" | "noApartment" | "comment">,
  labels?: {
    entrance: string;
    noEntrance: string;
    intercom: string;
    floor: string;
    floorUnknown: string;
    apartment: string;
    noApartment: string;
  },
) {
  return [
    address.entrance ? `${labels?.entrance ?? "Entrance"} ${address.entrance}` : address.noEntrance ? (labels?.noEntrance ?? "No private entrance") : null,
    address.intercom ? `${labels?.intercom ?? "Intercom"} ${address.intercom}` : null,
    address.floor ? `${labels?.floor ?? "Floor"} ${address.floor}` : address.noFloor ? (labels?.floorUnknown ?? "Floor unknown") : null,
    address.apartment ? `${labels?.apartment ?? "Apartment"} ${address.apartment}` : address.noApartment ? (labels?.noApartment ?? "No apartment") : null,
    address.comment || null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function isCustomerAddressGeoReady(address: Pick<CustomerAddress, "latitude" | "longitude" | "geoPrecision">) {
  return Boolean(address.latitude && address.longitude && address.geoPrecision !== "UNKNOWN");
}

export function getCustomerAddressReadinessBadge(
  address: Pick<CustomerAddress, "geoPrecision" | "yandexApiReady" | "yandexManualReady" | "geoReadiness">,
  labels?: {
    yandexReady: string;
    manualReady: string;
    manualPin: string;
    verified: string;
    missingCoordinates: string;
  },
) {
  if (address.yandexApiReady) {
    return {
      label: labels?.yandexReady ?? "Yandex-ready",
      tone: "bg-emerald-100 text-emerald-700",
    };
  }

  if (address.yandexManualReady) {
    return {
      label: labels?.manualReady ?? "Manual-ready",
      tone: "bg-sky-100 text-sky-700",
    };
  }

  if (address.geoPrecision === "MANUAL_PIN") {
    return {
      label: labels?.manualPin ?? "Manual pin",
      tone: "bg-sky-100 text-sky-700",
    };
  }

  if (address.geoReadiness?.hasCoordinates) {
    return {
      label: labels?.verified ?? "Verified",
      tone: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: labels?.missingCoordinates ?? "Missing coordinates",
    tone: "bg-amber-100 text-amber-700",
  };
}
