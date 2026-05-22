"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import {
  formatCustomerAddress,
  formatCustomerAddressComment,
  isCustomerAddressGeoReady,
} from "@/components/customer/account/customer-account-utils";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  geocodeCustomerAddress,
  getCustomerAddressSuggestions,
  getCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  type CustomerAddress,
  type CustomerAddressInput,
  type CustomerAddressSuggestion,
} from "@/lib/customer-api";
import { maybeNormalizePhone } from "@/lib/phone";

const emptyForm: CustomerAddressInput = {
  fullName: "",
  phone: "",
  country: "Russia",
  countryCode: "RU",
  city: "Moscow",
  region: "Moscow",
  federalSubject: "Moscow",
  district: "",
  street: "",
  building: "",
  entrance: "",
  intercom: "",
  floor: "",
  apartment: "",
  postalCode: "",
  comment: "",
  latitude: null,
  longitude: null,
  geoPrecision: "UNKNOWN",
  geoProvider: "MANUAL",
  geoProviderUri: "",
};

export function CustomerAccountAddressesPageClient() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerAddressInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CustomerAddressSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const loadAddresses = async () => {
    const response = await getCustomerAddresses();
    setAddresses(response.items);
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await getCustomerAddresses();
        if (!mounted) return;
        setAddresses(response.items);
        setError(null);
      } catch (issue) {
        if (mounted) {
          setError(issue instanceof Error ? issue.message : "Unable to load addresses.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const query = [form.street?.trim(), form.building?.trim()].filter(Boolean).join(" ");
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (query.length < 3) {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestionsLoading(false);
        }
        return;
      }

      setSuggestionsLoading(true);
      void (async () => {
        try {
          const response = await getCustomerAddressSuggestions(query, form.city || "Moscow");
          if (!cancelled) {
            setSuggestions(response.items);
          }
        } catch {
          if (!cancelled) {
            setSuggestions([]);
          }
        } finally {
          if (!cancelled) {
            setSuggestionsLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      setSuggestionsLoading(false);
    };
  }, [form.street, form.building, form.city]);

  const geoBadge = useMemo(() => {
    if (form.latitude && form.longitude && form.geoPrecision !== "UNKNOWN") {
      return {
        label: `Address verified (${form.geoPrecision})`,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }
    return {
      label: "Coordinates missing",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }, [form.geoPrecision, form.latitude, form.longitude]);

  const resetForm = () => {
    setEditingAddressId(null);
    setForm(emptyForm);
    setSuggestions([]);
  };

  const fillSuggestion = (suggestion: CustomerAddressSuggestion) => {
    setForm((current) => ({
      ...current,
      country: suggestion.country,
      countryCode: suggestion.countryCode,
      city: suggestion.city,
      region: suggestion.federalSubject || suggestion.city,
      federalSubject: suggestion.federalSubject || suggestion.city,
      district: suggestion.district || "",
      street: suggestion.street,
      building: suggestion.building,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      geoPrecision: suggestion.geoPrecision,
      geoProvider: suggestion.geoProvider,
      geoProviderUri: suggestion.geoProviderUri || "",
    }));
    setSuggestions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: CustomerAddressInput = {
        ...form,
        phone: maybeNormalizePhone(form.phone),
      };

      if (editingAddressId) {
        await updateCustomerAddress(editingAddressId, payload);
        setSuccess("Address updated.");
      } else {
        await createCustomerAddress(payload);
        setSuccess("Address created.");
      }

      await loadAddresses();
      resetForm();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (address: CustomerAddress) => {
    setEditingAddressId(address.id);
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      country: address.country,
      countryCode: address.countryCode,
      city: address.city,
      region: address.region,
      federalSubject: address.federalSubject || address.region,
      cityType: address.cityType || "",
      district: address.district || "",
      settlement: address.settlement || "",
      street: address.street,
      building: address.building,
      streetType: address.streetType || "",
      buildingBlock: address.buildingBlock || "",
      entrance: address.entrance || "",
      intercom: address.intercom || "",
      floor: address.floor || "",
      apartment: address.apartment || "",
      postalCode: address.postalCode || "",
      comment: address.comment || "",
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
      geoPrecision: address.geoPrecision,
      geoProvider: address.geoProvider,
      geoProviderUri: address.geoProviderUri || "",
    });
    setSuggestions([]);
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (addressId: string) => {
    setError(null);
    setSuccess(null);

    try {
      await deleteCustomerAddress(addressId);
      await loadAddresses();
      if (editingAddressId === addressId) {
        resetForm();
      }
      setSuccess("Address deleted.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to delete address.");
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setError(null);
    setSuccess(null);

    try {
      await setDefaultCustomerAddress(addressId);
      await loadAddresses();
      setSuccess("Default address updated.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to update default address.");
    }
  };

  const handleVerify = async () => {
    setError(null);
    setSuccess(null);
    setVerifying(true);
    try {
      if (editingAddressId) {
        const updated = await geocodeCustomerAddress(editingAddressId);
        handleEdit(updated);
      } else if (suggestions[0]) {
        fillSuggestion(suggestions[0]);
        setSuccess("Mock geocoder applied the top Moscow suggestion.");
      } else {
        setSuccess("Manual coordinates are kept. No mock suggestion matched this address.");
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to verify address.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <CustomerAccountShell
      title="Yandex-compatible addresses"
      description="Save structured delivery addresses with building-level details and coordinates for manual Yandex workbench."
    >
      {error ? (
        <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="card-panel rounded-[1.8rem] px-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Address book
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Saved addresses
            </h2>
          </div>

          <div className="mt-5 grid gap-4" data-testid="customer-address-list">
            {loading ? (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--muted)]">
                Loading addresses...
              </div>
            ) : addresses.length ? (
              addresses.map((address) => (
                <article
                  key={address.id}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-5 py-5"
                  data-testid="customer-address-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-[var(--foreground)]">
                          {address.fullName}
                        </p>
                        {address.isDefault ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                            Default
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${isCustomerAddressGeoReady(address) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {isCustomerAddressGeoReady(address) ? "Verified" : "Coords missing"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{address.phone}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                        {formatCustomerAddress(address)}
                      </p>
                      {formatCustomerAddressComment(address) ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {formatCustomerAddressComment(address)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Geo: {address.geoProvider} / {address.geoPrecision}
                      </p>
                      {address.latitude || address.longitude ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          GPS: {address.latitude ?? "?"}, {address.longitude ?? "?"}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!address.isDefault ? (
                        <button
                          type="button"
                          onClick={() => void handleSetDefault(address.id)}
                          className="public-button-secondary px-4 py-2 text-sm"
                          data-testid={`customer-address-default-${address.id}`}
                        >
                          Set default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleEdit(address)}
                        className="public-button-secondary px-4 py-2 text-sm"
                        data-testid={`customer-address-edit-${address.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(address.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                        data-testid={`customer-address-delete-${address.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-5 text-sm text-[var(--muted)]">
                No saved addresses yet.
              </div>
            )}
          </div>
        </section>

        <section className="card-panel rounded-[1.8rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {editingAddressId ? "Edit" : "Add"}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {editingAddressId ? "Update address" : "Add Yandex-compatible address"}
              </h2>
            </div>
            {editingAddressId ? (
              <button type="button" onClick={resetForm} className="public-button-secondary px-4 py-2 text-sm">
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5">
            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#fdfefe_0%,#f8fbff_100%)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">1. Region / city</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label="Country">
                  <input value={form.country || "Russia"} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className="public-input" />
                </AddressField>
                <AddressField label="Country code">
                  <input value={form.countryCode || "RU"} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value }))} className="public-input" />
                </AddressField>
                <AddressField label="City">
                  <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value, region: current.region || event.target.value, federalSubject: current.federalSubject || event.target.value }))} className="public-input" data-testid="customer-address-city" />
                </AddressField>
                <AddressField label="District / area">
                  <input value={form.district || ""} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} className="public-input" data-testid="customer-address-region" />
                </AddressField>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">2. Street / building</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
                <AddressField label="Street">
                  <input value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} className="public-input" data-testid="customer-address-street" />
                </AddressField>
                <AddressField label="Building">
                  <input value={form.building} onChange={(event) => setForm((current) => ({ ...current, building: event.target.value }))} className="public-input" data-testid="customer-address-building" />
                </AddressField>
              </div>
              {suggestionsLoading ? (
                <p className="mt-3 text-xs text-[var(--muted)]">Loading mock suggestions...</p>
              ) : suggestions.length ? (
                <div className="mt-3 grid gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.geoProviderUri ?? suggestion.title}
                      type="button"
                      onClick={() => fillSuggestion(suggestion)}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-left text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]"
                      data-testid="customer-address-suggestion"
                    >
                      <span className="block font-semibold">{suggestion.title}</span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">Mock geocoder suggestion</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">3. Delivery details</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label="Entrance">
                  <input value={form.entrance || ""} onChange={(event) => setForm((current) => ({ ...current, entrance: event.target.value }))} className="public-input" data-testid="customer-address-entrance" />
                </AddressField>
                <AddressField label="Intercom / door code">
                  <input value={form.intercom || ""} onChange={(event) => setForm((current) => ({ ...current, intercom: event.target.value }))} className="public-input" data-testid="customer-address-intercom" />
                </AddressField>
                <AddressField label="Floor">
                  <input value={form.floor || ""} onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value }))} className="public-input" />
                </AddressField>
                <AddressField label="Apartment">
                  <input value={form.apartment || ""} onChange={(event) => setForm((current) => ({ ...current, apartment: event.target.value }))} className="public-input" data-testid="customer-address-apartment" />
                </AddressField>
                <AddressField label="Postal code">
                  <input value={form.postalCode || ""} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className="public-input" data-testid="customer-address-postalCode" />
                </AddressField>
              </div>
              <AddressField label="Courier instructions">
                <textarea value={form.comment || ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} rows={3} className="public-input mt-4 min-h-24" data-testid="customer-address-comment" />
              </AddressField>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">4. Recipient</p>
              <div className="mt-4 grid gap-4">
                <AddressField label="Recipient name">
                  <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="public-input" data-testid="customer-address-fullName" />
                </AddressField>
                <AddressField label="Phone">
                  <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="public-input" placeholder="+7XXXXXXXXXX" data-testid="customer-address-phone" />
                </AddressField>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">5. Coordinates</p>
                  <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${geoBadge.tone}`}>
                    {geoBadge.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleVerify()}
                    disabled={verifying}
                    className="public-button-secondary px-4 py-2 text-sm"
                    data-testid="customer-address-verify"
                  >
                    {verifying ? "Verifying..." : editingAddressId ? "Verify address" : "Apply mock suggestion"}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label="Latitude">
                  <input value={form.latitude ?? ""} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value ? Number(event.target.value) : null, geoPrecision: event.target.value && current.longitude ? "MANUAL_PIN" : current.geoPrecision }))} className="public-input" data-testid="customer-address-latitude" />
                </AddressField>
                <AddressField label="Longitude">
                  <input value={form.longitude ?? ""} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value ? Number(event.target.value) : null, geoPrecision: event.target.value && current.latitude ? "MANUAL_PIN" : current.geoPrecision }))} className="public-input" data-testid="customer-address-longitude" />
                </AddressField>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Default tests use a mock/manual geocoder. No real Yandex API call is made in this phase.
              </p>
            </section>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="public-button-primary mt-6 px-5 py-3 text-sm disabled:opacity-60"
            data-testid="customer-address-save"
          >
            {saving ? "Saving..." : editingAddressId ? "Save changes" : "Add address"}
          </button>
        </section>
      </div>
    </CustomerAccountShell>
  );
}

function AddressField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
