export type CustomerAddressSnapshot = {
  country: string;
  city: string;
  region: string;
  street: string;
  apartment?: string | null;
  postalCode?: string | null;
};

export function formatCustomerAddressSnapshot(
  address: CustomerAddressSnapshot,
) {
  return [
    address.street.trim(),
    address.apartment?.trim(),
    [address.city.trim(), address.region.trim()].filter(Boolean).join(', '),
    address.postalCode?.trim(),
    address.country.trim(),
  ]
    .filter((part) => !!part)
    .join(', ');
}
