const CATEGORY_DEFINITIONS = [
  {
    slug: 'tops',
    aliases: [
      'top',
      'tops',
      'shirt',
      'shirts',
      'tshirt',
      't-shirt',
      't-shirts',
      'футболка',
      'рубашка',
    ],
  },
  {
    slug: 'pants',
    aliases: ['pants', 'trousers', 'брюки'],
  },
  {
    slug: 'jeans',
    aliases: ['jeans', 'denim', 'джинсы'],
  },
  {
    slug: 'shorts',
    aliases: ['short', 'shorts', 'шорты'],
  },
  {
    slug: 'bermuda',
    aliases: ['bermuda', 'bermudas', 'бермуды'],
  },
  {
    slug: 'dresses',
    aliases: ['dress', 'dresses', 'платье', 'платья'],
  },
  {
    slug: 'skirts',
    aliases: ['skirt', 'skirts', 'юбка', 'юбки'],
  },
  {
    slug: 'jackets',
    aliases: ['jacket', 'jackets', 'coat', 'outerwear', 'куртка', 'куртки'],
  },
  {
    slug: 'hoodies',
    aliases: ['hoodie', 'hoodies', 'sweatshirt', 'худи', 'свитшот'],
  },
  {
    slug: 'shoes',
    aliases: ['shoes', 'footwear', 'обувь'],
  },
  {
    slug: 'bags',
    aliases: ['bag', 'bags', 'сумка', 'сумки'],
  },
  {
    slug: 'accessories',
    aliases: ['accessory', 'accessories', 'аксессуары'],
  },
] as const;

const aliasToSlug = new Map<string, string>();
for (const category of CATEGORY_DEFINITIONS) {
  aliasToSlug.set(category.slug, category.slug);
  for (const alias of category.aliases) {
    aliasToSlug.set(alias, category.slug);
  }
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_/(),]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeToken(value: string) {
  return normalizeText(value).replace(/\s/g, ' ');
}

function resolveCanonicalSlug(value: string) {
  const normalized = normalizeToken(value);
  return aliasToSlug.get(normalized) ?? null;
}

function hasAliasMatch(normalizedText: string, alias: string) {
  const normalizedAlias = normalizeToken(alias);
  return ` ${normalizedText} `.includes(` ${normalizedAlias} `);
}

export function normalizeSupportedCategoryValues(values: string[]) {
  const normalized = new Set<string>();

  for (const rawValue of values) {
    const canonical = resolveCanonicalSlug(rawValue);
    if (canonical) {
      normalized.add(canonical);
      continue;
    }

    const fallback = normalizeToken(rawValue);
    if (fallback) {
      normalized.add(fallback);
    }
  }

  return [...normalized];
}

export function readSupportedCategoryValues(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeSupportedCategoryValues(
      value.filter((item): item is string => typeof item === 'string'),
    );
  }

  if (typeof value === 'string') {
    return normalizeSupportedCategoryValues(value.split(','));
  }

  return [];
}

export function resolveProductCategorySlugs(
  values: Array<string | null | undefined>,
) {
  const matches = new Set<string>();

  for (const rawValue of values) {
    if (!rawValue?.trim()) {
      continue;
    }

    const canonical = resolveCanonicalSlug(rawValue);
    if (canonical) {
      matches.add(canonical);
    }

    const normalizedText = normalizeText(rawValue);
    for (const category of CATEGORY_DEFINITIONS) {
      if (
        hasAliasMatch(normalizedText, category.slug) ||
        category.aliases.some((alias: string) =>
          hasAliasMatch(normalizedText, alias),
        )
      ) {
        matches.add(category.slug);
      }
    }
  }

  return [...matches];
}
