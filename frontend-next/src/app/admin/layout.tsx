import { AdminShell } from "@/components/admin/admin-shell";
import { ProtectedShell } from "@/components/auth/protected-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedShell role="admin" allowedRoles={["ADMIN"]} loginPath="/admin-login">
      <AdminShell>{children}</AdminShell>
    </ProtectedShell>
  );
}
