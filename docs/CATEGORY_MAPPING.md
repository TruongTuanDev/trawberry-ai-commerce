# Category Mapping

This phase adds an internal marketplace category layer on top of the legacy `Product.categoryName` text field.

## Data Model

- `categories`: `name`, `slug`, optional `parentId`, `sortOrder`, `isActive`
- `category_mappings`: source category text mapped to an internal category
- `products`: keeps `categoryName`, adds `sourceCategoryName` and `sourceCategorySource`, and uses additive `categoryId`

## Mapping Rules

`CategoryMappingService` trims, lowercases, replaces `ё` with `е`, and collapses duplicate spaces.

Mapping order:

1. Exact mapping from `category_mappings`
2. Keyword fallback such as `джинсы`, `брюки`, `юбки`, `шорты`, `платья`, `рубашки`, `куртки`
3. If no mapping exists, keep the source category and emit `UNMAPPED_CATEGORY`

WB Excel import uses `Категория продавца`. WB API sync uses Content API `subjectName`.

This phase intentionally does not sync WB prices or stock. Sellers manage local price and inventory.
