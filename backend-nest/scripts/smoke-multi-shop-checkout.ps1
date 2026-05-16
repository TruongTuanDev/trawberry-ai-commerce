$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'

function Register-ApprovedSeller {
  param(
    [string]$Email,
    [string]$FullName
  )

  $registered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $Email
    password = $password
    fullName = $FullName
    role = 'SELLER'
  } | ConvertTo-Json)

  $env:TARGET_USER_ID = $registered.userId
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

  $login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $Email
    password = $password
  } | ConvertTo-Json)

  return @{ accessToken = $login.accessToken; userId = $registered.userId }
}

function Create-ShopProduct {
  param(
    [string]$AccessToken,
    [string]$ShopName,
    [string]$ShopSlug,
    [string]$ProductName,
    [int]$Price,
    [int]$Stock,
    [int64]$NmId,
    [string]$Size
  )

  $headers = @{ Authorization = "Bearer $AccessToken" }
  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
    name = $ShopName
    slug = $ShopSlug
    paymentInstructions = "Manual transfer for $ShopName."
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
    wbNmId = $NmId
    wbTitle = $ProductName
    localTitle = $ProductName
    localDescription = "$ProductName checkout-ready"
    visibility = 'ACTIVE'
  } | ConvertTo-Json)

  $env:TARGET_PRODUCT_ID = $product.id
  $env:TARGET_PRICE = "$Price"
  $env:TARGET_STOCK = "$Stock"
  $env:TARGET_SIZE = $Size
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  const variant = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now() + Math.floor(Math.random() * 1000)),
      sellerSku: `MULTI-${process.env.TARGET_SIZE}`,
      sizeName: process.env.TARGET_SIZE,
      isActive: true,
      basePrice: Number(process.env.TARGET_PRICE),
      stockQuantity: Number(process.env.TARGET_STOCK),
      reservedStock: 0,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: `https://example.com/${process.env.TARGET_PRODUCT_ID}.jpg`,
      localUrl: `https://example.com/${process.env.TARGET_PRODUCT_ID}.jpg`,
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
  Remove-Item Env:TARGET_PRICE
  Remove-Item Env:TARGET_STOCK
  Remove-Item Env:TARGET_SIZE

  $variant = $variantJson | ConvertFrom-Json
  return @{ shop = $shop; product = $product; variantId = $variant.variantId; headers = $headers }
}

$sellerA = Register-ApprovedSeller -Email "multi-shop-a-$timestamp@example.com" -FullName 'Multi Shop Seller A'
$sellerB = Register-ApprovedSeller -Email "multi-shop-b-$timestamp@example.com" -FullName 'Multi Shop Seller B'

