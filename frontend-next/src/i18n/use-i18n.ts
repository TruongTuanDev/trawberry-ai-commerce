"use client";

import { useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/i18n/locale-store";
import {
  type Locale,
  type LocaleRole,
  getSupportedLocalesForRole,
  isLocaleSupportedForRole,
  normalizeLocale,
  resolveRoleLocale,
} from "@/i18n/config";
import { translate } from "@/i18n/translate";

export function useI18n(role: LocaleRole) {
  const localesHydrated = useLocaleStore((state) => state.hydrated);
  const hydrateLocales = useLocaleStore((state) => state.hydrateFromStorage);
  const roleLocale = useLocaleStore((state) => state.roleLocales[role]);
  const cookieLocale = useLocaleStore((state) => state.cookieLocale);
  const setRoleLocale = useLocaleStore((state) => state.setRoleLocale);
  const preferredLocale = useAuthStore((state) =>
    role === "admin"
      ? state.adminUser?.preferredLocale ?? null
      : role === "seller"
        ? state.sellerUser?.preferredLocale ?? null
        : state.customerUser?.preferredLocale ?? null,
  );

  useEffect(() => {
    hydrateLocales();
  }, [hydrateLocales]);

  useEffect(() => {
    if (!localesHydrated) {
      return;
    }

    const normalizedPreferredLocale = normalizeLocale(preferredLocale);
    if (
      normalizedPreferredLocale &&
      isLocaleSupportedForRole(role, normalizedPreferredLocale) &&
      normalizedPreferredLocale !== roleLocale
    ) {
      setRoleLocale(role, normalizedPreferredLocale);
      return;
    }

    if (isLocaleSupportedForRole(role, roleLocale)) {
      return;
    }

    const resolved = resolveRoleLocale(role, {
      preferredLocale: normalizedPreferredLocale,
      cookieLocale,
      browserLocale:
        typeof navigator !== "undefined"
          ? navigator.languages?.[0] ?? navigator.language
          : null,
    });

    if (resolved !== roleLocale) {
      setRoleLocale(role, resolved);
    }
  }, [
    cookieLocale,
    localesHydrated,
    preferredLocale,
    role,
    roleLocale,
    setRoleLocale,
  ]);

  const locale = roleLocale;
  const supportedLocales = getSupportedLocalesForRole(role);

  const api = useMemo(
    () => ({
      locale,
      supportedLocales,
      setLocale: (nextLocale: Locale) => setRoleLocale(role, nextLocale),
      t: (key: string, values?: Record<string, string | number>) =>
        translate(locale, key, values),
    }),
    [locale, role, setRoleLocale, supportedLocales],
  );

  return api;
}
