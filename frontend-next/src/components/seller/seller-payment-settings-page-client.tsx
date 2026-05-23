"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  getShopPaymentSettings,
  updateShopPaymentSettings,
  uploadShopPaymentQr,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function SellerPaymentSettingsPageClient() {
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [loading, setLoading] = useState(true);
  const { run: runSave, isRunning: saving } = useActionFeedback();
  const { run: runUpload, isRunning: uploading } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const settings = await getShopPaymentSettings(currentShopId, "");
        if (!mounted) return;
        setForm({
          bankName: settings.bankName ?? "",
          recipientName: settings.recipientName ?? "",
          recipientPhone: settings.recipientPhone ?? "",
          recipientAccount: settings.recipientAccount ?? "",
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
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load payment settings.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [currentShopId, user]);

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
        setMessage("Payment settings saved.");
        return saved;
      },
      successMessage: "Lưu cấu hình thanh toán thành công!",
      errorMessage: "Không thể lưu cấu hình thanh toán.",
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
        setFile(null);
        setMessage("Static QR uploaded.");
        return saved;
      },
      successMessage: "Tải ảnh QR thanh toán thành công!",
      errorMessage: "Không thể tải ảnh QR thanh toán.",
    }).catch((err) => {
      setError(err.message);
    });
  };

  return (
    <SectionCard
      eyebrow="Direct seller payment"
      title="Payment settings"
      description="Configure the static SBP or bank QR the buyer will see at checkout for this shop."
    >
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : (
        <div className="space-y-6" data-testid="seller-payment-settings-page">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bank name">
              <input value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} className="public-input" data-testid="payment-settings-bank-name" />
            </Field>
            <Field label="Recipient name">
              <input value={form.recipientName} onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))} className="public-input" data-testid="payment-settings-recipient-name" />
            </Field>
            <Field label="Recipient phone">
              <input value={form.recipientPhone} onChange={(event) => setForm((current) => ({ ...current, recipientPhone: event.target.value }))} className="public-input" data-testid="payment-settings-recipient-phone" />
            </Field>
            <Field label="SBP phone">
              <input value={form.sbpPhone} onChange={(event) => setForm((current) => ({ ...current, sbpPhone: event.target.value }))} className="public-input" data-testid="payment-settings-sbp-phone" />
            </Field>
            <Field label="Recipient account">
              <input value={form.recipientAccount} onChange={(event) => setForm((current) => ({ ...current, recipientAccount: event.target.value }))} className="public-input" data-testid="payment-settings-recipient-account" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "READY" | "DISABLED" | "PENDING_REVIEW" }))} className="public-input" data-testid="payment-settings-status">
                <option value="PENDING_REVIEW">Pending setup</option>
                <option value="READY">Ready</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </Field>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Payment method strategy
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Allow prepaid QR"
                checked={form.allowPrepaidQr}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowPrepaidQr: checked,
                  }))
                }
              />
              <ToggleField
                label="Allow pay on delivery via seller QR"
                checked={form.allowPayOnDeliverySellerQr}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowPayOnDeliverySellerQr: checked,
                  }))
                }
              />
              <ToggleField
                label="Allow deposit payment"
                checked={form.allowDepositPayment}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowDepositPayment: checked,
                  }))
                }
              />
              <Field label="Deposit percent">
                <input value={form.depositPercent} onChange={(event) => setForm((current) => ({ ...current, depositPercent: event.target.value }))} className="public-input" />
              </Field>
              <Field label="Deposit required above amount">
                <input value={form.depositRequiredAboveAmount} onChange={(event) => setForm((current) => ({ ...current, depositRequiredAboveAmount: event.target.value }))} className="public-input" />
              </Field>
              <Field label="COD max amount">
                <input value={form.codMaxOrderAmount} onChange={(event) => setForm((current) => ({ ...current, codMaxOrderAmount: event.target.value }))} className="public-input" />
              </Field>
              <Field label="Yandex card on delivery">
                <select value={form.yandexCardOnDeliveryStatus} onChange={(event) => setForm((current) => ({ ...current, yandexCardOnDeliveryStatus: event.target.value }))} className="public-input">
                  <option value="NOT_CONFIGURED">Future / not configured</option>
                  <option value="PROVIDER_PENDING">Provider pending</option>
                  <option value="DISABLED">Disabled</option>
                  <option value="AVAILABLE">Available after provider verification</option>
                </select>
              </Field>
              <Field label="Cash courier collection">
                <input value="Not available" disabled className="public-input bg-[var(--panel)] text-[var(--muted)]" />
              </Field>
            </div>
            <div className="mt-4 rounded-[1rem] border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
              Available buyer methods now: {form.availableMethods.join(", ") || "None"}
            </div>
          </div>

          <Field label="Buyer payment instruction">
            <textarea value={form.paymentInstruction} onChange={(event) => setForm((current) => ({ ...current, paymentInstruction: event.target.value }))} rows={4} className="public-input min-h-32" data-testid="payment-settings-instruction" />
          </Field>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Static QR image</p>
            {form.staticQrImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.staticQrImageUrl} alt="Seller payment QR" className="mt-4 h-56 w-56 rounded-[1.25rem] border border-[var(--border)] object-contain" data-testid="payment-settings-qr-preview" />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">No QR uploaded yet.</p>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="public-input" data-testid="payment-settings-qr-file" />
              <button type="button" onClick={() => void handleUpload()} disabled={uploading || !file} className="public-button-secondary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" data-testid="payment-settings-qr-upload">
                {uploading ? "Đang tải lên..." : "Upload QR"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="public-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" data-testid="payment-settings-save">
              {saving ? "Đang lưu..." : "Save payment settings"}
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {form.isReady ? "Ready for checkout" : "Not checkout-ready yet"}
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
