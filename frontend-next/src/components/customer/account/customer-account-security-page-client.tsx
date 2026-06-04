"use client";

import { useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
import { changeCustomerPassword } from "@/lib/customer-api";

export function CustomerAccountSecurityPageClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { run, isRunning } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { locale, t } = useI18n("customer");

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    await run({
      action: async () => {
        if (newPassword !== confirmPassword) {
          throw new Error(t("customer.security.passwordMismatch"));
        }
        if (newPassword.length < 6) {
          throw new Error(t("customer.auth.passwordLength"));
        }

        return changeCustomerPassword({
          currentPassword,
          newPassword,
        });
      },
      role: "customer",
      locale,
      successMessage: t("customer.security.success"),
      onSuccess: () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess(t("customer.security.success"));
      },
      errorMessage: t("customer.security.failed"),
      onError: (_issue, message) => {
        setError(message);
      },
    }).catch(() => undefined);
  };

  return (
    <CustomerAccountShell
      title={t("customer.security.title")}
      description={t("customer.security.description")}
    >
      <section className="card-panel max-w-3xl rounded-[1.8rem] px-6 py-6 sm:px-7">
        {error ? (
          <div className="mb-4 rounded-[1.25rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="grid gap-4">
          <Field label={t("customer.security.currentPassword")}>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="public-input" data-testid="customer-security-current-password" />
          </Field>
          <Field label={t("customer.security.newPassword")}>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="public-input" data-testid="customer-security-new-password" />
          </Field>
          <Field label={t("customer.security.confirmNewPassword")}>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="public-input" data-testid="customer-security-confirm-password" />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isRunning}
          className="public-button-primary mt-6 px-5 py-3 text-sm disabled:opacity-60"
          data-testid="customer-security-submit"
        >
          {isRunning ? t("customer.security.saving") : t("customer.security.submit")}
        </button>
      </section>
    </CustomerAccountShell>
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
