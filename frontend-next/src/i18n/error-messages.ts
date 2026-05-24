import { ApiError } from "@/lib/api";
import { type LocaleRole, type Locale } from "@/i18n/config";
import { getStoredRoleLocale } from "@/i18n/locale-store";
import { translate } from "@/i18n/use-i18n";

function normalizeErrorCode(error: unknown) {
  if (error instanceof ApiError && error.code) {
    return error.code;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return null;
}

export function getLocalizedErrorMessage(options: {
  role: LocaleRole;
  error: unknown;
  locale?: Locale;
  fallbackKey?: string;
}) {
  const locale = options.locale ?? getStoredRoleLocale(options.role);
  const code = normalizeErrorCode(options.error);

  if (code) {
    const translated = translate(locale, `errors.${code}`);
    if (translated !== `errors.${code}`) {
      return translated;
    }
  }

  if (options.error instanceof ApiError) {
    if (options.error.status === 401) {
      return translate(locale, "errors.unauthorized");
    }
    if (options.error.status === 403) {
      return translate(locale, "errors.forbidden");
    }
    if (options.error.status === 409) {
      return translate(locale, "errors.conflict");
    }
    if (options.error.status === 429) {
      return translate(locale, "errors.rateLimited");
    }
    if (options.error.status >= 500) {
      return translate(locale, "errors.system");
    }
  }

  return translate(locale, options.fallbackKey ?? "errors.default");
}
