import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type CategoryMappingSource =
  | 'WILDBERRIES_EXCEL'
  | 'WILDBERRIES_API'
  | 'MANUAL';

export type CategoryMappingResult = {
  categoryId: bigint | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  sourceCategorySource: CategoryMappingSource;
  warning: {
    level: 'WARNING';
    code: 'UNMAPPED_CATEGORY';
    message: string;
  } | null;
};

const KEYWORD_TARGETS: Array<{ patterns: string[]; slug: string }> = [
  { patterns: ['джинсы', 'jeans'], slug: 'jeans' },
  { patterns: ['брюки', 'pants', 'trousers'], slug: 'pants' },
  { patterns: ['юбка', 'юбки', 'skirt', 'skirts'], slug: 'skirts' },
  { patterns: ['шорты', 'shorts'], slug: 'shorts' },
  { patterns: ['платье', 'платья', 'dress', 'dresses'], slug: 'dresses' },
  { patterns: ['рубашка', 'рубашки', 'shirt', 'shirts'], slug: 'shirts' },
  {
    patterns: ['куртка', 'куртки', 'jacket', 'jackets', 'outerwear'],
    slug: 'jackets',
  },
  {
    patterns: ['hoodie', 'hoodies', 'толстовка', 'толстовки'],
    slug: 'hoodies',
  },
  { patterns: ['set', 'sets', 'комплект', 'комплекты'], slug: 'sets' },
];

@Injectable()
export class CategoryMappingService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(value: string | null | undefined) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ');
  }

  async mapSourceCategory(
    source: CategoryMappingSource,
    sourceCategoryName: string | null | undefined,
    sourceSubjectName?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<CategoryMappingResult> {
    const db = tx ?? this.prisma;
    const normalizedCategory = this.normalize(sourceCategoryName);
    const normalizedSubject = this.normalize(sourceSubjectName);
    const original =
      sourceCategoryName?.trim() || sourceSubjectName?.trim() || null;

    if (!normalizedCategory && !normalizedSubject) {
      return this.unmapped(source, original);
    }

    const mappings = await db.categoryMapping.findMany({
      where: {
        source,
        targetCategory: { isActive: true },
      },
      include: { targetCategory: true },
    });

    const exact = mappings.find((mapping) => {
      const categoryMatches =
        this.normalize(mapping.sourceCategoryName) === normalizedCategory ||
        this.normalize(mapping.sourceCategoryName) === normalizedSubject;
      const subjectMatches =
        !mapping.sourceSubjectName ||
        this.normalize(mapping.sourceSubjectName) === normalizedSubject ||
        this.normalize(mapping.sourceSubjectName) === normalizedCategory;
      return categoryMatches && subjectMatches;
    });

    if (exact) {
      return {
        categoryId: exact.targetCategoryId,
        categoryName: exact.targetCategory.name,
        sourceCategoryName: original,
        sourceCategorySource: source,
        warning: null,
      };
    }

    const searchable = [normalizedCategory, normalizedSubject]
      .filter(Boolean)
      .join(' ');
    const keyword = KEYWORD_TARGETS.find((entry) =>
      entry.patterns.some((pattern) => searchable.includes(pattern)),
    );

    if (keyword) {
      const category = await db.category.findFirst({
        where: { slug: keyword.slug, isActive: true },
      });
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          sourceCategoryName: original,
          sourceCategorySource: source,
          warning: null,
        };
      }
    }

    return this.unmapped(source, original);
  }

  private unmapped(
    source: CategoryMappingSource,
    sourceCategoryName: string | null,
  ): CategoryMappingResult {
    return {
      categoryId: null,
      categoryName: null,
      sourceCategoryName,
      sourceCategorySource: source,
      warning: {
        level: 'WARNING',
        code: 'UNMAPPED_CATEGORY',
        message: sourceCategoryName
          ? `No marketplace category mapping for ${sourceCategoryName}.`
          : 'No source category was provided.',
      },
    };
  }
}
