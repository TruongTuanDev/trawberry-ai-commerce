"use client";

import { useEffect } from "react";
import { type Locale } from "@/i18n/config";
import { useLocaleStore } from "@/i18n/locale-store";

export function I18nBootstrap({
  initialLocale,
}: {
  initialLocale: Locale | null;
}) {
  const hydrateFromStorage = useLocaleStore((state) => state.hydrateFromStorage);
  const setCookieLocale = useLocaleStore((state) => state.setCookieLocale);

  useEffect(() => {
    hydrateFromStorage();
    if (initialLocale) {
      setCookieLocale(initialLocale);
    }
  }, [hydrateFromStorage, initialLocale, setCookieLocale]);

  return null;
}
