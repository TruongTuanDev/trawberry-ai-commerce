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

const acronymMap: Record<string, string> = {
  ai: "AI",
  api: "API",
  cta: "CTA",
  en: "EN",
  id: "ID",
  openai: "OpenAI",
  otp: "OTP",
  qr: "QR",
  ru: "RU",
  sms: "SMS",
  vi: "VI",
  wb: "WB",
};

function humanizeKeySegment(segment: string) {
  const words = segment
    .replace(/\$\{.*?\}/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word, index) => {
      const normalized = word.toLowerCase();
      const acronym = acronymMap[normalized];
      if (acronym) {
        return acronym;
      }

      if (/^[A-Z0-9]+$/.test(word) && word.length > 1) {
        return word;
      }

      const lower = word.toLowerCase();
      return index === 0 ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : lower;
    })
    .join(" ");
}

function humanizeMissingKey(key: string) {
  const segments = key.split(".").filter(Boolean);
  const path = segments.length > 1 ? segments.slice(1) : segments;
  const tail = path[path.length - 1] ?? key;
  return humanizeKeySegment(tail) || key;
}

export function translate(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>,
) {
  const dictionary = dictionaries[locale] as DictionaryTree;
  const raw = getByPath(dictionary, key) ?? getByPath(dictionaries.en, key);
  const template = typeof raw === "string" ? raw : humanizeMissingKey(key);
  return interpolate(template, values);
}
