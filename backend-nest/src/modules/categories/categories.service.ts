import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AdminCategorySelectorItem = {
  id: string;
  name: string;
  slug: string | null;
  productCount: number;
};

type CategoryRecord = {
  id: bigint;
  name: string;
  slug: string | null;
};

export type CategoryLookupRecord = {
  id: string;
  name: string;
  slug: string | null;
};

export type LinkProductsToExistingCategoriesResult = {
  scannedProducts: number;
  linkedProducts: number;
  dryRun: boolean;
  unmatchedProducts: number;
  unmatchedCategoryNames: string[];
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return this.toTree(categories);
  }

  async adminListMappings() {
    return this.prisma.categoryMapping.findMany({
      include: { targetCategory: true },
      orderBy: [{ source: 'asc' }, { sourceCategoryName: 'asc' }],
    });
  }

  async adminListCategories() {
    const categories = await this.prisma.category.findMany({
      where: {
        products: {
          some: {},
        },
      },
      orderBy: [{ name: 'asc' }],
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return categories.map<AdminCategorySelectorItem>((category) => ({
      id: category.id.toString(),
      name: category.name,
      slug: category.slug,
      productCount: category._count.products,
    }));
  }

  normalizeCategoryName(value: string | null | undefined) {
    return value?.replace(/\s+/g, ' ').trim() || null;
  }

  async listCategoryLookupRecords(tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const categories = await db.category.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return categories.map<CategoryLookupRecord>((category) => ({
      id: category.id.toString(),
      name: category.name,
      slug: category.slug,
    }));
  }

  async findCategoryByValue(
    value: string | null | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<CategoryLookupRecord | null> {
    const normalizedValue = this.normalizeCategoryName(value);
    if (!normalizedValue) {
      return null;
    }

    const db = tx ?? this.prisma;
    if (/^\d+$/.test(normalizedValue)) {
      const byId = await db.category.findUnique({
        where: { id: BigInt(normalizedValue) },
        select: { id: true, name: true, slug: true },
      });
      if (byId) {
        return {
          id: byId.id.toString(),
          name: byId.name,
          slug: byId.slug,
        };
      }
    }

    const matched = await db.category.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: normalizedValue,
              mode: 'insensitive',
            },
          },
          {
            slug: {
              equals: normalizedValue,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { id: 'asc' },
    });

    if (!matched) {
      return null;
    }

    return {
      id: matched.id.toString(),
      name: matched.name,
      slug: matched.slug,
    };
  }

  async findExistingCategoryByName(
    value: string | null | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<CategoryLookupRecord | null> {
    const normalizedValue = this.normalizeCategoryName(value);
    if (!normalizedValue) {
      return null;
    }

    const db = tx ?? this.prisma;
    const matched = await db.category.findFirst({
      where: {
        name: {
          equals: normalizedValue,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { id: 'asc' },
    });

    if (!matched) {
      return null;
    }

    return {
      id: matched.id.toString(),
      name: matched.name,
      slug: matched.slug,
    };
  }

  async ensureCategoryByName(
    name: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CategoryRecord> {
    const db = tx ?? this.prisma;
    const normalizedName = this.normalizeCategoryName(name);
    if (!normalizedName) {
      throw new NotFoundException('Category name was not provided.');
    }

    const existing = await db.category.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { id: 'asc' },
    });

    if (existing) {
      return existing;
    }

    const id = await this.nextCategoryId(tx);
    return db.category.create({
      data: {
        id,
        name: normalizedName,
        slug: this.slugify(normalizedName),
        sortOrder: 0,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  async resolveCategoryAssignment(
    input: {
      categoryId?: number | bigint | null;
      categoryName?: string | null;
      sourceCategoryName?: string | null;
      sourceCategorySource?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const explicitCategoryId =
      input.categoryId !== undefined && input.categoryId !== null
        ? BigInt(input.categoryId)
        : null;

    if (explicitCategoryId !== null) {
      const category = await db.category.findUnique({
        where: { id: explicitCategoryId },
        select: { id: true, name: true, slug: true },
      });

      if (!category) {
        throw new NotFoundException(
          `Category ${explicitCategoryId} was not found.`,
        );
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        sourceCategoryName:
          this.normalizeCategoryName(input.sourceCategoryName) ??
          this.normalizeCategoryName(input.categoryName) ??
          category.name,
        sourceCategorySource: input.sourceCategorySource ?? null,
      };
    }

    const normalizedName =
      this.normalizeCategoryName(input.categoryName) ??
      this.normalizeCategoryName(input.sourceCategoryName);

    if (!normalizedName) {
      return {
        categoryId: null,
        categoryName: null,
        sourceCategoryName: this.normalizeCategoryName(
          input.sourceCategoryName,
        ),
        sourceCategorySource: input.sourceCategorySource ?? null,
      };
    }

    const category = await this.ensureCategoryByName(normalizedName, tx);
    return {
      categoryId: category.id,
      categoryName: category.name,
      sourceCategoryName:
        this.normalizeCategoryName(input.sourceCategoryName) ?? category.name,
      sourceCategorySource: input.sourceCategorySource ?? null,
    };
  }

  async syncProductsFromLegacyCategoryNames(limit = 5000) {
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          {
            categoryId: null,
            OR: [
              { categoryName: { not: null } },
              { sourceCategoryName: { not: null } },
            ],
          },
          {
            categoryId: {
              not: null,
            },
          },
        ],
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      take: limit,
    });

    let createdCategories = 0;
    let linkedProducts = 0;
    let updatedMirrors = 0;

    for (const product of products) {
      if (product.category) {
        const normalizedCategoryName = this.normalizeCategoryName(
          product.categoryName,
        );
        if (normalizedCategoryName !== product.category.name) {
          await this.prisma.product.update({
            where: { id: product.id },
            data: {
              categoryName: product.category.name,
            },
          });
          updatedMirrors += 1;
        }
        continue;
      }

      const before = await this.prisma.category.findFirst({
        where: {
          name: {
            equals:
              this.normalizeCategoryName(product.categoryName) ??
              this.normalizeCategoryName(product.sourceCategoryName) ??
              '',
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      const resolved = await this.resolveCategoryAssignment({
        categoryName: product.categoryName,
        sourceCategoryName: product.sourceCategoryName,
        sourceCategorySource: product.sourceCategorySource,
      });

      if (!resolved.categoryId) {
        continue;
      }

      if (!before) {
        createdCategories += 1;
      }

      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: resolved.categoryId,
          categoryName: resolved.categoryName,
          sourceCategoryName: resolved.sourceCategoryName,
        },
      });
      linkedProducts += 1;
    }

    return {
      scannedProducts: products.length,
      createdCategories,
      linkedProducts,
      updatedMirrors,
    };
  }

  async linkProductsToExistingCategoriesFromNames(options?: {
    limit?: number;
    dryRun?: boolean;
  }): Promise<LinkProductsToExistingCategoriesResult> {
    const limit = options?.limit ?? 5000;
    const dryRun = options?.dryRun ?? false;
    const products = await this.prisma.product.findMany({
      where: {
        categoryId: null,
        OR: [
          { categoryName: { not: null } },
          { sourceCategoryName: { not: null } },
        ],
      },
      select: {
        id: true,
        categoryName: true,
        sourceCategoryName: true,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let linkedProducts = 0;
    const unmatchedCategoryNames = new Set<string>();

    for (const product of products) {
      const matchedCategory =
        (await this.findExistingCategoryByName(product.categoryName)) ??
        (await this.findExistingCategoryByName(product.sourceCategoryName));

      if (!matchedCategory) {
        const unmatchedName =
          this.normalizeCategoryName(product.categoryName) ??
          this.normalizeCategoryName(product.sourceCategoryName);
        if (unmatchedName) {
          unmatchedCategoryNames.add(unmatchedName);
        }
        continue;
      }

      linkedProducts += 1;
      if (dryRun) {
        continue;
      }

      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: BigInt(matchedCategory.id),
          categoryName: matchedCategory.name,
        },
      });
    }

    return {
      scannedProducts: products.length,
      linkedProducts,
      dryRun,
      unmatchedProducts: products.length - linkedProducts,
      unmatchedCategoryNames: [...unmatchedCategoryNames].sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  }

  async createCategory(payload: {
    id?: number;
    name: string;
    slug: string;
    parentId?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const id = payload.id ? BigInt(payload.id) : await this.nextCategoryId();
    return this.prisma.category.create({
      data: {
        id,
        name: payload.name,
        slug: payload.slug,
        parentId:
          payload.parentId !== undefined && payload.parentId !== null
            ? BigInt(payload.parentId)
            : null,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateCategory(
    categoryId: string,
    payload: {
      name?: string;
      slug?: string;
      parentId?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    await this.ensureCategory(categoryId);
    return this.prisma.category.update({
      where: { id: BigInt(categoryId) },
      data: {
        name: payload.name,
        slug: payload.slug,
        parentId:
          payload.parentId === undefined
            ? undefined
            : payload.parentId === null
              ? null
              : BigInt(payload.parentId),
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
      },
    });
  }

  async createMapping(payload: {
    source: string;
    sourceCategoryName: string;
    sourceSubjectName?: string | null;
    targetCategoryId: number;
    confidence?: number | null;
  }) {
    await this.ensureCategory(String(payload.targetCategoryId));
    return this.prisma.categoryMapping.create({
      data: {
        source: payload.source,
        sourceCategoryName: payload.sourceCategoryName,
        sourceSubjectName: payload.sourceSubjectName,
        targetCategoryId: BigInt(payload.targetCategoryId),
        confidence: payload.confidence ?? null,
      },
    });
  }

  async updateMapping(
    mappingId: string,
    payload: {
      source?: string;
      sourceCategoryName?: string;
      sourceSubjectName?: string | null;
      targetCategoryId?: number;
      confidence?: number | null;
    },
  ) {
    if (payload.targetCategoryId !== undefined) {
      await this.ensureCategory(String(payload.targetCategoryId));
    }
    return this.prisma.categoryMapping.update({
      where: { id: mappingId },
      data: {
        source: payload.source,
        sourceCategoryName: payload.sourceCategoryName,
        sourceSubjectName: payload.sourceSubjectName,
        targetCategoryId:
          payload.targetCategoryId !== undefined
            ? BigInt(payload.targetCategoryId)
            : undefined,
        confidence: payload.confidence,
      },
    });
  }

  private async nextCategoryId(tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const last = await db.category.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return (last?.id ?? BigInt(0)) + BigInt(1);
  }

  private async ensureCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(categoryId) },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} was not found.`);
    }
  }

  private toTree(
    categories: Array<{
      id: bigint;
      name: string;
      slug: string | null;
      parentId: bigint | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const nodes = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string | null;
        parentId: string | null;
        sortOrder: number;
        isActive: boolean;
        children: unknown[];
      }
    >();

    for (const category of categories) {
      nodes.set(category.id.toString(), {
        id: category.id.toString(),
        name: category.name,
        slug: category.slug,
        parentId: category.parentId?.toString() ?? null,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        children: [],
      });
    }

    const roots: unknown[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private slugify(value: string) {
    return value
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 255);
  }
}
