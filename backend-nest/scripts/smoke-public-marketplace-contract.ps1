$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-public-contract-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7600000 + (Get-Random -Minimum 1 -Maximum 99999))

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Public Contract Seller'
  role = 'SELLER'
} | ConvertTo-Json)

$env:TARGET_USER_ID = $sellerRegister.userId
@'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.sellerProfile.update({
    where: { userId: process.env.TARGET_USER_ID },
    data: { approvalStatus: 'APPROVED' },
  });
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
Remove-Item Env:TARGET_USER_ID

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Public Contract Shop'
  slug = "smoke-public-contract-shop-$timestamp"
  paymentInstructions = 'Manual transfer for smoke public contract.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Public Contract Product'
  localTitle = 'Smoke Public Contract Product'
  localDescription = 'Public marketplace contract smoke product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  const inStock = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now()),
      sellerSku: 'SMOKE-PUBLIC-XL',
      sizeName: 'XL',
      russianSize: '50',
      techSize: 'XL',
      isActive: true,
      basePrice: 1788,
      stockQuantity: 3,
      reservedStock: 0,
      lowStockThreshold: 1,
      trackInventory: true,
    },
  });
  const outOfStock = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now() + 1),
      sellerSku: 'SMOKE-PUBLIC-2XL',
      sizeName: '2XL',
      russianSize: '52',
      techSize: '2XL',
      isActive: true,
      basePrice: 1825,
      stockQuantity: 0,
      reservedStock: 0,
      lowStockThreshold: 1,
      trackInventory: true,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-public-contract.jpg',
      localUrl: 'https://example.com/smoke-public-contract.jpg',
      isMain: true,
      sortOrder: 0,
    },
  });
  console.log(JSON.stringify({ inStockVariantId: inStock.id, outOfStockVariantId: outOfStock.id }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node - | Set-Variable -Name variantJson
Remove-Item Env:TARGET_PRODUCT_ID
$variants = $variantJson | ConvertFrom-Json

$published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
if ($published.catalogStatus -ne 'PUBLISHED') {
  throw 'Public contract smoke product was not published.'
}

$publicList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products?q=Smoke%20Public%20Contract%20Product"
if (@($publicList.items).Count -ne 1) {
  throw "Expected 1 public product, got $(@($publicList.items).Count)"
}

$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$($product.id)"
if (@($detail.variants).Count -ne 2) {
  throw "Expected 2 variants in public detail, got $(@($detail.variants).Count)"
}

$detailOutOfStock = @($detail.variants | Where-Object { $_.id -eq $variants.outOfStockVariantId } | Select-Object -First 1)
if (-not $detailOutOfStock -or $detailOutOfStock.inStock) {
  throw 'Out-of-stock variant was not exposed safely in public detail.'
}

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(
    @{
      productId = $product.id
      variantId = $variants.inStockVariantId
      quantity = 1
    }
  )
  customer = @{
    fullName = 'Smoke Public Contract Customer'
    phone = '0123456789'
    address = '123 Smoke Contract Street'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

$outOfStockFailed = $false
try {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(
      @{
        productId = $product.id
        variantId = $variants.outOfStockVariantId
        quantity = 1
      }
    )
    customer = @{
      fullName = 'Smoke Public Contract Customer'
      phone = '0123456789'
      address = '123 Smoke Contract Street'
    }
    paymentMethod = 'MANUAL_TRANSFER'
  } | ConvertTo-Json -Depth 6)
} catch {
  $outOfStockFailed = $true
}

if (-not $outOfStockFailed) {
  throw 'Expected out-of-stock checkout to fail.'
}

$unpublished = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/unpublish" -Headers $headers -ContentType 'application/json' -Body '{}'
if ($unpublished.catalogStatus -ne 'UNPUBLISHED') {
  throw 'Public contract smoke product was not unpublished.'
}

$hiddenList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products?q=Smoke%20Public%20Contract%20Product"
if (@($hiddenList.items).Count -ne 0) {
  throw 'Expected unpublished product to disappear from public list.'
}

$hiddenDetailFailed = $false
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$($product.id)"
} catch {
  $hiddenDetailFailed = $true
}

if (-not $hiddenDetailFailed) {
  throw 'Expected unpublished product detail to become unavailable.'
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  checkoutCode = $checkout.checkoutCode
  publicVariantCount = @($detail.variants).Count
  outOfStockFailed = $outOfStockFailed
  hiddenDetailFailed = $hiddenDetailFailed
} | ConvertTo-Json -Compress
