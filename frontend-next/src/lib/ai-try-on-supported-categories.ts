import type { AdminCategoryOption } from "@/lib/admin-api";

const CATEGORY_DEFINITIONS = [
  {
    canonical: "tops",
    recommended: true,
    aliases: ["top", "tops", "shirt", "shirts", "tshirt", "t-shirts", "t-shirt", "футболка", "рубашка"],
  },
  {
    canonical: "pants",
    recommended: true,
    aliases: ["pants", "trousers", "брюки"],
  },
  {
    canonical: "jeans",
    recommended: true,
    aliases: ["jeans", "denim", "джинсы"],
  },
  {
    canonical: "shorts",
    recommended: true,
    aliases: ["short", "shorts", "шорты"],
  },
  {
    canonical: "bermuda",
    recommended: true,
    aliases: ["bermuda", "bermudas", "бермуды"],
  },
  {
    canonical: "dresses",
    recommended: true,
    aliases: ["dress", "dresses", "платье", "платья"],
  },
  {
    canonical: "skirts",
    recommended: true,
    aliases: ["skirt", "skirts", "юбка", "юбки"],
  },
  {
    canonical: "jackets",
    recommended: true,
    aliases: ["jacket", "jackets", "coat", "outerwear", "куртка", "куртки"],
  },
  {
    canonical: "hoodies",
    recommended: true,
    aliases: ["hoodie", "hoodies", "sweatshirt", "худи", "свитшот"],
  },
  {
    canonical: "shoes",
    recommended: false,
    aliases: ["shoes", "footwear", "обувь"],
  },
  {
    canonical: "bags",
    recommended: false,
    aliases: ["bag", "bags", "сумка", "сумки"],
  },
  {
    canonical: "accessories",
    recommended: false,
    aliases: ["accessory", "accessories", "аксессуары"],
  },
] as const;

const aliasToCanonical = new Map<string, string>();
for (const definition of CATEGORY_DEFINITIONS) {
  aliasToCanonical.set(definition.canonical, definition.canonical);
  for (const alias of definition.aliases) {
    aliasToCanonical.set(alias, definition.canonical);
  }
}

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[-_/(),]+/g, " ")
    .replace(/\s+/g, " ") ?? "";
}

function hasAliasMatch(normalizedText: string, alias: string) {
  const normalizedAlias = normalizeText(alias);
  return ` ${normalizedText} `.includes(` ${normalizedAlias} `);
}

export function resolveTryOnCanonicalType(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const exact = aliasToCanonical.get(normalized);
  if (exact) {
    return exact;
  }

  for (const definition of CATEGORY_DEFINITIONS) {
    if (
      hasAliasMatch(normalized, definition.canonical) ||
      definition.aliases.some((alias) => hasAliasMatch(normalized, alias))
    ) {
      return definition.canonical;
    }
  }

  return null;
}

export function parseSupportedCategoryValues(
  values: string[],
  categories: AdminCategoryOption[],
) {
  const knownIds = new Set<string>();
  const unknownValues = new Set<string>();
  const byId = new Map(categories.map((category) => [category.id, category]));
  const byName = new Map<string, string[]>();
  const byCanonical = new Map<string, string[]>();

  for (const category of categories) {
    const normalizedName = normalizeText(category.name);
    if (normalizedName) {
      byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), category.id]);
    }

    const canonical = resolveTryOnCanonicalType(category.name);
    if (canonical) {
      byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), category.id]);
    }
  }

  for (const token of values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean)) {
    if (byId.has(token)) {
      knownIds.add(token);
      continue;
    }

    const normalizedToken = normalizeText(token);
    const exactNameMatches = byName.get(normalizedToken) ?? [];
    if (exactNameMatches.length > 0) {
      exactNameMatches.forEach((id) => knownIds.add(id));
      continue;
    }

    const canonical = resolveTryOnCanonicalType(token);
    if (canonical) {
      const matchedIds = byCanonical.get(canonical) ?? [];
      if (matchedIds.length > 0) {
        matchedIds.forEach((id) => knownIds.add(id));
        continue;
      }
    }

    unknownValues.add(token);
  }

  return {
    knownIds: [...knownIds],
    unknownValues: [...unknownValues],
  };
}

export function getRecommendedCategoryIds(categories: AdminCategoryOption[]) {
  return categories
    .filter((category) => {
      const canonical = resolveTryOnCanonicalType(category.name);
      if (!canonical) {
        return false;
      }
      return CATEGORY_DEFINITIONS.find(
        (definition) => definition.canonical === canonical,
      )?.recommended;
    })
    .map((category) => category.id);
}