$a = Create-ShopProduct -AccessToken $sellerA.accessToken -ShopName 'Multi Shop A' -ShopSlug "multi-shop-a-$timestamp" -ProductName 'Multi Shop Product A' -Price 100 -Stock 10 -NmId ([int64](8000000 + (Get-Random -Minimum 1 -Maximum 99999))) -Size 'A'
$b = Create-ShopProduct -AccessToken $sellerB.accessToken -ShopName 'Multi Shop B' -ShopSlug "multi-shop-b-$timestamp" -ProductName 'Multi Shop Product B' -Price 200 -Stock 7 -NmId ([int64](9000000 + (Get-Random -Minimum 1 -Maximum 99999))) -Size 'B'

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $a.shop.id
  items = @(
    @{ productId = $a.product.id; variantId = $a.variantId; quantity = 2 },
    @{ productId = $b.product.id; variantId = $b.variantId; quantity = 3 }
  )
  customer = @{
    fullName = 'Multi Shop Customer'
    phone = '0123456789'
    email = "multi-shop-customer-$timestamp@example.com"
    address = '123 Multi Shop Street'
    note = 'Split checkout smoke'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

if (@($checkout.orders).Count -ne 2) { throw "Expected 2 orders, got $(@($checkout.orders).Count)" }
if ($checkout.grandTotal -ne '800') { throw "Expected grandTotal 800, got $($checkout.grandTotal)" }

$orderA = @($checkout.orders | Where-Object { $_.shopId -eq $a.shop.id })[0]
$orderB = @($checkout.orders | Where-Object { $_.shopId -eq $b.shop.id })[0]
if ($orderA.totalAmount -ne '200') { throw "Expected order A total 200, got $($orderA.totalAmount)" }
if ($orderB.totalAmount -ne '600') { throw "Expected order B total 600, got $($orderB.totalAmount)" }

$sellerAOrders = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($a.shop.id)/orders?page=1&size=10&search=$($orderA.orderCode)" -Headers $a.headers
$sellerBOrders = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($b.shop.id)/orders?page=1&size=10&search=$($orderB.orderCode)" -Headers $b.headers
$sellerAWrongOrder = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($a.shop.id)/orders?page=1&size=10&search=$($orderB.orderCode)" -Headers $a.headers
$sellerBWrongOrder = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($b.shop.id)/orders?page=1&size=10&search=$($orderA.orderCode)" -Headers $b.headers
if (@($sellerAOrders.items).Count -ne 1) { throw 'Seller A cannot see its order.' }
if (@($sellerBOrders.items).Count -ne 1) { throw 'Seller B cannot see its order.' }
if (@($sellerAWrongOrder.items).Count -ne 0) { throw 'Seller A can see seller B order.' }
if (@($sellerBWrongOrder.items).Count -ne 0) { throw 'Seller B can see seller A order.' }

$trackedA = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($orderA.orderId)/track?phone=0123456789"
$trackedB = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($orderB.orderId)/track?phone=0123456789"
if ($trackedA.orderCode -ne $orderA.orderCode) { throw 'Tracking A failed.' }
if ($trackedB.orderCode -ne $orderB.orderCode) { throw 'Tracking B failed.' }

$paymentsA = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($a.shop.id)/payments?page=1&size=10&search=$($orderA.orderCode)" -Headers $a.headers
$paymentsB = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($b.shop.id)/payments?page=1&size=10&search=$($orderB.orderCode)" -Headers $b.headers
if (@($paymentsA.items).Count -ne 1) { throw 'Payment queue A missing order.' }
if (@($paymentsB.items).Count -ne 1) { throw 'Payment queue B missing order.' }

$env:VARIANT_A_ID = $a.variantId
$env:VARIANT_B_ID = $b.variantId
@'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [process.env.VARIANT_A_ID, process.env.VARIANT_B_ID] } },
  });
  console.log(JSON.stringify(variants.map((variant) => ({
    id: variant.id,
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
Remove-Item Env:VARIANT_A_ID
Remove-Item Env:VARIANT_B_ID
$stock = @($stockJson | ConvertFrom-Json | ForEach-Object { $_ })
$stockA = @($stock | Where-Object { $_.id -eq $a.variantId })[0]
$stockB = @($stock | Where-Object { $_.id -eq $b.variantId })[0]
if ([int]$stockA.stockQuantity -ne 8) { throw "Expected stock A 8, got $($stockA.stockQuantity)" }
if ([int]$stockB.stockQuantity -ne 4) { throw "Expected stock B 4, got $($stockB.stockQuantity)" }

$failed = $false
try {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $a.shop.id
    items = @(
      @{ productId = $a.product.id; variantId = $a.variantId; quantity = 1 },
      @{ productId = $b.product.id; variantId = $b.variantId; quantity = 99 }
    )
    customer = @{
      fullName = 'Multi Shop Customer'
      phone = '0123456789'
      address = '123 Multi Shop Street'
    }
    paymentMethod = 'MANUAL_TRANSFER'
  } | ConvertTo-Json -Depth 6)
} catch {
  $failed = $true
}
if (-not $failed) { throw 'Expected multi-shop checkout with insufficient stock to fail.' }

[pscustomobject]@{
  baseUrl = $baseUrl
  orderCodes = $checkout.orderCodes
  grandTotal = $checkout.grandTotal
  orderATotal = $orderA.totalAmount
  orderBTotal = $orderB.totalAmount
  sellerASeesOwnOrder = @($sellerAOrders.items).Count -eq 1
  sellerBSeesOwnOrder = @($sellerBOrders.items).Count -eq 1
  trackingA = $trackedA.orderCode
  trackingB = $trackedB.orderCode
  paymentA = @($paymentsA.items).Count
  paymentB = @($paymentsB.items).Count
  stockA = $stockA.stockQuantity
  stockB = $stockB.stockQuantity
  insufficientStockFailed = $failed
} | ConvertTo-Json -Compress
