const CATEGORY_DEFINITIONS = [
  {
    canonical: 'tops',
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
    canonical: 'pants',
    aliases: ['pants', 'trousers', 'брюки'],
  },
  {
    canonical: 'jeans',
    aliases: ['jeans', 'denim', 'джинсы'],
  },
  {
    canonical: 'shorts',
    aliases: ['short', 'shorts', 'шорты'],
  },
  {
    canonical: 'bermuda',
    aliases: ['bermuda', 'bermudas', 'бермуды'],
  },
  {
    canonical: 'dresses',
    aliases: ['dress', 'dresses', 'платье', 'платья'],
  },
  {
    canonical: 'skirts',
    aliases: ['skirt', 'skirts', 'юбка', 'юбки'],
  },
  {
    canonical: 'jackets',
    aliases: ['jacket', 'jackets', 'coat', 'outerwear', 'куртка', 'куртки'],
  },
  {
    canonical: 'hoodies',
    aliases: ['hoodie', 'hoodies', 'sweatshirt', 'худи', 'свитшот'],
  },
  {
    canonical: 'shoes',
    aliases: ['shoes', 'footwear', 'обувь'],
  },
  {
    canonical: 'bags',
    aliases: ['bag', 'bags', 'сумка', 'сумки'],
  },
  {
    canonical: 'accessories',
    aliases: ['accessory', 'accessories', 'аксессуары'],
  },
] as const;

const aliasToCanonical = new Map<string, string>();
for (const category of CATEGORY_DEFINITIONS) {
  aliasToCanonical.set(category.canonical, category.canonical);
  for (const alias of category.aliases) {
    aliasToCanonical.set(alias, category.canonical);
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[-_/(),]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function hasAliasMatch(normalizedText: string, alias: string) {
  const normalizedAlias = normalizeText(alias);
  return ` ${normalizedText} `.includes(` ${normalizedAlias} `);
}

export function resolveCanonicalCategories(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  const exact = aliasToCanonical.get(normalized);
  if (exact) {
    return [exact];
  }

  const matches = new Set<string>();
  for (const category of CATEGORY_DEFINITIONS) {
    if (
      hasAliasMatch(normalized, category.canonical) ||
      category.aliases.some((alias: string) => hasAliasMatch(normalized, alias))
    ) {
      matches.add(category.canonical);
    }
  }

  return [...matches];
}

export function resolveCanonicalCategory(value: string | null | undefined) {
  return resolveCanonicalCategories(value)[0] ?? null;
}

export function readSupportedCategoryValues(value: unknown) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  if (typeof value === 'string') {
    return [
      ...new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  return [];
}

export function normalizeStoredSupportedCategoryValues(values: string[]) {
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export function matchesSupportedCategoryValue(
  supportedValues: string[],
  product: {
    categoryId?: string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
    fallbackCategoryNames?: Array<string | null | undefined>;
  },
) {
  if (supportedValues.length === 0) {
    return true;
  }

  const exactTokens = new Set(
    supportedValues.map((value) => normalizeText(value)).filter(Boolean),
  );
  const canonicalTokens = new Set(
    supportedValues
      .map((value) => resolveCanonicalCategory(value))
      .filter((value): value is string => Boolean(value)),
  );

  if (
    product.categoryId &&
    exactTokens.has(normalizeText(product.categoryId))
  ) {
    return true;
  }

  const candidates = [
    product.categoryName,
    product.categorySlug,
    ...(product.fallbackCategoryNames ?? []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (exactTokens.has(candidate)) {
      return true;
    }
  }

  for (const candidate of [
    product.categoryName,
    product.categorySlug,
    ...(product.fallbackCategoryNames ?? []),
  ]) {
    const canonicals = resolveCanonicalCategories(candidate);
    if (canonicals.some((canonical) => canonicalTokens.has(canonical))) {
      return true;
    }
  }

  return false;
}
