import { AdminShell } from "@/components/admin/admin-shell";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const recommendationFlags = getRecommendationFlags();
  return (
    <ProtectedShell role="admin" allowedRoles={["ADMIN"]} loginPath="/admin-login">
      <AdminShell
        recommendationTuningWorkflowEnabled={
          recommendationFlags.recommendationTuningWorkflowEnabled
        }
      >
        {children}
      </AdminShell>
    </ProtectedShell>
  );
}
