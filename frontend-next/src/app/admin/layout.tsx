import { AdminShell } from "@/components/admin/admin-shell";
import { ProtectedShell } from "@/components/auth/protected-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedShell>
      <AdminShell>{children}</AdminShell>
    </ProtectedShell>
  );
}
