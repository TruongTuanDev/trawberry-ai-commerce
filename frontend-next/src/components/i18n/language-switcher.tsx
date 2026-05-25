"use client";

import { type LocaleRole } from "@/i18n/config";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";
import { updateMyPreferredLocale } from "@/lib/auth-api";

export function LanguageSwitcher({ role }: { role: LocaleRole }) {
  const { locale, setLocale, supportedLocales, t } = useI18n(role);
  const user = useAuthStore((state) =>
    role === "admin"
      ? state.adminUser
      : role === "seller"
        ? state.sellerUser
        : state.customerUser,
  );
  const setRoleSession = useAuthStore((state) => state.setRoleSession);

  if (supportedLocales.length <= 1) {
    return null;
  }

  const persistPreference = async (nextLocale: "en" | "ru" | "vi") => {
    setLocale(nextLocale);

    if (!user) {
      return;
    }

    setRoleSession(role, {
      ...user,
      preferredLocale: nextLocale,
    });

    try {
      const updated = await updateMyPreferredLocale(nextLocale, role);
      setRoleSession(role, {
        ...user,
        preferredLocale: updated.preferredLocale,
      });
    } catch {
      // Keep the cookie-driven locale even if profile persistence fails.
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/80 px-2 py-1 text-xs font-semibold text-[var(--foreground)]"
      data-testid={`language-switcher-${role}`}
      aria-label={t("language.label")}
    >
      {supportedLocales.map((entry) => {
        const active = entry === locale;
        return (
          <button
            key={entry}
            type="button"
            onClick={() => void persistPreference(entry)}
            className={`rounded-full px-2.5 py-1 transition ${
              active
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
            }`}
            data-testid={`language-option-${role}-${entry}`}
          >
            {t(`language.${entry}`)}
          </button>
        );
      })}
    </div>
  );
}
