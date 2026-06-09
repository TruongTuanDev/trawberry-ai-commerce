"use client";

import { create } from "zustand";
import {
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  type Locale,
  type LocaleRole,
  getRoleDefaultLocale,
  normalizeLocale,
} from "@/i18n/config";

type RoleLocaleState = Record<LocaleRole, Locale>;

type LocaleState = {
  hydrated: boolean;
  cookieLocale: Locale | null;
  roleLocales: RoleLocaleState;
  setCookieLocale: (locale: Locale | null) => void;
  setRoleLocale: (role: LocaleRole, locale: Locale) => void;
  hydrateFromStorage: () => void;
};

const initialRoleLocales: RoleLocaleState = {
  admin: getRoleDefaultLocale("admin"),
  seller: getRoleDefaultLocale("seller"),
  customer: getRoleDefaultLocale("customer"),
};

function writeCookie(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function readCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE_KEY}=`));

  return normalizeLocale(match?.split("=")[1] ?? null);
}

export const useLocaleStore = create<LocaleState>((set) => ({
  hydrated: false,
  cookieLocale: null,
  roleLocales: initialRoleLocales,
  setCookieLocale: (locale) => {
    if (!locale) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    writeCookie(locale);
    set({ cookieLocale: locale });
  },
  setRoleLocale: (role, locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${LOCALE_STORAGE_KEY}:${role}`, locale);
    }
    writeCookie(locale);
    set((state) => ({
      cookieLocale: locale,
      roleLocales: {
        ...state.roleLocales,
        [role]: locale,
      },
    }));
  },
  hydrateFromStorage: () => {
    if (typeof window === "undefined") {
      return;
    }

    const cookieLocale = readCookie();
    const rootLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    const nextRoleLocales: RoleLocaleState = {
      admin:
        normalizeLocale(window.localStorage.getItem(`${LOCALE_STORAGE_KEY}:admin`)) ??
        rootLocale ??
        cookieLocale ??
        getRoleDefaultLocale("admin"),
      seller:
        normalizeLocale(window.localStorage.getItem(`${LOCALE_STORAGE_KEY}:seller`)) ??
        rootLocale ??
        cookieLocale ??
        getRoleDefaultLocale("seller"),
      customer:
        normalizeLocale(window.localStorage.getItem(`${LOCALE_STORAGE_KEY}:customer`)) ??
        rootLocale ??
        cookieLocale ??
        getRoleDefaultLocale("customer"),
    };

    set({
      hydrated: true,
      cookieLocale: cookieLocale ?? rootLocale,
      roleLocales: nextRoleLocales,
    });
  },
}));

export function getStoredRoleLocale(role: LocaleRole): Locale {
  return useLocaleStore.getState().roleLocales[role];
}
