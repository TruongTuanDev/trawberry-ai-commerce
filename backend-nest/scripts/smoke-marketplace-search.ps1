$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$env:SMOKE_MARKETPLACE_STAMP = $timestamp

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function Invoke-Json($path) {
  Invoke-RestMethod -Method GET -Uri "$baseUrl$path"
}

@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
const stamp = process.env.SMOKE_MARKETPLACE_STAMP;

async function ensureCategory(id, name, slug, parentId = null, sortOrder = 0) {
  await prisma.category.upsert({
    where: { id: BigInt(id) },
    update: { name, slug, parentId: parentId ? BigInt(parentId) : null, sortOrder, isActive: true },
    create: { id: BigInt(id), name, slug, parentId: parentId ? BigInt(parentId) : null, sortOrder, isActive: true },
  });
}

async function upsertProduct(shopId, data) {
  const product = await prisma.product.upsert({
    where: { shopId_wbNmId: { shopId, wbNmId: BigInt(data.wbNmId) } },
    update: {
      wbTitle: data.title,
      localTitle: data.title,
      wbDescription: data.description,
      localDescription: data.description,
      brand: data.brand,
      color: data.color,
      gender: data.gender,
      categoryId: BigInt(data.categoryId),
      categoryName: data.categoryName,
      sourceCategoryName: data.sourceCategoryName,
      sourceCategorySource: 'MANUAL',
      visibility: 'ACTIVE',
    },
    create: {
      id: randomUUID(),
      shopId,
      wbNmId: BigInt(data.wbNmId),
      wbTitle: data.title,
      localTitle: data.title,
      wbDescription: data.description,
      localDescription: data.description,
      brand: data.brand,
      color: data.color,
      gender: data.gender,
      categoryId: BigInt(data.categoryId),
      categoryName: data.categoryName,
      sourceCategoryName: data.sourceCategoryName,
      sourceCategorySource: 'MANUAL',
      wbVendorCode: data.vendorCode,
      sellerSku: data.vendorCode,
      seoSlug: data.vendorCode.toLowerCase(),
      visibility: 'ACTIVE',
    },
    select: { id: true },
  });

  await prisma.productImage.upsert({
    where: { id: data.imageId },
    update: { productId: product.id, wbUrl: data.imageUrl, localUrl: data.imageUrl, isMain: true, sortOrder: 0 },
    create: { id: data.imageId, productId: product.id, wbUrl: data.imageUrl, localUrl: data.imageUrl, isMain: true, sortOrder: 0 },
  });

  await prisma.productVariant.upsert({
    where: { productId_chrtId: { productId: product.id, chrtId: BigInt(data.chrtId) } },
    update: { isActive: true, basePrice: data.price, discountPrice: data.price, stockQuantity: data.stock },
    create: {
      id: randomUUID(),
      productId: product.id,
      chrtId: BigInt(data.chrtId),
      techSize: 'M',
      wbSize: 'M',
      isActive: true,
      basePrice: data.price,
      discountPrice: data.price,
      stockQuantity: data.stock,
      reservedStock: 0,
    },
  });
}

(async () => {
  await ensureCategory(1000, 'Женская одежда', 'women', null, 10);
  await ensureCategory(1010, 'Джинсы', 'jeans', 1000, 10);
  await ensureCategory(1030, 'Юбки', 'skirts', 1000, 30);
  const shop = await prisma.shop.findFirstOrThrow({
    where: { slug: 'demo-marketplace-shop' },
    select: { id: true },
  });
  await upsertProduct(shop.id, {
    wbNmId: `77${stamp.slice(-8)}01`,
    chrtId: `88${stamp.slice(-8)}01`,
    imageId: 'aaaaaaaa-aaaa-4aaa-8aaa-' + stamp.slice(-10) + '01',
    imageUrl: `http://localhost:3000/demo/search-jeans-${stamp}.svg`,
    title: `Search Smoke Jeans ${stamp}`,
    description: 'Blue denim searchable marketplace product.',
    brand: `SmokeBrand${stamp}`,
    color: 'Blue',
    gender: 'Women',
    categoryId: 1010,
    categoryName: 'Джинсы',
    sourceCategoryName: 'Jeans',
    vendorCode: `SMOKE-JEANS-${stamp}`,
    price: '25.00',
    stock: 7,
  });
  await upsertProduct(shop.id, {
    wbNmId: `77${stamp.slice(-8)}02`,
    chrtId: `88${stamp.slice(-8)}02`,
    imageId: 'bbbbbbbb-bbbb-4bbb-8bbb-' + stamp.slice(-10) + '02',
    imageUrl: `http://localhost:3000/demo/search-skirt-${stamp}.svg`,
    title: `Search Smoke Skirt ${stamp}`,
    description: 'Red skirt searchable marketplace product.',
    brand: `OtherBrand${stamp}`,
    color: 'Red',
    gender: 'Women',
    categoryId: 1030,
    categoryName: 'Юбки',
    sourceCategoryName: 'Skirts',
    vendorCode: `SMOKE-SKIRT-${stamp}`,
    price: '55.00',
    stock: 3,
  });
})().finally(async () => prisma.$disconnect());
'@ | node -

Remove-Item Env:SMOKE_MARKETPLACE_STAMP

$search = Invoke-Json "/api/public/products?q=Smoke%20Jeans%20$timestamp"
Assert-True ($search.items.Count -ge 1) 'Search did not return smoke jeans.'
Assert-True ($search.items[0].name -like "*Smoke Jeans $timestamp*") 'Search result did not match smoke jeans.'

$category = Invoke-Json "/api/public/products?categorySlug=jeans&q=$timestamp"
Assert-True (@($category.items | Where-Object { $_.categorySlug -eq 'jeans' }).Count -ge 1) 'Category filter did not return jeans.'

$brand = Invoke-Json "/api/public/products?brand=SmokeBrand$timestamp"
Assert-True ($brand.items.Count -eq 1) 'Brand filter did not return exactly one product.'

$color = Invoke-Json "/api/public/products?color=Blue&q=$timestamp"
Assert-True (@($color.items | Where-Object { $_.color -eq 'Blue' }).Count -ge 1) 'Color filter failed.'

$stock = Invoke-Json "/api/public/products?inStock=true&q=$timestamp"
Assert-True ($stock.items.Count -ge 2) 'In-stock filter failed.'

$sortedAsc = Invoke-Json "/api/public/products?q=$timestamp&sort=price_asc"
Assert-True ([decimal]$sortedAsc.items[0].price -le [decimal]$sortedAsc.items[1].price) 'Price ascending sort failed.'

$sortedDesc = Invoke-Json "/api/public/products?q=$timestamp&sort=price_desc"
Assert-True ([decimal]$sortedDesc.items[0].price -ge [decimal]$sortedDesc.items[1].price) 'Price descending sort failed.'

$detail = Invoke-Json "/api/public/products/$($brand.items[0].id)"
Assert-True ($detail.categorySlug -eq 'jeans') 'Product detail did not include mapped category.'
Assert-True ($detail.brand -eq "SmokeBrand$timestamp") 'Product detail did not include brand.'

[pscustomobject]@{
  baseUrl = $baseUrl
  searchCount = $search.items.Count
  jeansCategoryCount = $category.items.Count
  brandCount = $brand.items.Count
  colorCount = $color.items.Count
  inStockCount = $stock.items.Count
  ascFirstPrice = $sortedAsc.items[0].price
  descFirstPrice = $sortedDesc.items[0].price
  detailCategory = $detail.categoryName
} | ConvertTo-Json -Compress
