"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import {
  formatCustomerAddress,
  formatCustomerAddressComment,
  getCustomerAddressReadinessBadge,
} from "@/components/customer/account/customer-account-utils";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
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
  noEntrance: false,
  intercom: "",
  floor: "",
  noFloor: false,
  apartment: "",
  noApartment: false,
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
  const { run, isRunning } = useActionFeedback();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CustomerAddressSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const { t } = useI18n("customer");

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
          setError(issue instanceof Error ? issue.message : t("customer.addresses.loadFailed"));
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
  }, [t]);

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
    if (form.latitude && form.longitude && form.geoPrecision === "MANUAL_PIN") {
      return {
        label: t("customer.addresses.manualPin"),
        tone: "border-sky-200 bg-sky-50 text-sky-700",
      };
    }
    if (form.latitude && form.longitude && form.geoPrecision !== "UNKNOWN") {
      return {
        label: t("customer.addresses.verifiedPrecision", { precision: form.geoPrecision ?? "UNKNOWN" }),
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }
    return {
      label: t("customer.addresses.missingCoordinates"),
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }, [form.geoPrecision, form.latitude, form.longitude, t]);

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
    setError(null);
    setSuccess(null);

    await run({
      action: async () => {
        const payload: CustomerAddressInput = {
          ...form,
          phone: maybeNormalizePhone(form.phone),
        };

        if (editingAddressId) {
          return updateCustomerAddress(editingAddressId, payload);
        }

        return createCustomerAddress(payload);
      },
      successMessage: editingAddressId ? t("customer.addresses.updateSuccess") : t("customer.addresses.createSuccess"),
      onSuccess: async () => {
        setSuccess(editingAddressId ? t("customer.addresses.updateSuccess") : t("customer.addresses.createSuccess"));
        await loadAddresses();
        resetForm();
      },
      errorMessage: t("customer.addresses.saveFailed"),
    }).catch((issue) => {
      setError(issue instanceof Error ? issue.message : t("customer.addresses.saveFailed"));
    });
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
      noEntrance: address.noEntrance,
      intercom: address.intercom || "",
      floor: address.floor || "",
      noFloor: address.noFloor,
      apartment: address.apartment || "",
      noApartment: address.noApartment,
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
    if (!window.confirm(t("customer.addresses.deleteConfirm"))) return;
    setError(null);
    setSuccess(null);
    setDeletingId(addressId);

    await run({
      action: async () => deleteCustomerAddress(addressId),
      successMessage: t("customer.addresses.deleteSuccess"),
      onSuccess: async () => {
        setSuccess(t("customer.addresses.deleteSuccess"));
        await loadAddresses();
        if (editingAddressId === addressId) {
          resetForm();
        }
      },
      errorMessage: t("customer.addresses.deleteFailed"),
      onFinally: () => {
        setDeletingId(null);
      },
    }).catch((issue) => {
      setError(issue instanceof Error ? issue.message : t("customer.addresses.deleteFailed"));
    });
  };

  const handleSetDefault = async (addressId: string) => {
    setError(null);
    setSuccess(null);
    setSettingDefaultId(addressId);

    await run({
      action: async () => setDefaultCustomerAddress(addressId),
      successMessage: t("customer.addresses.defaultSuccess"),
      onSuccess: async () => {
        setSuccess(t("customer.addresses.defaultSuccess"));
        await loadAddresses();
      },
      errorMessage: t("customer.addresses.defaultFailed"),
      onFinally: () => {
        setSettingDefaultId(null);
      },
    }).catch((issue) => {
      setError(issue instanceof Error ? issue.message : t("customer.addresses.defaultFailed"));
    });
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
        setSuccess(t("customer.addresses.mockSuggestionApplied"));
      } else {
        setSuccess(t("customer.addresses.manualCoordinatesKept"));
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t("customer.addresses.verifyFailed"));
    } finally {
      setVerifying(false);
    }
  };

  const commentLabels = {
    entrance: t("customer.addresses.entrance"),
    noEntrance: t("customer.addresses.noEntrance"),
    intercom: t("customer.addresses.intercom"),
    floor: t("customer.addresses.floor"),
    floorUnknown: t("customer.addresses.noFloor"),
    apartment: t("customer.addresses.apartment"),
    noApartment: t("customer.addresses.noApartment"),
  };

  const readinessLabels = {
    yandexReady: t("customer.addresses.yandexReady"),
    manualReady: t("customer.addresses.manualDeliveryAllowed"),
    manualPin: t("customer.addresses.manualPin"),
    verified: t("customer.addresses.verified"),
    missingCoordinates: t("customer.addresses.missingCoordinates"),
  };

  return (
    <CustomerAccountShell
      title={t("customer.addresses.title")}
      description={t("customer.addresses.description")}
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
              {t("customer.addresses.addressBook")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              {t("customer.addresses.savedAddresses")}
            </h2>
          </div>

          <div className="mt-5 grid gap-4" data-testid="customer-address-list">
            {loading ? (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--muted)]">
                {t("customer.addresses.loading")}
              </div>
            ) : addresses.length ? (
              addresses.map((address) => {
                const badge = getCustomerAddressReadinessBadge(address, readinessLabels);
                const isDeleting = isRunning && deletingId === address.id;
                const isSettingDefault = isRunning && settingDefaultId === address.id;
                return (
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
                            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]" data-testid="customer-address-default-badge">
                              {t("customer.addresses.default")}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">{address.phone}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                          {formatCustomerAddress(address)}
                        </p>
                        {formatCustomerAddressComment(address, commentLabels) ? (
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            {formatCustomerAddressComment(address, commentLabels)}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {t("customer.addresses.geoMeta", { provider: address.geoProvider, precision: address.geoPrecision })}
                        </p>
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {t("customer.addresses.readinessMeta", {
                            manual: address.yandexManualReady ? t("common.yes") : t("common.no"),
                            api: address.yandexApiReady ? t("common.yes") : t("common.no"),
                          })}
                        </p>
                        {address.missingYandexFields.length ? (
                          <p className="mt-2 text-xs text-amber-700">
                            {t("customer.addresses.missingFields", { fields: address.missingYandexFields.join(", ") })}
                          </p>
                        ) : null}
                        {address.latitude || address.longitude ? (
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {t("customer.addresses.gpsMeta", { latitude: address.latitude ?? "?", longitude: address.longitude ?? "?" })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!address.isDefault ? (
                          <button
                            type="button"
                            onClick={() => void handleSetDefault(address.id)}
                            disabled={isRunning}
                            className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50"
                            data-testid={`customer-address-default-${address.id}`}
                          >
                            {isSettingDefault ? t("customer.addresses.saving") : t("customer.addresses.setDefault")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleEdit(address)}
                          disabled={isRunning}
                          className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50"
                          data-testid={`customer-address-edit-${address.id}`}
                        >
                          {t("common.actions.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(address.id)}
                          disabled={isRunning}
                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                          data-testid={`customer-address-delete-${address.id}`}
                        >
                          {isDeleting ? t("customer.addresses.deleting") : t("common.actions.delete")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-5 text-sm text-[var(--muted)]">
                {t("customer.addresses.empty")}
              </div>
            )}
          </div>
        </section>

        <section className="card-panel rounded-[1.8rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {editingAddressId ? t("common.actions.edit") : t("customer.addresses.add")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {editingAddressId ? t("customer.addresses.updateAddress") : t("customer.addresses.addAddress")}
              </h2>
            </div>
            {editingAddressId ? (
              <button type="button" onClick={resetForm} disabled={isRunning} className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50">
                {t("common.actions.cancel")}
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5">
            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#fdfefe_0%,#f8fbff_100%)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("customer.addresses.sectionRegionCity")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label={t("customer.addresses.country")}><input value={form.country || "Russia"} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className="public-input" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.countryCode")}><input value={form.countryCode || "RU"} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value }))} className="public-input" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.city")}><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value, region: current.region || event.target.value, federalSubject: current.federalSubject || event.target.value }))} className="public-input" data-testid="customer-address-city" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.district")}><input value={form.district || ""} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} className="public-input" data-testid="customer-address-region" disabled={isRunning} /></AddressField>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("customer.addresses.sectionStreetBuilding")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
                <AddressField label={t("customer.addresses.street")}><input value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} className="public-input" data-testid="customer-address-street" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.building")}><input value={form.building} onChange={(event) => setForm((current) => ({ ...current, building: event.target.value }))} className="public-input" data-testid="customer-address-building" disabled={isRunning} /></AddressField>
              </div>
              {suggestionsLoading ? (
                <p className="mt-3 text-xs text-[var(--muted)]">{t("customer.addresses.loadingSuggestions")}</p>
              ) : suggestions.length ? (
                <div className="mt-3 grid gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.geoProviderUri ?? suggestion.title}
                      type="button"
                      onClick={() => fillSuggestion(suggestion)}
                      disabled={isRunning}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-left text-sm text-[var(--foreground)] transition hover:border-[var(--accent)] disabled:opacity-50"
                      data-testid="customer-address-suggestion"
                    >
                      <span className="block font-semibold">{suggestion.title}</span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">{t("customer.addresses.mockSuggestion")}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("customer.addresses.sectionDeliveryDetails")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label={t("customer.addresses.entrance")}><input value={form.entrance || ""} onChange={(event) => setForm((current) => ({ ...current, entrance: event.target.value, noEntrance: event.target.value ? false : current.noEntrance }))} disabled={Boolean(form.noEntrance) || isRunning} className="public-input disabled:opacity-60" data-testid="customer-address-entrance" /></AddressField>
                <BooleanField label={t("customer.addresses.noEntrance")} checked={Boolean(form.noEntrance)} onChange={(checked) => setForm((current) => ({ ...current, noEntrance: checked, entrance: checked ? "" : current.entrance }))} testId="customer-address-no-entrance" disabled={isRunning} />
                <AddressField label={t("customer.addresses.intercom")}><input value={form.intercom || ""} onChange={(event) => setForm((current) => ({ ...current, intercom: event.target.value }))} className="public-input" data-testid="customer-address-intercom" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.floor")}><input value={form.floor || ""} onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value, noFloor: event.target.value ? false : current.noFloor }))} disabled={Boolean(form.noFloor) || isRunning} className="public-input disabled:opacity-60" data-testid="customer-address-floor" /></AddressField>
                <BooleanField label={t("customer.addresses.noFloor")} checked={Boolean(form.noFloor)} onChange={(checked) => setForm((current) => ({ ...current, noFloor: checked, floor: checked ? "" : current.floor }))} testId="customer-address-no-floor" disabled={isRunning} />
                <AddressField label={t("customer.addresses.apartment")}><input value={form.apartment || ""} onChange={(event) => setForm((current) => ({ ...current, apartment: event.target.value, noApartment: event.target.value ? false : current.noApartment }))} disabled={Boolean(form.noApartment) || isRunning} className="public-input disabled:opacity-60" data-testid="customer-address-apartment" /></AddressField>
                <BooleanField label={t("customer.addresses.noApartment")} checked={Boolean(form.noApartment)} onChange={(checked) => setForm((current) => ({ ...current, noApartment: checked, apartment: checked ? "" : current.apartment }))} testId="customer-address-no-apartment" disabled={isRunning} />
                <AddressField label={t("customer.addresses.postalCode")}><input value={form.postalCode || ""} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className="public-input" data-testid="customer-address-postalCode" disabled={isRunning} /></AddressField>
              </div>
              <AddressField label={t("customer.addresses.courierInstructions")}><textarea value={form.comment || ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} rows={3} className="public-input mt-4 min-h-24" data-testid="customer-address-comment" disabled={isRunning} /></AddressField>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("customer.addresses.sectionRecipient")}</p>
              <div className="mt-4 grid gap-4">
                <AddressField label={t("customer.addresses.fullName")}><input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="public-input" data-testid="customer-address-fullName" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.recipientPhone")}><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="public-input" placeholder="+7XXXXXXXXXX" data-testid="customer-address-phone" disabled={isRunning} /></AddressField>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("customer.addresses.sectionCoordinates")}</p>
                  <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${geoBadge.tone}`}>
                    {geoBadge.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm((current) => ({ ...current, geoProvider: "MANUAL", geoPrecision: current.latitude !== null && current.longitude !== null ? "MANUAL_PIN" : current.geoPrecision, }))} disabled={isRunning} className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50">{t("customer.addresses.useManualCoordinates")}</button>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, geoPrecision: current.latitude !== null && current.longitude !== null ? "MANUAL_PIN" : "UNKNOWN", geoProvider: "MANUAL", }))} disabled={isRunning} className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50">{t("customer.addresses.markManualPin")}</button>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, latitude: null, longitude: null, geoPrecision: "UNKNOWN", geoProvider: "MANUAL", }))} disabled={isRunning} className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50">{t("customer.addresses.clearCoordinates")}</button>
                  <button type="button" onClick={() => void handleVerify()} disabled={verifying || isRunning} className="public-button-secondary px-4 py-2 text-sm disabled:opacity-50" data-testid="customer-address-verify">{verifying ? t("customer.addresses.verifying") : editingAddressId ? t("customer.addresses.verifyAddress") : t("customer.addresses.applyMockSuggestion")}</button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label={t("customer.addresses.latitude")}><input value={form.latitude ?? ""} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value ? Number(event.target.value) : null, geoPrecision: event.target.value && current.longitude ? "MANUAL_PIN" : current.geoPrecision }))} className="public-input" data-testid="customer-address-latitude" disabled={isRunning} /></AddressField>
                <AddressField label={t("customer.addresses.longitude")}><input value={form.longitude ?? ""} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value ? Number(event.target.value) : null, geoPrecision: event.target.value && current.latitude ? "MANUAL_PIN" : current.geoPrecision }))} className="public-input" data-testid="customer-address-longitude" disabled={isRunning} /></AddressField>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">{t("customer.addresses.mockGeocoderHint")}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">{t("customer.addresses.manualReadyHint")}</p>
            </section>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isRunning}
            className="public-button-primary mt-6 px-5 py-3 text-sm disabled:opacity-60"
            data-testid="customer-address-save"
          >
            {isRunning ? t("customer.addresses.saving") : editingAddressId ? t("customer.addresses.saveChanges") : t("customer.addresses.addAddress")}
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

function BooleanField({
  label,
  checked,
  onChange,
  testId,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
