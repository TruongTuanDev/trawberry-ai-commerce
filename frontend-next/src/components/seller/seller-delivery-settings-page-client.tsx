"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { getDeliverySettings, updateDeliverySettings } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerDeliverySettingsPageClient() {
  const user = useAuthStore((state) => state.user);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    pickupAddress: "",
    pickupCity: "",
    pickupPostalCode: "",
    pickupPhone: "",
    pickupContactName: "",
    enabledCdek: true,
    enabledYandex: false,
    defaultCarrier: "CDEK" as "CDEK" | "YANDEX",
    defaultWeight: "1",
    defaultLength: "30",
    defaultWidth: "20",
    defaultHeight: "10",
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
          pickupPhone: settings.pickupPhone,
          pickupContactName: settings.pickupContactName,
          enabledCdek: settings.enabledCarriers.includes("CDEK"),
          enabledYandex: settings.enabledCarriers.includes("YANDEX"),
          defaultCarrier: settings.defaultCarrier as "CDEK" | "YANDEX",
          defaultWeight: settings.defaultWeight,
          defaultLength: settings.defaultLength,
          defaultWidth: settings.defaultWidth,
          defaultHeight: settings.defaultHeight,
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
          pickupPhone: form.pickupPhone,
          pickupContactName: form.pickupContactName,
          enabledCarriers,
          defaultCarrier: form.defaultCarrier,
          defaultWeight: Number(form.defaultWeight || "0"),
          defaultLength: Number(form.defaultLength || "0"),
          defaultWidth: Number(form.defaultWidth || "0"),
          defaultHeight: Number(form.defaultHeight || "0"),
        },
        "",
      );

      setForm((current) => ({
        ...current,
        defaultCarrier: saved.defaultCarrier as "CDEK" | "YANDEX",
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
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pickup address">
              <input value={form.pickupAddress} onChange={(event) => setForm((current) => ({ ...current, pickupAddress: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Pickup city">
              <input value={form.pickupCity} onChange={(event) => setForm((current) => ({ ...current, pickupCity: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Postal code">
              <input value={form.pickupPostalCode} onChange={(event) => setForm((current) => ({ ...current, pickupPostalCode: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Pickup phone">
              <input value={form.pickupPhone} onChange={(event) => setForm((current) => ({ ...current, pickupPhone: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Pickup contact">
              <input value={form.pickupContactName} onChange={(event) => setForm((current) => ({ ...current, pickupContactName: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Default carrier">
              <select value={form.defaultCarrier} onChange={(event) => setForm((current) => ({ ...current, defaultCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label="Default weight (kg)">
              <input value={form.defaultWeight} onChange={(event) => setForm((current) => ({ ...current, defaultWeight: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Length (cm)">
              <input value={form.defaultLength} onChange={(event) => setForm((current) => ({ ...current, defaultLength: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Width (cm)">
              <input value={form.defaultWidth} onChange={(event) => setForm((current) => ({ ...current, defaultWidth: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Height (cm)">
              <input value={form.defaultHeight} onChange={(event) => setForm((current) => ({ ...current, defaultHeight: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" checked={form.enabledCdek} onChange={(event) => setForm((current) => ({ ...current, enabledCdek: event.target.checked }))} />
              Enable CDEK nationwide offers
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" checked={form.enabledYandex} onChange={(event) => setForm((current) => ({ ...current, enabledYandex: event.target.checked }))} />
              Enable Yandex express mock offers
            </label>
          </div>

          <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Saving..." : "Save delivery settings"}
          </button>

          {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
          {successMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}
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
