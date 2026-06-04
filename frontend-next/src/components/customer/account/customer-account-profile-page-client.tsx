"use client";

import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
import {
  getCustomerProfile,
  updateCustomerProfile,
  type CustomerProfile,
} from "@/lib/customer-api";
import { maybeNormalizePhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/auth-store";

export function CustomerAccountProfilePageClient() {
  const authUser = useAuthStore((state) => state.customerUser);
  const refreshRole = useAuthStore((state) => state.refreshRole);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(true);
  const { run, isRunning } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { t } = useI18n("customer");

  useEffect(() => {
    let mounted = true;

    const runInit = async () => {
      try {
        const response = await getCustomerProfile();
        if (!mounted) {
          return;
        }

        setProfile(response);
        setForm({
          name: response.name || "",
          email: authUser?.isSyntheticEmail ? "" : response.email || "",
          phone: response.phone || "",
        });
        setError(null);
      } catch (issue) {
        if (mounted) {
          setError(issue instanceof Error ? issue.message : t("customer.profile.loadFailed"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void runInit();

    return () => {
      mounted = false;
    };
  }, [authUser?.isSyntheticEmail, t]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    await run({
      action: async () => {
        return updateCustomerProfile({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() ? maybeNormalizePhone(form.phone) : undefined,
        });
      },
      successMessage: t("customer.profile.saveSuccess"),
      onSuccess: async (response) => {
        setProfile(response);
        setForm({
          name: response.name || "",
          email: authUser?.isSyntheticEmail ? form.email.trim() : response.email || "",
          phone: response.phone || "",
        });
        await refreshRole("customer");
        setSuccess(t("customer.profile.saveSuccess"));
      },
      errorMessage: t("customer.profile.saveFailed"),
    }).catch((issue) => {
      setError(issue instanceof Error ? issue.message : t("customer.profile.saveFailed"));
    });
  };

  return (
    <CustomerAccountShell
      title={t("customer.profile.title")}
      description={t("customer.profile.description")}
    >
      <section className="card-panel rounded-[1.8rem] px-6 py-6 sm:px-7">
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

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("customer.profile.fullName")}>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="public-input"
              disabled={loading}
              data-testid="customer-profile-name"
            />
          </Field>
          <Field label={t("customer.profile.phone")}>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="public-input"
              disabled={loading}
              placeholder="+7XXXXXXXXXX"
              data-testid="customer-profile-phone"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label={t("customer.profile.email")}>
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="public-input"
              disabled={loading}
              placeholder={authUser?.isSyntheticEmail ? t("customer.profile.syntheticEmailPlaceholder") : "name@example.com"}
              data-testid="customer-profile-email"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || isRunning}
            className="public-button-primary px-5 py-3 text-sm disabled:opacity-60"
            data-testid="customer-profile-save"
          >
            {isRunning ? t("customer.profile.saving") : t("common.actions.save")}
          </button>
          {profile ? (
            <p className="text-sm text-[var(--muted)]">
              {t("customer.profile.memberSince", { date: new Date(profile.createdAt).toLocaleDateString() })}
            </p>
          ) : null}
        </div>
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
