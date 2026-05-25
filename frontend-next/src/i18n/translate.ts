import type { Locale } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import ru from "@/i18n/dictionaries/ru.json";
import vi from "@/i18n/dictionaries/vi.json";

const dictionaries = { en, ru, vi } as const;

type DictionaryTree = typeof en;

function getByPath(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

export function translate(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>,
) {
  const dictionary = dictionaries[locale] as DictionaryTree;
  const raw = getByPath(dictionary, key) ?? getByPath(dictionaries.en, key);
  return typeof raw === "string" ? interpolate(raw, values) : key;
}
