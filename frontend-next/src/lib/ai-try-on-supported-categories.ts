export type SupportedTryOnCategory = {
  slug: string;
  recommended: boolean;
  aliases: string[];
  labelKey: string;
};

export const SUPPORTED_TRY_ON_CATEGORIES: SupportedTryOnCategory[] = [
  {
    slug: "tops",
    recommended: true,
    aliases: ["top", "tops", "shirt", "shirts", "tshirt", "t-shirts", "t-shirt", "футболка", "рубашка"],
    labelKey: "adminAiSettings.categories.tops",
  },
  {
    slug: "pants",
    recommended: true,
    aliases: ["pants", "trousers", "брюки"],
    labelKey: "adminAiSettings.categories.pants",
  },
  {
    slug: "jeans",
    recommended: true,
    aliases: ["jeans", "denim", "джинсы"],
    labelKey: "adminAiSettings.categories.jeans",
  },
  {
    slug: "shorts",
    recommended: true,
    aliases: ["short", "shorts", "шорты"],
    labelKey: "adminAiSettings.categories.shorts",
  },
  {
    slug: "bermuda",
    recommended: true,
    aliases: ["bermuda", "bermudas", "бермуды"],
    labelKey: "adminAiSettings.categories.bermuda",
  },
  {
    slug: "dresses",
    recommended: true,
    aliases: ["dress", "dresses", "платье", "платья"],
    labelKey: "adminAiSettings.categories.dresses",
  },
  {
    slug: "skirts",
    recommended: true,
    aliases: ["skirt", "skirts", "юбка", "юбки"],
    labelKey: "adminAiSettings.categories.skirts",
  },
  {
    slug: "jackets",
    recommended: true,
    aliases: ["jacket", "jackets", "coat", "outerwear", "куртка", "куртки"],
    labelKey: "adminAiSettings.categories.jackets",
  },
  {
    slug: "hoodies",
    recommended: true,
    aliases: ["hoodie", "hoodies", "sweatshirt", "худи", "свитшот"],
    labelKey: "adminAiSettings.categories.hoodies",
  },
  {
    slug: "shoes",
    recommended: false,
    aliases: ["shoes", "footwear", "обувь"],
    labelKey: "adminAiSettings.categories.shoes",
  },
  {
    slug: "bags",
    recommended: false,
    aliases: ["bag", "bags", "сумка", "сумки"],
    labelKey: "adminAiSettings.categories.bags",
  },
  {
    slug: "accessories",
    recommended: false,
    aliases: ["accessory", "accessories", "аксессуары"],
    labelKey: "adminAiSettings.categories.accessories",
  },
];

export const RECOMMENDED_TRY_ON_CATEGORY_SLUGS = SUPPORTED_TRY_ON_CATEGORIES
  .filter((category) => category.recommended)
  .map((category) => category.slug);

const aliasToSlug = new Map<string, string>();
for (const category of SUPPORTED_TRY_ON_CATEGORIES) {
  aliasToSlug.set(category.slug, category.slug);
  for (const alias of category.aliases) {
    aliasToSlug.set(alias, category.slug);
  }
}

function normalizeCategoryToken(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeTryOnCategorySlugs(values: string[]) {
  const known = new Set<string>();
  const unknown = new Set<string>();

  for (const rawValue of values) {
    const value = normalizeCategoryToken(rawValue);
    if (!value) {
      continue;
    }

    const canonical = aliasToSlug.get(value);
    if (canonical) {
      known.add(canonical);
    } else {
      unknown.add(value);
    }
  }

  return {
    known: [...known],
    unknown: [...unknown],
  };
}

export function parseSupportedCategoryValues(values: string[]) {
  return normalizeTryOnCategorySlugs(
    values.flatMap((value) => value.split(",").map((entry) => entry.trim())),
  );
}
