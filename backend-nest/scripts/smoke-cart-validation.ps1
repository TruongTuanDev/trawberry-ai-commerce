$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-cart-validation-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7800000 + (Get-Random -Minimum 1 -Maximum 99999))

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Cart Validation Seller'
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
  name = 'Smoke Cart Validation Shop'
  slug = "smoke-cart-validation-shop-$timestamp"
  paymentInstructions = 'Manual transfer for cart validation smoke.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Cart Validation Product'
  localTitle = 'Smoke Cart Validation Product'
  localDescription = 'Cart validation smoke product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  const variant = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now()),
      sellerSku: 'SMOKE-CART-VALIDATION',
      sizeName: 'XL',
      russianSize: '50',
      techSize: 'XL',
      isActive: true,
      basePrice: 1200,
      stockQuantity: 2,
      reservedStock: 0,
      lowStockThreshold: 1,
      trackInventory: true,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-cart-validation.jpg',
      localUrl: 'https://example.com/smoke-cart-validation.jpg',
      isMain: true,
      sortOrder: 0,
    },
  });
  console.log(JSON.stringify({ variantId: variant.id }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node - | Set-Variable -Name variantJson
Remove-Item Env:TARGET_PRODUCT_ID
$variant = $variantJson | ConvertFrom-Json

$published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
if ($published.catalogStatus -ne 'PUBLISHED') {
  throw 'Cart validation smoke product was not published.'
}

$valid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/public/cart/validate" -ContentType 'application/json' -Body (@{
  items = @(
    @{
      productId = $product.id
      variantId = $variant.variantId
      quantity = 2
      clientUnitPrice = 1200
    }
  )
} | ConvertTo-Json -Depth 6)

if (-not $valid.valid -or $valid.summary.invalidCount -ne 0) {
  throw 'Expected cart validation to succeed for current stock.'
}

$null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/inventory" -Headers $headers -ContentType 'application/json' -Body (@{
  variantId = $variant.variantId
  stockQuantity = 1
} | ConvertTo-Json)

$exceeds = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/public/cart/validate" -ContentType 'application/json' -Body (@{
  items = @(
    @{
      productId = $product.id
      variantId = $variant.variantId
      quantity = 2
      clientUnitPrice = 1200
    }
  )
} | ConvertTo-Json -Depth 6)

if ($exceeds.valid -or $exceeds.items[0].status -ne 'QUANTITY_EXCEEDS_STOCK' -or $exceeds.items[0].maxQuantity -ne 1) {
  throw 'Expected quantity exceeds stock contract after lowering inventory.'
}

$unpublished = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/unpublish" -Headers $headers -ContentType 'application/json' -Body '{}'
if ($unpublished.catalogStatus -ne 'UNPUBLISHED') {
  throw 'Cart validation smoke product was not unpublished.'
}

$hidden = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/public/cart/validate" -ContentType 'application/json' -Body (@{
  items = @(
    @{
      productId = $product.id
      variantId = $variant.variantId
      quantity = 1
      clientUnitPrice = 1200
    }
  )
} | ConvertTo-Json -Depth 6)

if ($hidden.valid -or $hidden.items[0].status -ne 'PRODUCT_NOT_PUBLIC') {
  throw 'Expected unpublished product to fail public cart validation.'
}

$checkoutFailed = $false
try {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(
      @{
        productId = $product.id
        variantId = $variant.variantId
        quantity = 1
      }
    )
    customer = @{
      fullName = 'Smoke Cart Validation Customer'
      phone = '0123456789'
      address = '123 Validation Street'
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 6)
} catch {
  $checkoutFailed = $true
}

if (-not $checkoutFailed) {
  throw 'Expected checkout to keep rejecting unavailable item after cart validation failure.'
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  variantId = $variant.variantId
  initialValid = $valid.valid
  exceedsStatus = $exceeds.items[0].status
  hiddenStatus = $hidden.items[0].status
  checkoutFailed = $checkoutFailed
} | ConvertTo-Json -Compress
