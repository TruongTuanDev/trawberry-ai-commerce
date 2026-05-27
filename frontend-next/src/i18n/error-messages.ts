import { ApiError } from "@/lib/api";
import { type LocaleRole, type Locale } from "@/i18n/config";
import { getStoredRoleLocale } from "@/i18n/locale-store";
import { translate } from "@/i18n/translate";

type ErrorAuthMode = "login" | "register" | "session";

const technicalMessagePatterns = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "cannot post",
  "cannot get",
  "internal server error",
  "not found",
  "/api/api",
  "localhost",
  "127.0.0.1",
  "103.245.237.160",
];

function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message.trim();
  }

  if (error instanceof Error) {
    return error.message.trim();
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message.trim();
  }

  return "";
}

function mapRawMessageToCode(message: string, authMode?: ErrorAuthMode) {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    technicalMessagePatterns.some((pattern) => normalized.includes(pattern))
  ) {
    return normalized.includes("not found") ? "NOT_FOUND" : "NETWORK_ERROR";
  }

  if (
    normalized === "email_already_exists" ||
    normalized === "email is already registered."
  ) {
    return "EMAIL_ALREADY_EXISTS";
  }

  if (
    normalized === "phone_already_exists" ||
    normalized === "phone is already registered."
  ) {
    return "PHONE_ALREADY_EXISTS";
  }

  if (
    normalized === "refresh_token_expired" ||
    normalized === "refresh_token_invalid"
  ) {
    return normalized.toUpperCase();
  }

  if (
    normalized === "invalid credentials." ||
    normalized === "invalid credentials" ||
    normalized === "user account is not active."
  ) {
    return "INVALID_CREDENTIALS";
  }

  if (normalized === "invalid session for requested role.") {
    return authMode === "session"
      ? "REFRESH_TOKEN_EXPIRED"
      : "INVALID_CREDENTIALS";
  }

  if (normalized === "email or phone is required.") {
    return "EMAIL_OR_PHONE_REQUIRED";
  }

  if (normalized === "phone is required.") {
    return "PHONE_REQUIRED";
  }

  if (normalized === "phone format is invalid.") {
    return "PHONE_INVALID";
  }

  if (normalized === "email must be an email") {
    return "EMAIL_INVALID";
  }

  if (
    normalized.includes("password must be longer than or equal to") ||
    normalized.includes("password must be at least")
  ) {
    return "PASSWORD_TOO_SHORT";
  }

  if (normalized.includes("email should not be empty")) {
    return "EMAIL_OR_PHONE_REQUIRED";
  }

  return null;
}

function normalizeErrorCode(error: unknown, authMode?: ErrorAuthMode) {
  if (error instanceof ApiError && error.code) {
    return error.code;
  }

  const message = toErrorMessage(error);
  return mapRawMessageToCode(message, authMode) ?? (message || null);
}

export function getLocalizedErrorMessage(options: {
  role: LocaleRole;
  error: unknown;
  locale?: Locale;
  fallbackKey?: string;
  authMode?: ErrorAuthMode;
}) {
  const locale = options.locale ?? getStoredRoleLocale(options.role);
  const code = normalizeErrorCode(options.error, options.authMode);
  const rawMessage = toErrorMessage(options.error);
  const normalizedRawCode = rawMessage
    ? mapRawMessageToCode(rawMessage, options.authMode)
    : null;

  if (code) {
    const translated = translate(locale, `errors.${code}`);
    if (translated !== `errors.${code}`) {
      return translated;
    }
  }

  if (!(options.error instanceof ApiError) && rawMessage && !normalizedRawCode) {
    return rawMessage;
  }

  if (options.error instanceof ApiError) {
    if (options.error.status === 401) {
      if (options.authMode === "login") {
        return translate(locale, "errors.INVALID_CREDENTIALS");
      }
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

  if (options.authMode === "session") {
    return translate(locale, "errors.unauthorized");
  }

  if (options.authMode === "login") {
    return translate(locale, "errors.INVALID_CREDENTIALS");
  }

  return translate(locale, options.fallbackKey ?? "errors.default");
}
