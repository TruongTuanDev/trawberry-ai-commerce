"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { updateMyPreferredLocale } from "@/lib/auth-api";
import {
  type Locale,
  type LocaleRole,
  getLocaleMetadata,
} from "@/i18n/config";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";

type LanguageSwitcherProps = {
  role: LocaleRole;
  compact?: boolean;
  tone?: "light" | "dark";
  className?: string;
  testId?: string;
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
      <path
        d="m5 10 3.2 3.2L15 6.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
    >
      <path
        d="m5.5 7.5 4.5 4.5 4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function LanguageSwitcher({
  role,
  compact = false,
  tone = "light",
  className = "",
  testId,
}: LanguageSwitcherProps) {
  const { locale, setLocale, supportedLocales, t } = useI18n(role);
  const user = useAuthStore((state) =>
    role === "admin"
      ? state.adminUser
      : role === "seller"
        ? state.sellerUser
        : state.customerUser,
  );
  const setRoleSession = useAuthStore((state) => state.setRoleSession);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const options = useMemo(
    () => supportedLocales.map((entry) => getLocaleMetadata(entry)),
    [supportedLocales],
  );
  const currentLocale = getLocaleMetadata(locale);
  const triggerClasses =
    tone === "dark"
      ? "border-white/16 bg-white/12 text-white hover:bg-white/18 focus-visible:ring-white/40"
      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--panel)] focus-visible:ring-[var(--accent)]/25";
  const menuClasses =
    tone === "dark"
      ? "border-white/12 bg-white text-[var(--foreground)] shadow-[0_18px_48px_rgba(20,16,34,0.24)]"
      : "border-[var(--border)] bg-white text-[var(--foreground)] shadow-[0_18px_48px_rgba(20,16,34,0.12)]";
  const activeOptionClasses =
    tone === "dark"
      ? "bg-[linear-gradient(135deg,rgba(203,17,171,0.12),rgba(122,77,255,0.08))] text-[var(--foreground)]"
      : "bg-[linear-gradient(135deg,rgba(203,17,171,0.12),rgba(122,77,255,0.08))] text-[var(--foreground)]";

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (supportedLocales.length <= 1) {
    return null;
  }

  const focusOption = (index: number) => {
    window.requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  };

  const persistPreference = async (nextLocale: Locale) => {
    setOpen(false);

    if (nextLocale === locale) {
      return;
    }

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
      ref={rootRef}
      className={`relative inline-flex ${className}`.trim()}
      data-testid={testId ?? `language-switcher-${role}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("language.label")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`language-menu-${role}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            focusOption(0);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            focusOption(options.length - 1);
          }
        }}
        className={`inline-flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 ${triggerClasses}`}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {currentLocale.flag}
        </span>
        <span className="tracking-[0.14em]">{currentLocale.shortLabel}</span>
        {!compact ? (
          <span className="hidden max-w-[9rem] truncate text-left text-xs font-medium tracking-normal opacity-80 sm:inline">
            {currentLocale.nativeLabel}
          </span>
        ) : null}
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          id={`language-menu-${role}`}
          role="menu"
          aria-label={t("language.label")}
          className={`absolute right-0 top-[calc(100%+0.65rem)] z-50 min-w-[15rem] overflow-hidden rounded-3xl border p-2 ${menuClasses}`}
        >
          <div className="space-y-1">
            {options.map((entry, index) => {
              const active = entry.code === locale;
              return (
                <button
                  key={entry.code}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => void persistPreference(entry.code)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      focusOption((index + 1) % options.length);
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      focusOption((index - 1 + options.length) % options.length);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 ${
                    active
                      ? activeOptionClasses
                      : "hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
                  }`}
                  data-testid={`language-option-${role}-${entry.code}`}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {entry.flag}
                  </span>
                  <span className="min-w-[2.2rem] text-xs font-bold tracking-[0.18em] text-[var(--muted)]">
                    {entry.shortLabel}
                  </span>
                  <span className="flex-1 font-medium">{entry.nativeLabel}</span>
                  <span
                    className={`text-[var(--foreground)] transition ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden={!active}
                  >
                    <CheckIcon />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
