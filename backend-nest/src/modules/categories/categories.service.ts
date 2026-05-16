import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

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

  private async nextCategoryId() {
    const last = await this.prisma.category.findFirst({
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
}
