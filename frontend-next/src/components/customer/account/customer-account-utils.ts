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

export function formatCustomerAddressComment(address: Pick<CustomerAddress, "entrance" | "noEntrance" | "intercom" | "floor" | "noFloor" | "apartment" | "noApartment" | "comment">) {
  return [
    address.entrance ? `Entrance ${address.entrance}` : address.noEntrance ? "No private entrance" : null,
    address.intercom ? `Intercom ${address.intercom}` : null,
    address.floor ? `Floor ${address.floor}` : address.noFloor ? "Floor unknown" : null,
    address.apartment ? `Apartment ${address.apartment}` : address.noApartment ? "No apartment" : null,
    address.comment || null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function isCustomerAddressGeoReady(address: Pick<CustomerAddress, "latitude" | "longitude" | "geoPrecision">) {
  return Boolean(address.latitude && address.longitude && address.geoPrecision !== "UNKNOWN");
}

export function getCustomerAddressReadinessBadge(address: Pick<CustomerAddress, "geoPrecision" | "yandexApiReady" | "yandexManualReady" | "geoReadiness">) {
  if (address.yandexApiReady) {
    return {
      label: "Yandex-ready",
      tone: "bg-emerald-100 text-emerald-700",
    };
  }

  if (address.yandexManualReady) {
    return {
      label: "Manual-ready",
      tone: "bg-sky-100 text-sky-700",
    };
  }

  if (address.geoPrecision === "MANUAL_PIN") {
    return {
      label: "Manual pin",
      tone: "bg-sky-100 text-sky-700",
    };
  }

  if (address.geoReadiness?.hasCoordinates) {
    return {
      label: "Verified",
      tone: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Missing coordinates",
    tone: "bg-amber-100 text-amber-700",
  };
}
