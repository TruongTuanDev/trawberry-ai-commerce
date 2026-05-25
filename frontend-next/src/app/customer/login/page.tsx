import { Suspense } from "react";
import { CustomerLoginPageClient } from "@/components/customer/customer-login-page-client";

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--muted)]">...</div>}>
      <CustomerLoginPageClient />
    </Suspense>
  );
}
