"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  getShopPaymentSettings,
  updateShopPaymentSettings,
  uploadShopPaymentQr,
  deleteShopPaymentQr,
} from "@/lib/seller-api";
import { getSellerOnboardingProfile } from "@/lib/seller-onboarding-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";

export function SellerPaymentSettingsPageClient() {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [loading, setLoading] = useState(true);
  const { run: runSave, isRunning: saving } = useActionFeedback();
  const { run: runUpload, isRunning: uploading } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [prefilledFromProfile, setPrefilledFromProfile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    bankName: "",
    recipientName: "",
    recipientPhone: "",
    recipientAccount: "",
    sbpPhone: "",
    paymentInstruction: "",
    status: "PENDING_REVIEW" as "READY" | "DISABLED" | "PENDING_REVIEW",
    staticQrImageUrl: "",
    isReady: false,
    allowPrepaidQr: true,
    allowPayOnDeliverySellerQr: false,
    allowDepositPayment: false,
    depositPercent: "",
    depositRequiredAboveAmount: "",
    codMaxOrderAmount: "",
    yandexCardOnDeliveryStatus: "NOT_CONFIGURED",
    cashCourierCollectionStatus: "NOT_AVAILABLE",
    availableMethods: [] as string[],
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    if (newFile) {
      setPreviewUrl(URL.createObjectURL(newFile));
    } else {
      setPreviewUrl(null);
    }
  };

  const previewToRender = previewUrl || form.staticQrImageUrl;

  const handleRemoveQr = async () => {
    if (!currentShopId) return;
    const confirmQuestion = t("seller.paymentSettings.confirmRemoveQr");
    if (!window.confirm(confirmQuestion)) return;
    setError(null);
    setMessage(null);
    await runUpload({
      action: async () => {
        const saved = await deleteShopPaymentQr(currentShopId, "");
        setForm((current) => ({
          ...current,
          staticQrImageUrl: "",
          status: saved.status as "READY" | "DISABLED" | "PENDING_REVIEW",
          isReady: saved.isReady,
        }));
        handleFileChange(null);
        setMessage(t("seller.paymentSettings.qrCodeRemoved"));
        return saved;
      },
      successMessage: t("seller.paymentSettings.qrCodeRemoved"),
      errorMessage: t("seller.paymentSettings.saveFailed"),
    }).catch((err) => {
      setError(err.message);
    });
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const [settingsResult, profileResult] = await Promise.allSettled([
          getShopPaymentSettings(currentShopId, ""),
          getSellerOnboardingProfile(),
        ]);
        if (!mounted) return;
        if (settingsResult.status === "rejected") {
          throw settingsResult.reason;
        }
        const settings = settingsResult.value;
        const profile =
          profileResult.status === "fulfilled" ? profileResult.value : null;
        const shouldPrefillProfile =
          Boolean(profile) &&
          !settings.bankName &&
          !settings.recipientName &&
          !settings.recipientPhone &&
          !settings.recipientAccount;
        setForm({
          bankName: settings.bankName ?? (shouldPrefillProfile ? profile?.bankName : "") ?? "",
          recipientName:
            settings.recipientName ??
            (shouldPrefillProfile ? profile?.contactName ?? profile?.legalName : "") ??
            "",
          recipientPhone:
            settings.recipientPhone ??
            (shouldPrefillProfile ? profile?.contactPhone : "") ??
            "",
          recipientAccount:
            settings.recipientAccount ??
            (shouldPrefillProfile ? profile?.bankAccount : "") ??
            "",
          sbpPhone: settings.sbpPhone ?? "",
          paymentInstruction: settings.paymentInstruction ?? "",
          status: settings.status as "READY" | "DISABLED" | "PENDING_REVIEW",
          staticQrImageUrl: settings.staticQrImageUrl ?? "",
          isReady: settings.isReady,
          allowPrepaidQr: settings.allowPrepaidQr,
          allowPayOnDeliverySellerQr: settings.allowPayOnDeliverySellerQr,
          allowDepositPayment: settings.allowDepositPayment,
          depositPercent: settings.depositPercent?.toString() ?? "",
          depositRequiredAboveAmount:
            settings.depositRequiredAboveAmount ?? "",
          codMaxOrderAmount: settings.codMaxOrderAmount ?? "",
          yandexCardOnDeliveryStatus:
            settings.yandexCardOnDeliveryStatus ?? "NOT_CONFIGURED",
          cashCourierCollectionStatus:
            settings.cashCourierCollectionStatus ?? "NOT_AVAILABLE",
          availableMethods: settings.availableMethods ?? [],
        });
        setPrefilledFromProfile(
          shouldPrefillProfile &&
            Boolean(
              profile?.bankName ||
                profile?.contactName ||
                profile?.legalName ||
                profile?.contactPhone ||
                profile?.bankAccount,
            ),
        );
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t("seller.paymentSettings.saveFailed"));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [currentShopId, t, user]);

  const handleSave = async () => {
    if (!currentShopId) return;
    setError(null);
    setMessage(null);
    await runSave({
      action: async () => {
        const saved = await updateShopPaymentSettings(
          currentShopId,
          {
            paymentMode: "STATIC_QR",
            status: form.status,
            bankName: form.bankName,
            recipientName: form.recipientName,
            recipientPhone: form.recipientPhone,
            recipientAccount: form.recipientAccount,
            sbpPhone: form.sbpPhone,
            paymentInstruction: form.paymentInstruction,
            allowPrepaidQr: form.allowPrepaidQr,
            allowPayOnDeliverySellerQr: form.allowPayOnDeliverySellerQr,
            allowDepositPayment: form.allowDepositPayment,
            depositPercent: form.depositPercent.trim()
              ? Number(form.depositPercent)
              : null,
            depositRequiredAboveAmount: form.depositRequiredAboveAmount.trim()
              ? Number(form.depositRequiredAboveAmount)
              : null,
            codMaxOrderAmount: form.codMaxOrderAmount.trim()
              ? Number(form.codMaxOrderAmount)
              : null,
            yandexCardOnDeliveryStatus:
              form.yandexCardOnDeliveryStatus as
                | "NOT_CONFIGURED"
                | "PROVIDER_PENDING"
                | "AVAILABLE"
                | "DISABLED",
            cashCourierCollectionStatus: "NOT_AVAILABLE",
          },
          "",
        );
        setForm((current) => ({
          ...current,
          status: saved.status as "READY" | "DISABLED" | "PENDING_REVIEW",
          staticQrImageUrl: saved.staticQrImageUrl ?? "",
          isReady: saved.isReady,
          allowPrepaidQr: saved.allowPrepaidQr,
          allowPayOnDeliverySellerQr: saved.allowPayOnDeliverySellerQr,
          allowDepositPayment: saved.allowDepositPayment,
          depositPercent: saved.depositPercent?.toString() ?? "",
          depositRequiredAboveAmount: saved.depositRequiredAboveAmount ?? "",
          codMaxOrderAmount: saved.codMaxOrderAmount ?? "",
          yandexCardOnDeliveryStatus: saved.yandexCardOnDeliveryStatus,
          cashCourierCollectionStatus: saved.cashCourierCollectionStatus,
          availableMethods: saved.availableMethods ?? [],
        }));
        setMessage(t("seller.paymentSettings.settingsSaved"));
        return saved;
      },
      successMessage: t("seller.paymentSettings.settingsSaved"),
      errorMessage: t("seller.paymentSettings.saveFailed"),
    }).catch((err) => {
      setError(err.message);
    });
  };

  const handleUpload = async () => {
    if (!currentShopId || !file) return;
    setError(null);
    setMessage(null);
    await runUpload({
      action: async () => {
        const saved = await uploadShopPaymentQr(currentShopId, file, "");
        setForm((current) => ({
          ...current,
          staticQrImageUrl: saved.staticQrImageUrl ?? "",
          status: saved.status as "READY" | "DISABLED" | "PENDING_REVIEW",
          isReady: saved.isReady,
        }));
        handleFileChange(null);
        setMessage(t("seller.paymentSettings.qrUploaded"));
        return saved;
      },
      successMessage: t("seller.paymentSettings.qrUploaded"),
      errorMessage: t("seller.paymentSettings.uploadFailed"),
    }).catch((err) => {
      setError(err.message);
    });
  };

  return (
    <SectionCard
      eyebrow={t("seller.paymentSettings.title")}
      title={t("seller.paymentSettings.title")}
      description={t("seller.paymentSettings.subtitle")}
    >
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
      ) : (
        <div className="space-y-6" data-testid="seller-payment-settings-page">
          {prefilledFromProfile ? (
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]" data-testid="payment-settings-profile-prefill">
              {t("seller.paymentSettings.profilePrefillHelper")}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("seller.paymentSettings.bankName")}>
              <input value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} className="public-input" data-testid="payment-settings-bank-name" />
            </Field>
            <Field label={t("seller.paymentSettings.recipientName")}>
              <input value={form.recipientName} onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))} className="public-input" data-testid="payment-settings-recipient-name" />
            </Field>
            <Field label={t("seller.paymentSettings.recipientPhone")}>
              <input value={form.recipientPhone} onChange={(event) => setForm((current) => ({ ...current, recipientPhone: event.target.value }))} className="public-input" data-testid="payment-settings-recipient-phone" />
            </Field>
            <Field label={t("seller.paymentSettings.sbpPhone")}>
              <input value={form.sbpPhone} onChange={(event) => setForm((current) => ({ ...current, sbpPhone: event.target.value }))} className="public-input" data-testid="payment-settings-sbp-phone" />
            </Field>
            <Field label={t("seller.paymentSettings.recipientAccount")}>
              <input value={form.recipientAccount} onChange={(event) => setForm((current) => ({ ...current, recipientAccount: event.target.value }))} className="public-input" data-testid="payment-settings-recipient-account" />
            </Field>
            <Field label={t("seller.paymentSettings.status")}>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "READY" | "DISABLED" | "PENDING_REVIEW" }))} className="public-input" data-testid="payment-settings-status">
                <option value="PENDING_REVIEW">{t("seller.paymentSettings.pendingSetup")}</option>
                <option value="READY">{t("common.status.ready")}</option>
                <option value="DISABLED">{t("common.status.disabled")}</option>
              </select>
            </Field>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t("seller.paymentSettings.paymentMethodStrategy")}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ToggleField
                label={t("seller.paymentSettings.allowPrepaidQr")}
                checked={form.allowPrepaidQr}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowPrepaidQr: checked,
                  }))
                }
              />
              <ToggleField
                label={t("seller.paymentSettings.allowPayOnDeliverySellerQr")}
                checked={form.allowPayOnDeliverySellerQr}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowPayOnDeliverySellerQr: checked,
                  }))
                }
              />
              <ToggleField
                label={t("seller.paymentSettings.allowDepositPayment")}
                checked={form.allowDepositPayment}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowDepositPayment: checked,
                  }))
                }
              />
              <Field label={t("seller.paymentSettings.depositPercent")}>
                <input value={form.depositPercent} onChange={(event) => setForm((current) => ({ ...current, depositPercent: event.target.value }))} className="public-input" />
              </Field>
              <Field label={t("seller.paymentSettings.depositRequiredAboveAmount")}>
                <input value={form.depositRequiredAboveAmount} onChange={(event) => setForm((current) => ({ ...current, depositRequiredAboveAmount: event.target.value }))} className="public-input" />
              </Field>
              <Field label={t("seller.paymentSettings.codMaxAmount")}>
                <input value={form.codMaxOrderAmount} onChange={(event) => setForm((current) => ({ ...current, codMaxOrderAmount: event.target.value }))} className="public-input" />
              </Field>
              <Field label={t("seller.paymentSettings.yandexCardOnDelivery")}>
                <select value={form.yandexCardOnDeliveryStatus} onChange={(event) => setForm((current) => ({ ...current, yandexCardOnDeliveryStatus: event.target.value }))} className="public-input">
                  <option value="NOT_CONFIGURED">{t("seller.paymentSettings.futureNotConfigured")}</option>
                  <option value="PROVIDER_PENDING">{t("seller.paymentSettings.providerPending")}</option>
                  <option value="DISABLED">{t("common.status.disabled")}</option>
                  <option value="AVAILABLE">{t("seller.paymentSettings.availableAfterVerification")}</option>
                </select>
              </Field>
              <Field label={t("seller.paymentSettings.cashCourierCollection")}>
                <input value={t("common.status.notAvailable")} disabled className="public-input bg-[var(--panel)] text-[var(--muted)]" />
              </Field>
            </div>
            <div className="mt-4 rounded-[1rem] border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
              {t("seller.paymentSettings.availableBuyerMethods", { value: form.availableMethods.join(", ") || t("common.status.none") })}
            </div>
          </div>

          <Field label={t("seller.paymentSettings.buyerInstruction")}>
            <textarea value={form.paymentInstruction} onChange={(event) => setForm((current) => ({ ...current, paymentInstruction: event.target.value }))} rows={4} className="public-input min-h-32" data-testid="payment-settings-instruction" />
          </Field>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">{t("seller.paymentSettings.staticQrImage")}</p>
            {previewToRender ? (
              <div className="mt-4 relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewToRender} alt={t("seller.paymentSettings.qrAlt")} className="mt-4 h-56 w-56 rounded-[1.25rem] border border-[var(--border)] object-contain" data-testid="payment-settings-qr-preview" />
                {previewUrl && (
                  <span className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    {t("seller.paymentSettings.newPreview")}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]" data-testid="payment-settings-no-qr-text">{t("seller.paymentSettings.noQr")}</p>
            )}
            
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="public-button-secondary px-5 py-3 text-sm cursor-pointer inline-block" data-testid="payment-settings-qr-file-label">
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)} className="hidden" data-testid="payment-settings-qr-file" />
                  {form.staticQrImageUrl ? t("seller.paymentSettings.updateQrCode") : t("seller.paymentSettings.uploadQrCode")}
                </label>

                {form.staticQrImageUrl && (
                  <button type="button" onClick={() => void handleRemoveQr()} disabled={uploading} className="bg-rose-100 text-rose-800 hover:bg-rose-200 px-5 py-3 text-sm font-semibold rounded-full disabled:opacity-60 transition" data-testid="payment-settings-qr-remove">
                    {uploading ? t("seller.productDetail.saving") : t("seller.paymentSettings.removeQrCode")}
                  </button>
                )}
              </div>

              {file && (
                <div className="flex items-center gap-3 bg-[var(--panel)] p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] truncate max-w-[200px]">
                    {t("seller.paymentSettings.selectedFile", { value: file.name })}
                  </p>
                  <button type="button" onClick={() => void handleUpload()} disabled={uploading} className="public-button-primary px-4 py-2 text-xs" data-testid="payment-settings-qr-upload">
                    {uploading ? t("seller.productDetail.uploading") : t("seller.paymentSettings.uploadQr")}
                  </button>
                  <button type="button" onClick={() => handleFileChange(null)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline">
                    {t("seller.paymentSettings.cancel")}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="public-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" data-testid="payment-settings-save">
              {saving ? t("seller.productDetail.saving") : t("seller.paymentSettings.saveSettings")}
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {form.isReady ? t("seller.paymentSettings.readyForCheckout") : t("seller.paymentSettings.notReadyForCheckout")}
            </span>
          </div>

          {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        </div>
      )}
    </SectionCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-[1rem] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}
