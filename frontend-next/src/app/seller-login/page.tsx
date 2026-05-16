import { Suspense } from "react";
import { RoleLoginForm } from "@/components/auth/role-login-form";

export default function SellerLoginPage() {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001").replace(
    "://localhost",
    "://127.0.0.1",
  );

  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-[linear-gradient(160deg,#3c1d26_0%,#582733_46%,#8f1731_100%)] px-8 py-10 text-white sm:px-12 sm:py-14">
          <p className="inline-flex rounded-full border border-white/15 bg-white/8 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            Seller auth
          </p>
          <h1 className="mt-6 max-w-xl font-[family-name:var(--font-mono-app)] text-5xl font-bold tracking-tight sm:text-6xl">
            Log in to the seller workspace.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/75">
            This page talks to the NestJS backend at <code className="rounded bg-white/10 px-2 py-1">{apiUrl}</code>.
          </p>
        </section>
        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading login form...</div>}>
            <RoleLoginForm
              badgeLabel="Seller workspace"
              roleLabel="Seller"
              title="Seller login"
              description="Approved sellers access products, imports, orders, payments, delivery, and support."
              expectedRoles={["SELLER"]}
              defaultRedirect="/seller/dashboard"
              secondaryLinkHref="/login"
              secondaryLinkLabel="Back to staff login"
              testIdPrefix="seller-login"
            />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
