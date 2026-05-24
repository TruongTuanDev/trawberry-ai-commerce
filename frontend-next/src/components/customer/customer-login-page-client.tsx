"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { getCustomerMeRequest, roleLoginRequest } from "@/lib/auth-api";
import { maybeNormalizePhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/auth-store";

export function CustomerLoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const { run, isRunning } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    await run({
      action: async () => {
        const normalizedIdentifier = identifier.includes("@")
          ? identifier.trim()
          : maybeNormalizePhone(identifier);

        await roleLoginRequest("CUSTOMER", {
          identifier: normalizedIdentifier,
          password,
        });
        const user = await getCustomerMeRequest();
        if (user.role !== "CUSTOMER") {
          throw new Error("Customer account is required.");
        }
        return user;
      },
      authMode: "login",
      successMessage: "Đăng nhập thành công",
      onSuccess: async (user) => {
        setSession({ user });
        router.push(searchParams.get("next") || "/customer/orders");
      },
      onError: (_error, message) => {
        setError(message);
      },
      errorMessage: "Thông tin đăng nhập không chính xác.",
    }).catch(() => undefined);
  };

  return (
    <PublicShell>
      <main className="px-4 py-10 sm:px-6">
        <section className="card-panel mx-auto max-w-md rounded-[2rem] px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer account</p>
          <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold">Customer login</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Sign in with the email or phone number you used when creating the account.
          </p>
          {searchParams.get("registered") === "1" ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Tài khoản đã được tạo. Vui lòng đăng nhập.
            </div>
          ) : null}
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
            {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isRunning}
              className="public-button-primary px-5 py-3 text-sm disabled:opacity-60"
              data-testid="customer-login-submit"
            >
              {isRunning ? "Đang đăng nhập..." : "Sign in"}
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
