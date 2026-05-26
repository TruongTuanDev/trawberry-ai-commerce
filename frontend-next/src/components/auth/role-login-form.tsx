"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/i18n/use-i18n";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import {
  getAdminMeRequest,
  getAuthErrorMessage,
  getCustomerMeRequest,
  getSellerMeRequest,
  loginRequest,
  roleLoginRequest,
  type StaffRole,
} from "@/lib/auth-api";
import { getRoleHome } from "@/lib/auth-redirect";
import { maybeNormalizePhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/auth-store";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type RoleLoginFormProps = {
  role?: "seller" | "customer" | "admin";
  roleLabel: string;
  badgeLabel: string;
  title: string;
  description?: string;
  expectedRoles: StaffRole[];
  submitRole?: StaffRole;
  defaultRedirect: string;
  redirectByRole?: Partial<Record<StaffRole, string>>;
  secondaryLinkHref?: string;
  secondaryLinkLabel?: string;
  footerLinks?: Array<{ href: string; label: string }>;
  testIdPrefix: "admin-login" | "seller-login" | "customer-login" | "login";
};

async function loadRoleUser(
  submitRole: StaffRole | undefined,
  expectedRoles: StaffRole[],
) {
  if (submitRole === "ADMIN") {
    return getAdminMeRequest();
  }
  if (submitRole === "SELLER") {
    return getSellerMeRequest();
  }
  if (submitRole === "CUSTOMER") {
    return getCustomerMeRequest();
  }
  if (expectedRoles.includes("ADMIN")) {
    try {
      return await getAdminMeRequest();
    } catch {
      return getSellerMeRequest();
    }
  }
  return getCustomerMeRequest();
}

export function RoleLoginForm({
  role,
  roleLabel,
  badgeLabel,
  title,
  description,
  expectedRoles,
  submitRole,
  defaultRedirect,
  redirectByRole,
  secondaryLinkHref,
  secondaryLinkLabel,
  footerLinks,
  testIdPrefix,
}: RoleLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { t } = useI18n("seller");

  const dynamicLoginSchema = useMemo(() => {
    if (role === "seller") {
      return z.object({
        identifier: z.string().trim().min(1, t("seller.auth.emailOrPhoneRequired")),
        password: z.string().min(6, t("seller.auth.passwordLength")),
      });
    }
    return loginSchema;
  }, [role, t]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(dynamicLoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setFormError(null);

    try {
      const normalizedIdentifier = values.identifier.includes("@")
        ? values.identifier.trim()
        : maybeNormalizePhone(values.identifier);

      let authenticatedRole = submitRole;

      if (submitRole) {
        await roleLoginRequest(submitRole, {
          identifier: normalizedIdentifier,
          password: values.password,
        });
      } else {
        const response = await loginRequest({
          identifier: normalizedIdentifier,
          password: values.password,
        });
        authenticatedRole = response.role as StaffRole;
        await roleLoginRequest(authenticatedRole, {
          identifier: normalizedIdentifier,
          password: values.password,
        });
      }
      const user = await loadRoleUser(authenticatedRole, expectedRoles);

      if (!expectedRoles.includes(user.role as StaffRole)) {
        throw new Error(
          role === "seller"
            ? t("seller.auth.sellerAccountRequired")
            : `${roleLabel} account is required.`,
        );
      }

      setSession({ user });
      router.push(
        searchParams.get("next") ||
          redirectByRole?.[user.role as StaffRole] ||
          getRoleHome(user) ||
          defaultRedirect,
      );
    } catch (error) {
      if (role === "seller") {
        setFormError(getLocalizedErrorMessage({ role: "seller", error }));
      } else {
        setFormError(getAuthErrorMessage(error, "login"));
      }
    } finally {
      setLoading(false);
    }
  });

  const displayBadgeLabel = role === "seller" ? t("seller.auth.badgeLabel") : badgeLabel;
  const displayTitle = role === "seller" ? t("seller.auth.title") : title;
  const displayDescription = role === "seller" ? (t("seller.auth.description") || description) : description;

  const displayFooterLinks = useMemo(() => {
    if (role === "seller" && footerLinks) {
      return footerLinks.map((link) => {
        if (link.href === "/seller/register") {
          return { ...link, label: t("seller.register.createAccount") };
        }
        if (link.href === "/customer/login") {
          return { ...link, label: t("seller.register.customerLogin") };
        }
        return link;
      });
    }
    return footerLinks;
  }, [role, footerLinks, t]);

  return (
    <div className="mx-auto w-full max-w-md" data-testid={`${testIdPrefix}-form`}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{displayBadgeLabel}</p>
      <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
        {displayTitle}
      </h2>
      {displayDescription ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{displayDescription}</p> : null}
      {searchParams.get("registered") === "1" ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {role === "seller" ? t("seller.auth.registeredNotice") : "Tài khoản đã được tạo. Vui lòng đăng nhập."}
        </div>
      ) : null}
      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={`${testIdPrefix}-email`}>
            {role === "seller" ? t("seller.auth.emailOrPhone") : "Email or phone"}
          </label>
          <input
            id={`${testIdPrefix}-email`}
            type="text"
            autoComplete="username"
            data-testid={`${testIdPrefix}-email`}
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            placeholder={role === "seller" ? t("seller.auth.emailOrPhonePlaceholder") : "name@example.com or +7XXXXXXXXXX"}
            {...form.register("identifier")}
          />
          {form.formState.errors.identifier ? (
            <p className="mt-2 text-sm text-[var(--accent)]">{form.formState.errors.identifier.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={`${testIdPrefix}-password`}>
            {role === "seller" ? t("seller.auth.password") : "Password"}
          </label>
          <input
            id={`${testIdPrefix}-password`}
            type="password"
            autoComplete="current-password"
            data-testid={`${testIdPrefix}-password`}
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="mt-2 text-sm text-[var(--accent)]">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        {formError ? (
          <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {formError}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          data-testid={`${testIdPrefix}-submit`}
          className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? (role === "seller" ? t("seller.auth.signingIn") : "Signing in...")
            : (role === "seller" ? t("seller.auth.signIn") : "Sign in")}
        </button>
      </form>
      {displayFooterLinks?.length ? (
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
          {displayFooterLinks.map((link) => (
            <Link key={link.href} href={link.href} className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
      {secondaryLinkHref && secondaryLinkLabel ? (
        <div className="mt-8 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>{role === "seller" ? t("seller.auth.needAnotherAccount") : "Need another account area?"}</span>
          <Link href={secondaryLinkHref} className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
            {secondaryLinkLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
