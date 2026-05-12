import { ProtectedShell } from "@/components/auth/protected-shell";
import { SellerShell } from "@/components/seller/seller-shell";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedShell>
      <SellerShell>{children}</SellerShell>
    </ProtectedShell>
  );
}
