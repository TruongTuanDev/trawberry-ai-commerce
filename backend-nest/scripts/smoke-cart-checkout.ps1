$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-cart-checkout-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7000000 + (Get-Random -Minimum 1 -Maximum 99999))

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Cart Seller'
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
  name = 'Smoke Cart Shop'
  slug = "smoke-cart-shop-$timestamp"
  paymentInstructions = 'Transfer to bank account 123.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Cart Product'
  localTitle = 'Smoke Cart Product'
  localDescription = 'Cart checkout-ready product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  const small = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now()),
      sellerSku: 'SMOKE-CART-S',
      sizeName: 'S',
      russianSize: '42',
      isActive: true,
      basePrice: 120,
      discountPrice: 99,
      stockQuantity: 10,
      reservedStock: 0,
    },
  });
  const medium = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now() + 1),
      sellerSku: 'SMOKE-CART-M',
      sizeName: 'M',
      russianSize: '44',
      isActive: true,
      basePrice: 140,
      discountPrice: 110,
      stockQuantity: 7,
      reservedStock: 0,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-cart-checkout.jpg',
      localUrl: 'https://example.com/smoke-cart-checkout.jpg',
      isMain: true,
      sortOrder: 0,
    },
  });
  console.log(JSON.stringify({ smallVariantId: small.id, mediumVariantId: medium.id }));
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
  throw 'Cart checkout smoke product was not published.'
}

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(
    @{
      productId = $product.id
      variantId = $variants.smallVariantId
      quantity = 2
    },
    @{
      productId = $product.id
      variantId = $variants.mediumVariantId
      quantity = 3
    }
  )
  customer = @{
    fullName = 'Smoke Cart Customer'
    phone = '0123456789'
    email = "smoke-cart-customer-$timestamp@example.com"
    address = '123 Smoke Test Street'
    note = 'Cart checkout smoke'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)
$trackedPhone = [uri]::EscapeDataString($checkout.customerPhone)

if ($checkout.totalAmount -ne '528') {
  throw "Expected totalAmount 528, got $($checkout.totalAmount)"
}

$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $headers
if (@($detail.items).Count -ne 2) {
  throw "Expected 2 order items, got $(@($detail.items).Count)"
}

$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$trackedPhone"
if (@($tracked.items).Count -ne 2) {
  throw "Expected 2 tracked items, got $(@($tracked.items).Count)"
}

$env:SMALL_VARIANT_ID = $variants.smallVariantId
$env:MEDIUM_VARIANT_ID = $variants.mediumVariantId
@'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [process.env.SMALL_VARIANT_ID, process.env.MEDIUM_VARIANT_ID] } },
    orderBy: { sizeName: 'asc' },
  });
  console.log(JSON.stringify(variants.map((variant) => ({
    id: variant.id,
    sizeName: variant.sizeName,
    stockQuantity: variant.stockQuantity,
    reservedStock: variant.reservedStock,
  }))));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node - | Set-Variable -Name stockJson
Remove-Item Env:SMALL_VARIANT_ID
Remove-Item Env:MEDIUM_VARIANT_ID
$stock = @($stockJson | ConvertFrom-Json | ForEach-Object { $_ })
$smallStock = [int](($stock | Where-Object { $_.sizeName -eq 'S' } | Select-Object -First 1).stockQuantity)
$mediumStock = [int](($stock | Where-Object { $_.sizeName -eq 'M' } | Select-Object -First 1).stockQuantity)
if ($smallStock -ne 8) {
  throw 'Small variant stock was not deducted correctly.'
}
if ($mediumStock -ne 4) {
  throw 'Medium variant stock was not deducted correctly.'
}

$failed = $false
try {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(
      @{
        productId = $product.id
        variantId = $variants.mediumVariantId
        quantity = 99
      }
    )
    customer = @{
      fullName = 'Smoke Cart Customer'
      phone = '0123456789'
      address = '123 Smoke Test Street'
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 6)
} catch {
  $failed = $true
}

if (-not $failed) {
  throw 'Expected checkout beyond stock to fail.'
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  orderId = $checkout.orderId
  orderCode = $checkout.orderCode
  totalAmount = $checkout.totalAmount
  sellerItemCount = @($detail.items).Count
  trackingItemCount = @($tracked.items).Count
  stock = $stock
  beyondStockFailed = $failed
} | ConvertTo-Json -Compress
