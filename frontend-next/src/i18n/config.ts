export const locales = ["en", "ru", "vi"] as const;

export type Locale = (typeof locales)[number];
export type LocaleRole = "admin" | "seller" | "customer";

export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE_KEY = "trawberry-locale";
export const LOCALE_STORAGE_KEY = "trawberry-locale";

export const roleLocalePolicy: Record<
  LocaleRole,
  {
    supported: readonly Locale[];
    defaultLocale: Locale;
  }
> = {
  admin: {
    supported: ["en"],
    defaultLocale: "en",
  },
  seller: {
    supported: ["ru", "en", "vi"],
    defaultLocale: "ru",
  },
  customer: {
    supported: ["ru", "en"],
    defaultLocale: "ru",
  },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();
  if (isLocale(lower)) {
    return lower;
  }

  const short = lower.split("-")[0];
  return isLocale(short) ? short : null;
}

export function getRoleDefaultLocale(role: LocaleRole): Locale {
  return roleLocalePolicy[role].defaultLocale;
}

export function isLocaleSupportedForRole(role: LocaleRole, locale: Locale): boolean {
  return roleLocalePolicy[role].supported.includes(locale);
}

export function getSupportedLocalesForRole(role: LocaleRole): readonly Locale[] {
  return roleLocalePolicy[role].supported;
}

export function resolveRoleLocale(
  role: LocaleRole,
  options: {
    preferredLocale?: string | null;
    cookieLocale?: string | null;
    browserLocale?: string | null;
  },
): Locale {
  const candidates = [
    normalizeLocale(options.preferredLocale),
    normalizeLocale(options.cookieLocale),
    normalizeLocale(options.browserLocale),
  ];

  for (const [index, candidate] of candidates.entries()) {
    if (index === 2) {
      continue;
    }
    if (candidate && isLocaleSupportedForRole(role, candidate)) {
      return candidate;
    }
  }

  return getRoleDefaultLocale(role);
}
