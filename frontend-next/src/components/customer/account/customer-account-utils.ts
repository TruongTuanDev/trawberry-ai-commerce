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

export function formatCustomerAddressComment(address: Pick<CustomerAddress, "entrance" | "intercom" | "floor" | "apartment" | "comment">) {
  return [
    address.entrance ? `Entrance ${address.entrance}` : null,
    address.intercom ? `Intercom ${address.intercom}` : null,
    address.floor ? `Floor ${address.floor}` : null,
    address.apartment ? `Apartment ${address.apartment}` : null,
    address.comment || null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function isCustomerAddressGeoReady(address: Pick<CustomerAddress, "latitude" | "longitude" | "geoPrecision">) {
  return Boolean(address.latitude && address.longitude && address.geoPrecision !== "UNKNOWN");
}
