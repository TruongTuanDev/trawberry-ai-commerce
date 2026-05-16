# Marketplace Search, Filter, And Sort

`GET /api/public/products` supports catalog discovery with database search and filters.

Supported query params:

- `q` or `search`
- `categoryId` or `categorySlug`
- `brand`, `color`, `gender`
- `minPrice`, `maxPrice`
- `inStock=true|false`
- `sort=newest|price_asc|price_desc|name_asc|stock_desc`
- `page`, `size`

Search matches title, article/vendor code, brand, category, source category, description, color, and gender.

Public cards use the lowest active sellable variant price as the display price. Price sorting uses that same minimum variant price. Checkout still recalculates totals server-side.

The response includes lightweight facets for categories, brands, colors, genders, and price range.

Verification:

- `npm run smoke:marketplace-search`
- `npm run test:e2e:marketplace-search-filter-sort`
