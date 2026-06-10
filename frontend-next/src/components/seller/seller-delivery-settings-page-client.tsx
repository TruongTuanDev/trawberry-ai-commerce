"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { ApiError } from "@/lib/api";
import { getDeliverySettings, updateDeliverySettings } from "@/lib/seller-api";
import { getSellerOnboardingProfile } from "@/lib/seller-onboarding-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";

export function SellerDeliverySettingsPageClient() {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [loading, setLoading] = useState(true);
  const { run: runSave, isRunning: saving } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [prefilledFromProfile, setPrefilledFromProfile] = useState(false);
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
        const [settingsResult, profileResult] = await Promise.allSettled([
          getDeliverySettings(currentShopId, ""),
          getSellerOnboardingProfile(),
        ]);
        if (!mounted) return;
        if (settingsResult.status === "fulfilled") {
          const settings = settingsResult.value;
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
          setPrefilledFromProfile(false);
        } else if (
          settingsResult.reason instanceof ApiError &&
          settingsResult.reason.status === 404 &&
          profileResult.status === "fulfilled"
        ) {
          const profile = profileResult.value;
          setForm((current) => ({
            ...current,
            pickupAddress: profile.legalAddress ?? "",
            pickupContactPhone: profile.contactPhone ?? "",
            pickupContactName: profile.contactName ?? "",
          }));
          setPrefilledFromProfile(
            Boolean(
              profile.legalAddress ||
                profile.contactPhone ||
                profile.contactName,
            ),
          );
        } else if (
          !(settingsResult.reason instanceof ApiError) ||
          settingsResult.reason.status !== 404
        ) {
          throw settingsResult.reason;
        }
      } catch (issue) {
        if (mounted) {
          setError(
            issue instanceof Error
              ? issue.message
              : t("seller.delivery.loadFailed"),
          );
        }
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
  }, [currentShopId, t, user]);

  const handleSave = async () => {
    if (!currentShopId) return;

    const enabledCarriers = [
      ...(form.enabledCdek ? (["CDEK"] as const) : []),
      ...(form.enabledYandex ? (["YANDEX"] as const) : []),
    ];

    if (!enabledCarriers.length) {
      setError(t("seller.delivery.carrierRequired"));
      return;
    }

    setError(null);
    setSuccessMessage(null);

    await runSave({
      action: async () => {
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
        setSuccessMessage(t("seller.delivery.saved"));
        return saved;
      },
      successMessage: t("seller.delivery.saved"),
      errorMessage: t("seller.delivery.saveFailed"),
    }).catch((err) => {
      setError(err.message);
    });
  };

  return (
    <SectionCard
      eyebrow={t("seller.delivery.eyebrow")}
      title={t("seller.delivery.title")}
      description={t("seller.delivery.subtitle")}
    >
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
      ) : (
        <div className="space-y-6" data-testid="seller-delivery-settings-page">
          {prefilledFromProfile ? (
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]" data-testid="delivery-profile-prefill">
              {t("seller.delivery.profilePrefillHelper")}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("seller.delivery.pickupAddress")}>
              <input value={form.pickupAddress} onChange={(event) => setForm((current) => ({ ...current, pickupAddress: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-address" />
            </Field>
            <Field label={t("seller.delivery.pickupCity")}>
              <input value={form.pickupCity} onChange={(event) => setForm((current) => ({ ...current, pickupCity: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-city" />
            </Field>
            <Field label={t("seller.delivery.postalCode")}>
              <input value={form.pickupPostalCode} onChange={(event) => setForm((current) => ({ ...current, pickupPostalCode: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-postal-code" />
            </Field>
            <Field label={t("seller.delivery.pickupPhone")}>
              <input value={form.pickupContactPhone} onChange={(event) => setForm((current) => ({ ...current, pickupContactPhone: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-contact-phone" />
            </Field>
            <Field label={t("seller.delivery.pickupLatitude")}>
              <input value={form.pickupLatitude} onChange={(event) => setForm((current) => ({ ...current, pickupLatitude: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-latitude" />
            </Field>
            <Field label={t("seller.delivery.pickupLongitude")}>
              <input value={form.pickupLongitude} onChange={(event) => setForm((current) => ({ ...current, pickupLongitude: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-longitude" />
            </Field>
            <Field label={t("seller.delivery.pickupContact")}>
              <input value={form.pickupContactName} onChange={(event) => setForm((current) => ({ ...current, pickupContactName: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-pickup-contact-name" />
            </Field>
            <Field label={t("seller.delivery.defaultCarrier")}>
              <select value={form.defaultCarrier} onChange={(event) => setForm((current) => ({ ...current, defaultCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-carrier">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label={t("seller.delivery.sameCityPriority")}>
              <select value={form.sameCityPreferredCarrier} onChange={(event) => setForm((current) => ({ ...current, sameCityPreferredCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-same-city-carrier">
                <option value="YANDEX">Yandex</option>
                <option value="CDEK">CDEK</option>
              </select>
            </Field>
            <Field label={t("seller.delivery.interCityPriority")}>
              <select value={form.interCityPreferredCarrier} onChange={(event) => setForm((current) => ({ ...current, interCityPreferredCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-inter-city-carrier">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label={t("seller.delivery.fallbackCarrier")}>
              <select value={form.fallbackCarrier} onChange={(event) => setForm((current) => ({ ...current, fallbackCarrier: event.target.value as "CDEK" | "YANDEX" }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-fallback-carrier">
                <option value="CDEK">CDEK</option>
                <option value="YANDEX">Yandex</option>
              </select>
            </Field>
            <Field label={t("seller.delivery.defaultWeight")}>
              <input value={form.defaultWeightGram} onChange={(event) => setForm((current) => ({ ...current, defaultWeightGram: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-weight-gram" />
            </Field>
            <Field label={t("seller.delivery.length")}>
              <input value={form.defaultLengthCm} onChange={(event) => setForm((current) => ({ ...current, defaultLengthCm: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-length-cm" />
            </Field>
            <Field label={t("seller.delivery.width")}>
              <input value={form.defaultWidthCm} onChange={(event) => setForm((current) => ({ ...current, defaultWidthCm: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-width-cm" />
            </Field>
            <Field label={t("seller.delivery.height")}>
              <input value={form.defaultHeightCm} onChange={(event) => setForm((current) => ({ ...current, defaultHeightCm: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-default-height-cm" />
            </Field>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" checked={form.enabledCdek} onChange={(event) => setForm((current) => ({ ...current, enabledCdek: event.target.checked }))} data-testid="delivery-enabled-cdek" />
              {t("seller.delivery.enableCdek")}
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" checked={form.enabledYandex} onChange={(event) => setForm((current) => ({ ...current, enabledYandex: event.target.checked }))} data-testid="delivery-enabled-yandex" />
              {t("seller.delivery.enableYandex")}
            </label>
          </div>

          <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60" data-testid="delivery-settings-save">
            {saving ? t("seller.productDetail.saving") : t("seller.delivery.save")}
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
