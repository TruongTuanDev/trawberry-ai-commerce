"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getRoleHome } from "@/lib/auth-redirect";
import { toast } from "@/components/ui/use-toast";
import { useI18n } from "@/i18n/use-i18n";
import { type AuthRoleKey, useAuthStore } from "@/stores/auth-store";

type ProtectedShellProps = {
  children: React.ReactNode;
  role: AuthRoleKey;
  allowedRoles?: string[];
  loginPath?: string;
  redirectByRole?: Partial<Record<string, string>>;
};

export function ProtectedShell({
  children,
  role,
  allowedRoles,
  loginPath = "/seller-login",
  redirectByRole = {},
}: ProtectedShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) =>
    role === "admin"
      ? state.adminUser
      : role === "seller"
        ? state.sellerUser
        : state.customerUser,
  );
  const hydrated = useAuthStore((state) => state.hydrated);
  const sessionLoading = useAuthStore((state) => state.sessionLoading[role]);
  const sessionError = useAuthStore((state) => state.sessionError[role]);
  const refreshRole = useAuthStore((state) => state.refreshRole);
  const [sessionChecked, setSessionChecked] = useState(false);
  const lastToastErrorRef = useRef<string | null>(null);
  const { t } = useI18n(role);
  const roleLabel = t(`common.roles.${role}`);
  const roleAllowed = user
    ? !allowedRoles?.length || allowedRoles.includes(user.role)
    : false;

  useEffect(() => {
    if (!hydrated || sessionChecked) {
      return;
    }

    void refreshRole(role).then((authenticated) => {
      setSessionChecked(true);
      if (!authenticated) {
        router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
      }
    });
  }, [hydrated, loginPath, pathname, refreshRole, role, router, sessionChecked]);

  useEffect(() => {
    if (!sessionError) {
      lastToastErrorRef.current = null;
      return;
    }

    if (sessionError !== lastToastErrorRef.current) {
      toast.error(sessionError);
      lastToastErrorRef.current = sessionError;
    }
  }, [sessionError]);

  useEffect(() => {
    if (!hydrated || sessionLoading || !sessionChecked) {
      return;
    }

    if (!user) {
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      const redirectTarget = redirectByRole[user.role] ?? getRoleHome(user);
      router.replace(redirectTarget);
    }
  }, [
    allowedRoles,
    hydrated,
    loginPath,
    pathname,
    redirectByRole,
    router,
    sessionChecked,
    sessionLoading,
    user,
  ]);

  if (!hydrated || !user || !roleAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel max-w-md rounded-[1.5rem] px-8 py-6 text-center">
          <p className="text-sm text-[var(--muted)]">
            {!hydrated || sessionLoading
              ? t("common.restoringSession", { role: roleLabel })
              : t("common.redirectingToLogin")}
          </p>
          {sessionError ? (
            <p className="mt-3 text-sm text-[var(--accent-strong)]">
              {sessionError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
