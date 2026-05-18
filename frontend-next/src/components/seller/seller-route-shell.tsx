"use client";

import { usePathname } from "next/navigation";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { SellerShell } from "@/components/seller/seller-shell";

export function SellerRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/seller/login" || pathname === "/seller/register") {
    return <>{children}</>;
  }

  return (
    <ProtectedShell role="seller" allowedRoles={["SELLER"]} loginPath="/seller-login">
      <SellerShell>{children}</SellerShell>
    </ProtectedShell>
  );
}
