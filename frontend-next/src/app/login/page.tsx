import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-[linear-gradient(160deg,#3c1d26_0%,#582733_46%,#8f1731_100%)] px-8 py-10 text-white sm:px-12 sm:py-14">
          <p className="inline-flex rounded-full border border-white/15 bg-white/8 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            Seller auth
          </p>
          <h1 className="mt-6 max-w-xl font-[family-name:var(--font-mono-app)] text-5xl font-bold tracking-tight sm:text-6xl">
            Log in to the new seller workspace.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/75">
            This page talks to the NestJS backend at <code className="rounded bg-white/10 px-2 py-1">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}</code>.
          </p>
          <div className="mt-8 rounded-[1.5rem] border border-white/15 bg-white/7 p-5">
            <p className="text-sm font-semibold">Security note</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              The NestJS backend now issues httpOnly auth cookies. This frontend keeps only minimal user state in
              localStorage for UI hydration and restores the real session from <code className="rounded bg-white/10 px-2 py-1">/api/auth/me</code>.
            </p>
          </div>
        </section>
        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading login form...</div>}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
