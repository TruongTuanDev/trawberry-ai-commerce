"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
import { roleRegisterRequest } from "@/lib/auth-api";
import { maybeNormalizePhone } from "@/lib/phone";

export function SellerRegisterPageClient() {
  const router = useRouter();
  const { t } = useI18n("seller");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { run, isRunning } = useActionFeedback();

  const handleSubmit = async () => {
    setError(null);

    await run({
      action: async () => {
        if (!email.trim() && !phone.trim()) {
          throw new Error(t("seller.register.emailOrPhoneRequired"));
        }
        if (password !== confirmPassword) {
          throw new Error(t("seller.register.passwordMismatch"));
        }

        const normalizedPhone = phone.trim() ? maybeNormalizePhone(phone) : "";

        return roleRegisterRequest("SELLER", {
          email: email.trim() || undefined,
          phone: normalizedPhone || undefined,
          password,
          fullName,
        });
      },
      authMode: "register",
      successMessage: t("seller.register.success"),
      errorMessage: t("seller.register.failed"),
      onSuccess: async () => {
        setError(null);
        router.push("/seller/login?registered=1");
      },
      onError: (_error, message) => {
        setError(message);
      },
    }).catch(() => undefined);
  };

  return (
    <PublicShell>
      <main className="px-4 py-10 sm:px-6">
        <section className="card-panel mx-auto max-w-xl rounded-[2rem] px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("seller.register.eyebrow")}</p>
          <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
            {t("seller.register.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {t("seller.register.description")}
          </p>

          <div className="mt-6 grid gap-4">
            <Field label={t("seller.register.ownerName")}>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="public-input" data-testid="seller-register-name" />
            </Field>
            <Field label={t("seller.register.email")}>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="public-input" placeholder={t("seller.register.emailPlaceholder")} data-testid="seller-register-email" />
            </Field>
            <Field label={t("seller.register.phone")}>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="public-input" placeholder={t("seller.register.phonePlaceholder")} data-testid="seller-register-phone" />
            </Field>
            <Field label={t("seller.register.password")}>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="public-input" autoComplete="new-password" data-testid="seller-register-password" />
            </Field>
            <Field label={t("seller.register.confirmPassword")}>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="public-input" autoComplete="new-password" data-testid="seller-register-confirm-password" />
            </Field>
            {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            <button type="button" onClick={() => void handleSubmit()} disabled={isRunning} className="public-button-primary px-5 py-3 text-sm disabled:opacity-60" data-testid="seller-register-submit">
              {isRunning ? t("seller.register.registering") : t("seller.register.createAccount")}
            </button>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/seller/login" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                {t("seller.register.alreadyHaveAccount")}
              </Link>
              <Link href="/customer/register" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                {t("seller.register.registerAsCustomer")}
              </Link>
            </div>
          </div>
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
