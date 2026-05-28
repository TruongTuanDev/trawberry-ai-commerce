"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
import { roleRegisterRequest } from "@/lib/auth-api";
import { maybeNormalizePhone } from "@/lib/phone";

export function CustomerRegisterPageClient() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { run, isRunning } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const { locale, t } = useI18n("customer");

  const handleSubmit = async () => {
    setError(null);

    await run({
      action: async () => {
        if (!email.trim() && !phone.trim()) {
          throw new Error(t("customer.auth.emailOrPhoneRequired"));
        }
        if (password.length < 6) {
          throw new Error(t("customer.auth.passwordLength"));
        }
        if (password !== confirmPassword) {
          throw new Error(t("customer.auth.passwordMismatch"));
        }

        const normalizedPhone = phone.trim() ? maybeNormalizePhone(phone) : "";

        return roleRegisterRequest("CUSTOMER", {
          email: email.trim() || undefined,
          phone: normalizedPhone || undefined,
          password,
          fullName,
        });
      },
      authMode: "register",
      role: "customer",
      locale,
      successMessage: t("customer.auth.registerSuccess"),
      errorMessage: t("customer.auth.registerFailed"),
      onSuccess: async () => {
        setError(null);
        router.push("/customer/login?registered=1");
      },
      onError: (_error, message) => {
        setError(message);
      },
    }).catch(() => undefined);
  };

  return (
    <PublicShell>
      <main className="px-4 py-10 sm:px-6">
        <section className="card-panel mx-auto max-w-md rounded-[2rem] px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("customer.auth.accountEyebrow")}
          </p>
          <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold">
            {t("customer.auth.registerTitle")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {t("customer.auth.registerSubtitle")}
          </p>
          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <Field label={t("customer.auth.fullName")}>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="public-input" data-testid="customer-register-name" disabled={isRunning} />
            </Field>
            <Field label={t("customer.auth.email")}>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="public-input" placeholder={t("customer.auth.emailPlaceholder")} data-testid="customer-register-email" disabled={isRunning} />
            </Field>
            <Field label={t("customer.auth.phone")}>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="public-input" placeholder={t("customer.auth.phonePlaceholder")} data-testid="customer-register-phone" disabled={isRunning} />
            </Field>
            <Field label={t("customer.auth.password")}>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="public-input" autoComplete="new-password" data-testid="customer-register-password" disabled={isRunning} />
            </Field>
            <Field label={t("customer.auth.confirmPassword")}>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="public-input" autoComplete="new-password" data-testid="customer-register-confirm-password" disabled={isRunning} />
            </Field>
            {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]" role="alert" data-testid="customer-register-error">{error}</div> : null}
            <button
              type="submit"
              disabled={isRunning}
              className="public-button-primary px-5 py-3 text-sm disabled:opacity-60"
              data-testid="customer-register-submit"
              aria-busy={isRunning}
            >
              {isRunning ? t("customer.auth.creatingAccount") : t("customer.auth.createAccountButton")}
            </button>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/customer/login" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                {t("customer.auth.alreadyHaveAccount")}
              </Link>
              <Link href="/seller/register" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                {t("customer.auth.becomeSeller")}
              </Link>
            </div>
          </form>
        </section>
      </main>
    </PublicShell>
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
