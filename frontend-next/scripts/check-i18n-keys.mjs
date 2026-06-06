import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const frontendRoot = repoRoot;
const sourceRoot = path.join(frontendRoot, "src");
const dictionariesRoot = path.join(sourceRoot, "i18n", "dictionaries");

const localeFiles = {
  en: path.join(dictionariesRoot, "en.json"),
  ru: path.join(dictionariesRoot, "ru.json"),
  vi: path.join(dictionariesRoot, "vi.json"),
};

const SOURCE_PATTERNS = [/\bt\(\s*["'`]([^"'`]+)["'`]/g, /translate\(\s*[^,]+,\s*["'`]([^"'`]+)["'`]/g];
const WRITE_EN = process.argv.includes("--write-en");
const FAIL_ON_LOCALE_GAPS = process.argv.includes("--strict-locales");

const GENERIC_DIRS = new Set(["node_modules", ".next", ".git"]);
const ROLE_GROUPS = {
  seller: ["seller."],
  admin: ["admin", "adminShell.", "adminUsers."],
  customer: ["customer.", "public.", "catalog.", "home.", "recommendations."],
};
const ACRONYM_MAP = {
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

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (GENERIC_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadDictionary(locale) {
  return JSON.parse(fs.readFileSync(localeFiles[locale], "utf8"));
}

function getByPath(source, key) {
  return key.split(".").reduce((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return current[segment];
  }, source);
}

function setByPath(target, key, value) {
  const segments = key.split(".");
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    if (!cursor[segment] || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = value;
}

function humanizeSegment(segment) {
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
      if (ACRONYM_MAP[normalized]) {
        return ACRONYM_MAP[normalized];
      }

      if (/^[A-Z0-9]+$/.test(word) && word.length > 1) {
        return word;
      }

      const lower = normalized;
      return index === 0 ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : lower;
    })
    .join(" ");
}

function humanizeKey(key) {
  const segments = key.split(".").filter(Boolean);
  const pathSegments = segments.length > 1 ? segments.slice(1) : segments;
  const tail = pathSegments.at(-1) ?? key;
  return humanizeSegment(tail) || key;
}

function collectUsedKeys() {
  const files = walk(sourceRoot);
  const keys = new Map();

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of SOURCE_PATTERNS) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const key = match[1];
        if (!key.includes(".") || key.includes("${")) {
          continue;
        }

        const relativeFile = path.relative(frontendRoot, file).replaceAll("\\", "/");
        if (!keys.has(key)) {
          keys.set(key, new Set());
        }
        keys.get(key).add(relativeFile);
      }
    }
  }

  return [...keys.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, files]) => ({ key, files: [...files] }));
}

function getRoleGroup(key) {
  for (const [group, prefixes] of Object.entries(ROLE_GROUPS)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      return group;
    }
  }
  return "common";
}

const dictionaries = {
  en: loadDictionary("en"),
  ru: loadDictionary("ru"),
  vi: loadDictionary("vi"),
};

const usedKeys = collectUsedKeys();

if (WRITE_EN) {
  let additions = 0;
  for (const { key } of usedKeys) {
    if (getByPath(dictionaries.en, key) !== undefined) {
      continue;
    }

    setByPath(dictionaries.en, key, humanizeKey(key));
    additions += 1;
  }

  if (additions > 0) {
    fs.writeFileSync(localeFiles.en, `${JSON.stringify(dictionaries.en, null, 2)}\n`);
    console.log(`Backfilled ${additions} missing English keys.`);
  } else {
    console.log("English dictionary already covered all used keys.");
  }
}

const audit = usedKeys.map(({ key, files }) => {
  const missing = Object.entries(dictionaries)
    .filter(([, dictionary]) => getByPath(dictionary, key) === undefined)
    .map(([locale]) => locale);
  return { key, files, missing, group: getRoleGroup(key) };
});

const missingEnglish = audit.filter((entry) => entry.missing.includes("en"));
const localeGaps = audit.filter(
  (entry) => !entry.missing.includes("en") && entry.missing.length > 0,
);

console.log(`Used i18n keys: ${usedKeys.length}`);
console.log(`Missing English base keys: ${missingEnglish.length}`);
console.log(`Locale fallback gaps: ${localeGaps.length}`);

for (const group of ["seller", "admin", "customer", "common"]) {
  const total = audit.filter((entry) => entry.group === group).length;
  const baseMissing = missingEnglish.filter((entry) => entry.group === group).length;
  const localeMissing = localeGaps.filter((entry) => entry.group === group).length;
  console.log(`- ${group}: total=${total}, missing-en=${baseMissing}, missing-locale=${localeMissing}`);
}

function printSample(title, entries) {
  if (entries.length === 0) {
    return;
  }

  console.log(`\n${title}`);
  for (const entry of entries.slice(0, 20)) {
    console.log(`- ${entry.key} :: missing=${entry.missing.join(",")} :: ${entry.files[0]}`);
  }
}

printSample("Sample missing English keys", missingEnglish);
printSample("Sample locale fallback gaps", localeGaps);

if (missingEnglish.length > 0 || (FAIL_ON_LOCALE_GAPS && localeGaps.length > 0)) {
  process.exit(1);
}
