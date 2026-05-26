import { Suspense } from "react";
import { cookies } from "next/headers";
import { RoleLoginForm } from "@/components/auth/role-login-form";
import { resolveRoleLocale, LOCALE_COOKIE_KEY } from "@/i18n/config";
import { translate } from "@/i18n/translate";

export default async function SellerLoginStandardPage() {
  const cookieStore = await cookies();
  const locale = resolveRoleLocale("seller", {
    cookieLocale: cookieStore.get(LOCALE_COOKIE_KEY)?.value,
  });

  const t = (key: string, values?: Record<string, string | number>) =>
    translate(locale, key, values);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001").replace(
    "://localhost",
    "://127.0.0.1",
  );

  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-[linear-gradient(160deg,#3c1d26_0%,#582733_46%,#8f1731_100%)] px-8 py-10 text-white sm:px-12 sm:py-14">
          <p className="inline-flex rounded-full border border-white/15 bg-white/8 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            {t("seller.auth.badgeLabel")}
          </p>
          <h1 className="mt-6 max-w-xl font-[family-name:var(--font-mono-app)] text-5xl font-bold tracking-tight sm:text-6xl">
            {t("seller.auth.loginTitle")}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/75">
            {t("seller.auth.loginSubtitle")}{" "}
            <code className="rounded bg-white/10 px-2 py-1">{apiUrl}</code>.
          </p>
        </section>
        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <Suspense fallback={<div className="text-sm text-[var(--muted)]">{t("seller.auth.loadingLogin")}</div>}>
            <RoleLoginForm
              role="seller"
              badgeLabel={t("seller.auth.badgeLabel")}
              roleLabel={t("seller.auth.roleLabel")}
              title={t("seller.auth.title")}
              description={t("seller.auth.description")}
              expectedRoles={["SELLER"]}
              submitRole="SELLER"
              defaultRedirect="/seller/dashboard"
              footerLinks={[
                { href: "/seller/register", label: "Create seller account" },
                { href: "/customer/login", label: "Customer login" },
              ]}
              testIdPrefix="seller-login"
            />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
