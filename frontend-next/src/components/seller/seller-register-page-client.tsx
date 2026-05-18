"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { getSellerMeRequest, roleLoginRequest, roleRegisterRequest } from "@/lib/auth-api";
import { getRoleHome } from "@/lib/auth-redirect";
import { maybeNormalizePhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/auth-store";

export function SellerRegisterPageClient() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!email.trim() && !phone.trim()) {
        throw new Error("Email or phone is required.");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const normalizedPhone = phone.trim() ? maybeNormalizePhone(phone) : "";

      await roleRegisterRequest("SELLER", {
        email: email.trim() || undefined,
        phone: normalizedPhone || undefined,
        password,
        fullName,
      });
      await roleLoginRequest("SELLER", {
        identifier: email.trim() || normalizedPhone,
        password,
      });
      const user = await getSellerMeRequest();
      if (user.role !== "SELLER") {
        throw new Error("Seller account is required.");
      }
      setSession({ user });
      router.push(getRoleHome(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register seller.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <main className="px-4 py-10 sm:px-6">
        <section className="card-panel mx-auto max-w-xl rounded-[2rem] px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Seller account</p>
          <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
            Become a seller
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Create a seller account with email/password or phone/password. Seller access goes through onboarding and admin approval.
          </p>

          <div className="mt-6 grid gap-4">
            <Field label="Owner name">
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="public-input" data-testid="seller-register-name" />
            </Field>
            <Field label="Email">
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="public-input" placeholder="name@example.com" data-testid="seller-register-email" />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="public-input" placeholder="+7XXXXXXXXXX" data-testid="seller-register-phone" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="public-input" autoComplete="new-password" data-testid="seller-register-password" />
            </Field>
            <Field label="Confirm password">
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="public-input" autoComplete="new-password" data-testid="seller-register-confirm-password" />
            </Field>
            {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="public-button-primary px-5 py-3 text-sm disabled:opacity-60" data-testid="seller-register-submit">
              {loading ? "Creating seller account..." : "Create seller account"}
            </button>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/seller/login" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                Already have a seller account?
              </Link>
              <Link href="/customer/register" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                Register as customer instead
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
