"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { currentUserRequest, loginRequest } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type RoleLoginFormProps = {
  roleLabel: string;
  badgeLabel: string;
  title: string;
  description?: string;
  expectedRoles: Array<"ADMIN" | "SELLER" | "CUSTOMER">;
  defaultRedirect: string;
  redirectByRole?: Partial<Record<"ADMIN" | "SELLER" | "CUSTOMER", string>>;
  secondaryLinkHref?: string;
  secondaryLinkLabel?: string;
  testIdPrefix: "admin-login" | "seller-login" | "customer-login" | "login";
};

export function RoleLoginForm({
  roleLabel,
  badgeLabel,
  title,
  description,
  expectedRoles,
  defaultRedirect,
  redirectByRole,
  secondaryLinkHref,
  secondaryLinkLabel,
  testIdPrefix,
}: RoleLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setFormError(null);

    try {
      await loginRequest(values);
      const user = await currentUserRequest();

      if (!expectedRoles.includes(user.role as "ADMIN" | "SELLER" | "CUSTOMER")) {
        throw new Error(`${roleLabel} account is required.`);
      }

      setSession({ user });
      router.push(
        searchParams.get("next") ||
          redirectByRole?.[user.role as "ADMIN" | "SELLER" | "CUSTOMER"] ||
          defaultRedirect,
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="mx-auto w-full max-w-md" data-testid={`${testIdPrefix}-form`}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{badgeLabel}</p>
      <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
        {title}
      </h2>
      {description ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={`${testIdPrefix}-email`}>
            Email
          </label>
          <input
            id={`${testIdPrefix}-email`}
            type="email"
            data-testid={`${testIdPrefix}-email`}
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="mt-2 text-sm text-[var(--accent)]">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={`${testIdPrefix}-password`}>
            Password
          </label>
          <input
            id={`${testIdPrefix}-password`}
            type="password"
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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {secondaryLinkHref && secondaryLinkLabel ? (
        <div className="mt-8 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>Need another account area?</span>
          <Link href={secondaryLinkHref} className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
            {secondaryLinkLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
