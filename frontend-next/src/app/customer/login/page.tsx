import { Suspense } from "react";
import { CustomerLoginPageClient } from "@/components/customer/customer-login-page-client";
import { getRoleDefaultLocale } from "@/i18n/config";
import { translate } from "@/i18n/translate";

export default function CustomerLoginPage() {
  const fallbackLocale = getRoleDefaultLocale("customer");

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--muted)]">
          {translate(fallbackLocale, "common.loading")}
        </div>
      }
    >
      <CustomerLoginPageClient />
    </Suspense>
  );
}
