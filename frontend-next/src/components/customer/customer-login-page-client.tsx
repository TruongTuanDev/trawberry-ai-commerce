"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { currentUserRequest, roleLoginRequest } from "@/lib/auth-api";
import { maybeNormalizePhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/auth-store";

export function CustomerLoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const normalizedIdentifier = identifier.includes("@")
        ? identifier.trim()
        : maybeNormalizePhone(identifier);

      await roleLoginRequest("CUSTOMER", {
        identifier: normalizedIdentifier,
        password,
      });
      const user = await currentUserRequest();
      if (user.role !== "CUSTOMER") {
        throw new Error("Customer account is required.");
      }
      setSession({ user });
      router.push(searchParams.get("next") || "/customer/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <main className="px-4 py-10 sm:px-6">
        <section className="card-panel mx-auto max-w-md rounded-[2rem] px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer account</p>
          <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Customer login</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Sign in with the email or phone number you used when creating the account.
          </p>
          <div className="mt-6 grid gap-4">
            <Field label="Email or phone">
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="public-input"
                placeholder="name@example.com or +7XXXXXXXXXX"
                autoComplete="username"
                data-testid="customer-login-email"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="public-input"
                autoComplete="current-password"
                data-testid="customer-login-password"
              />
            </Field>
            {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="public-button-primary px-5 py-3 text-sm disabled:opacity-60" data-testid="customer-login-submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/customer/register" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                Create customer account
              </Link>
              <Link href="/seller/register" className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                Become a seller
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
