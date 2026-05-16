import { CategoryMappingService } from '../src/modules/categories/category-mapping.service';

describe('Category mapping', () => {
  const category = {
    id: BigInt(1010),
    name: 'Джинсы',
    slug: 'jeans',
    parentId: null,
    sortOrder: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('maps exact source category mappings', async () => {
    const service = new CategoryMappingService({
      categoryMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            source: 'WILDBERRIES_EXCEL',
            sourceCategoryName: 'WB Jeans',
            sourceSubjectName: null,
            targetCategoryId: category.id,
            targetCategory: category,
          },
        ]),
      },
      category: { findFirst: jest.fn() },
    } as never);

    const result = await service.mapSourceCategory(
      'WILDBERRIES_EXCEL',
      'WB Jeans',
    );
    expect(result.categoryId).toBe(category.id);
    expect(result.categoryName).toBe('Джинсы');
    expect(result.warning).toBeNull();
  });

  it('maps keyword fallback categories after normalization', async () => {
    const service = new CategoryMappingService({
      categoryMapping: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findFirst: jest.fn().mockResolvedValue(category) },
    } as never);

    const result = await service.mapSourceCategory(
      'WILDBERRIES_API',
      '  Джинсы   женские  ',
    );
    expect(result.categoryId).toBe(category.id);
    expect(result.warning).toBeNull();
  });

  it('returns an unmapped category warning when no mapping matches', async () => {
    const service = new CategoryMappingService({
      categoryMapping: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);

    const result = await service.mapSourceCategory(
      'WILDBERRIES_API',
      'Unexpected subject',
    );
    expect(result.categoryId).toBeNull();
    expect(result.warning?.code).toBe('UNMAPPED_CATEGORY');
  });
});
