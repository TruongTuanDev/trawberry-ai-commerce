import { Suspense } from "react";
import { cookies } from "next/headers";
import { RoleLoginForm } from "@/components/auth/role-login-form";
import {
  LOCALE_COOKIE_KEY,
  getRoleDefaultLocale,
  isLocaleSupportedForRole,
  normalizeLocale,
} from "@/i18n/config";
import { translate } from "@/i18n/translate";

export default async function AdminLoginPage() {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001").replace(
    "://localhost",
    "://127.0.0.1",
  );
  const cookieStore = await cookies();
  const cookieLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const fallbackLocale =
    cookieLocale && isLocaleSupportedForRole("admin", cookieLocale)
      ? cookieLocale
      : getRoleDefaultLocale("admin");

  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_42%,#334155_100%)] px-8 py-10 text-slate-100 sm:px-12 sm:py-14">
          <p className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
            {translate(fallbackLocale, "adminLogin.badge")}
          </p>
          <h1 className="mt-6 max-w-xl font-[family-name:var(--font-mono-app)] text-5xl font-bold tracking-tight sm:text-6xl">
            {translate(fallbackLocale, "adminLogin.heroTitle")}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
            {translate(fallbackLocale, "adminLogin.heroDescription")}{" "}
            <code className="rounded bg-slate-800 px-2 py-1">{apiUrl}</code>.
          </p>
        </section>
        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <Suspense fallback={<div className="text-sm text-[var(--muted)]">{translate(fallbackLocale, "seller.auth.loadingLogin")}</div>}>
            <RoleLoginForm
              badgeLabel={translate(fallbackLocale, "adminLogin.formBadge")}
              roleLabel={translate(fallbackLocale, "adminLogin.roleLabel")}
              title={translate(fallbackLocale, "adminLogin.formTitle")}
              description={translate(fallbackLocale, "adminLogin.formDescription")}
              requiredRoleMessage={translate(fallbackLocale, "adminLogin.requiredRoleMessage")}
              expectedRoles={["ADMIN"]}
              submitRole="ADMIN"
              defaultRedirect="/admin/dashboard"
              testIdPrefix="admin-login"
            />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
