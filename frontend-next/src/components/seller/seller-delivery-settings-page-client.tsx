"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { getDeliverySettings, updateDeliverySettings } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerDeliverySettingsPageClient() {
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    pickupAddress: "",
    pickupCity: "",
    pickupPostalCode: "",
    pickupContactPhone: "",
    pickupContactName: "",
    pickupLatitude: "",
    pickupLongitude: "",
    enabledCdek: true,
    enabledYandex: true,
    defaultCarrier: "YANDEX" as "CDEK" | "YANDEX",
    sameCityPreferredCarrier: "YANDEX" as "CDEK" | "YANDEX",
    interCityPreferredCarrier: "CDEK" as "CDEK" | "YANDEX",
    fallbackCarrier: "CDEK" as "CDEK" | "YANDEX",
    defaultWeightGram: "1000",
    defaultLengthCm: "30",
    defaultWidthCm: "20",
    defaultHeightCm: "10",
  });

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const settings = await getDeliverySettings(currentShopId, "");
        if (!mounted) return;
        setForm({
          pickupAddress: settings.pickupAddress,
          pickupCity: settings.pickupCity,
          pickupPostalCode: settings.pickupPostalCode ?? "",
          pickupContactPhone: settings.pickupContactPhone,
          pickupContactName: settings.pickupContactName,
          pickupLatitude: settings.pickupLatitude ?? "",
          pickupLongitude: settings.pickupLongitude ?? "",
          enabledCdek: settings.enabledCarriers.includes("CDEK"),
          enabledYandex: settings.enabledCarriers.includes("YANDEX"),
          defaultCarrier: settings.defaultCarrier as "CDEK" | "YANDEX",
          sameCityPreferredCarrier: settings.sameCityPreferredCarrier as "CDEK" | "YANDEX",
          interCityPreferredCarrier: settings.interCityPreferredCarrier as "CDEK" | "YANDEX",
          fallbackCarrier: settings.fallbackCarrier as "CDEK" | "YANDEX",
          defaultWeightGram: String(settings.defaultWeightGram),
          defaultLengthCm: String(settings.defaultLengthCm),
          defaultWidthCm: String(settings.defaultWidthCm),
          defaultHeightCm: String(settings.defaultHeightCm),
        });
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [currentShopId, user]);

  const handleSave = async () => {
    if (!currentShopId) return;

    const enabledCarriers = [
      ...(form.enabledCdek ? (["CDEK"] as const) : []),
      ...(form.enabledYandex ? (["YANDEX"] as const) : []),
    ];

    if (!enabledCarriers.length) {
      setError("Enable at least one carrier.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const saved = await updateDeliverySettings(
        currentShopId,
        {
          pickupAddress: form.pickupAddress,
          pickupCity: form.pickupCity,
          pickupPostalCode: form.pickupPostalCode || undefined,
          pickupContactPhone: form.pickupContactPhone,
          pickupLatitude: form.pickupLatitude ? Number(form.pickupLatitude) : undefined,
          pickupLongitude: form.pickupLongitude ? Number(form.pickupLongitude) : undefined,
          pickupContactName: form.pickupContactName,
          enabledCarriers,
          defaultCarrier: form.defaultCarrier,
          sameCityPreferredCarrier: form.sameCityPreferredCarrier,
          interCityPreferredCarrier: form.interCityPreferredCarrier,
          fallbackCarrier: form.fallbackCarrier,
          defaultWeightGram: Number(form.defaultWeightGram || "0"),
          defaultLengthCm: Number(form.defaultLengthCm || "0"),
          defaultWidthCm: Number(form.defaultWidthCm || "0"),
          defaultHeightCm: Number(form.defaultHeightCm || "0"),
        },
        "",
      );

      setForm((current) => ({
        ...current,
        defaultCarrier: saved.defaultCarrier as "CDEK" | "YANDEX",
        sameCityPreferredCarrier: saved.sameCityPreferredCarrier as "CDEK" | "YANDEX",
        interCityPreferredCarrier: saved.interCityPreferredCarrier as "CDEK" | "YANDEX",
        fallbackCarrier: saved.fallbackCarrier as "CDEK" | "YANDEX",
      }));
      setSuccessMessage("Delivery settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save delivery settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      eyebrow="Delivery foundation"
      title="Seller delivery settings"
      description="Configure pickup data, default package dimensions, and which carriers appear in mock-mode offer calculation."
    >
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : (
        <div className="space-y-6" data-testid="seller-delivery-settings-page">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pickup address">
              <input value={form.pickupAddress} onChange={(event) => setForm((current) => ({ ...current, pickupAddress: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-address" />
            </Field>
            <Field label="Pickup city">
              <input value={form.pickupCity} onChange={(event) => setForm((current) => ({ ...current, pickupCity: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-city" />
            </Field>
            <Field label="Postal code">
              <input value={form.pickupPostalCode} onChange={(event) => setForm((current) => ({ ...current, pickupPostalCode: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-postal-code" />
            </Field>
            <Field label="Pickup phone">
              <input value={form.pickupContactPhone} onChange={(event) => setForm((current) => ({ ...current, pickupContactPhone: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-contact-phone" />
            </Field>
            <Field label="Pickup latitude">
              <input value={form.pickupLatitude} onChange={(event) => setForm((current) => ({ ...current, pickupLatitude: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-latitude" />
            </Field>
            <Field label="Pickup longitude">
              <input value={form.pickupLongitude} onChange={(event) => setForm((current) => ({ ...current, pickupLongitude: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-longitude" />
            </Field>
            <Field label="Pickup contact">
              <input value={form.pickupContactName} onChange={(event) => setForm((current) => ({ ...current, pickupContactName: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-contact-name" />
            </Field>
            <Field label="Default carrier">
              <select value={form.defaultCarrier} onChange={(event) => setForm((current) => ({ ...current, defaultCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-carrier">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label="Same-city priority">
              <select value={form.sameCityPreferredCarrier} onChange={(event) => setForm((current) => ({ ...current, sameCityPreferredCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-same-city-carrier">
                <option value="YANDEX">Yandex</option>
                <option value="CDEK">CDEK</option>
              </select>
            </Field>
            <Field label="Inter-city priority">
              <select value={form.interCityPreferredCarrier} onChange={(event) => setForm((current) => ({ ...current, interCityPreferredCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-inter-city-carrier">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label="Fallback carrier">
              <select value={form.fallbackCarrier} onChange={(event) => setForm((current) => ({ ...current, fallbackCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-fallback-carrier">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label="Default weight (g)">
              <input value={form.defaultWeightGram} onChange={(event) => setForm((current) => ({ ...current, defaultWeightGram: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-weight-gram" />
            </Field>
            <Field label="Length (cm)">
              <input value={form.defaultLengthCm} onChange={(event) => setForm((current) => ({ ...current, defaultLengthCm: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-length-cm" />
            </Field>
            <Field label="Width (cm)">
              <input value={form.defaultWidthCm} onChange={(event) => setForm((current) => ({ ...current, defaultWidthCm: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-width-cm" />
            </Field>
            <Field label="Height (cm)">
              <input value={form.defaultHeightCm} onChange={(event) => setForm((current) => ({ ...current, defaultHeightCm: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-height-cm" />
            </Field>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" checked={form.enabledCdek} onChange={(event) => setForm((current) => ({ ...current, enabledCdek: event.target.checked }))} data-testid="delivery-enabled-cdek" />
              Enable CDEK nationwide offers
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" checked={form.enabledYandex} onChange={(event) => setForm((current) => ({ ...current, enabledYandex: event.target.checked }))} data-testid="delivery-enabled-yandex" />
              Enable Yandex express mock offers
            </label>
          </div>

          <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60" data-testid="delivery-settings-save">
            {saving ? "Saving..." : "Save delivery settings"}
          </button>

          {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
          {successMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" data-testid="delivery-settings-success">{successMessage}</div> : null}
        </div>
      )}
    </SectionCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
