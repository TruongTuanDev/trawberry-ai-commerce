import type { CustomerAddress } from "@/lib/customer-api";

export function formatCustomerAddress(address: CustomerAddress) {
  return [
    address.street,
    address.apartment || null,
    [address.city, address.region].filter(Boolean).join(", "),
    address.postalCode || null,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}
