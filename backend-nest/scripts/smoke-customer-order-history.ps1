$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'

function Register-ApprovedSeller {
  param([string]$Email, [string]$FullName)

  $registered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $Email; password = $password; fullName = $FullName; role = 'SELLER'
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
    email = $Email; password = $password
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
    categoryName = 'Smoke Category'
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
      sellerSku: `CUSTOMER-${process.env.TARGET_SIZE}`,
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

  $published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
  $variant = $variantJson | ConvertFrom-Json
  if ($published.catalogStatus -ne 'PUBLISHED') { throw 'Customer history smoke product was not published.' }
  return @{ shop = $shop; product = $product; variantId = $variant.variantId; headers = $headers }
}

$customerEmail = "customer-history-$timestamp@example.com"
$phone = "019$($timestamp.Substring($timestamp.Length - 7))"
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
  fullName = 'Customer History Smoke'
  role = 'CUSTOMER'
} | ConvertTo-Json) | Out-Null
$customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
} | ConvertTo-Json)
$customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

$sellerA = Register-ApprovedSeller -Email "customer-history-a-$timestamp@example.com" -FullName 'Customer History Seller A'
$sellerB = Register-ApprovedSeller -Email "customer-history-b-$timestamp@example.com" -FullName 'Customer History Seller B'
$a = Create-ShopProduct -AccessToken $sellerA.accessToken -ShopName 'Customer History Shop A' -ShopSlug "customer-history-a-$timestamp" -ProductName 'Customer History Product A' -Price 100 -Stock 10 -NmId ([int64](8100000 + (Get-Random -Minimum 1 -Maximum 99999))) -Size 'A'
$b = Create-ShopProduct -AccessToken $sellerB.accessToken -ShopName 'Customer History Shop B' -ShopSlug "customer-history-b-$timestamp" -ProductName 'Customer History Product B' -Price 200 -Stock 7 -NmId ([int64](9100000 + (Get-Random -Minimum 1 -Maximum 99999))) -Size 'B'

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  shopId = $a.shop.id
  items = @(
    @{ productId = $a.product.id; variantId = $a.variantId; quantity = 2 },
    @{ productId = $b.product.id; variantId = $b.variantId; quantity = 3 }
  )
  customer = @{
    fullName = 'Customer History Smoke'
    phone = $phone
    email = $customerEmail
    address = '123 Customer History Street'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)
$trackedPhone = [uri]::EscapeDataString($checkout.customerPhone)

if (-not $checkout.checkoutCode) { throw 'Expected checkoutCode.' }
if (@($checkout.orders).Count -ne 2) { throw 'Expected two child orders.' }
if ($checkout.grandTotal -ne '800') { throw "Expected grandTotal 800, got $($checkout.grandTotal)" }

$history = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/customer/orders" -Headers $customerHeaders
$historyMatch = @($history.items | Where-Object { $_.checkoutCode -eq $checkout.checkoutCode })
if (@($historyMatch).Count -ne 1) { throw 'Customer history does not include checkout.' }

$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/customer/orders/$($checkout.checkoutCode)" -Headers $customerHeaders
if (@($detail.orders).Count -ne 2) { throw 'Customer detail does not show two child orders.' }
if ($detail.grandTotal -ne '800') { throw 'Customer detail grand total mismatch.' }

$publicReceipt = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/checkouts/$($checkout.checkoutCode)?phone=$trackedPhone"
if (@($publicReceipt.orders).Count -ne 2) { throw 'Public receipt lookup failed.' }

$wrongPhoneFailed = $false
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/checkouts/$($checkout.checkoutCode)?phone=wrong-phone" | Out-Null
} catch {
  $wrongPhoneFailed = $true
}
if (-not $wrongPhoneFailed) { throw 'Wrong phone should not access receipt.' }

$firstOrder = @($checkout.orders)[0]
$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($firstOrder.orderId)/track?phone=$trackedPhone"
if ($tracked.orderCode -ne $firstOrder.orderCode) { throw 'Individual order tracking failed.' }

[pscustomobject]@{
  baseUrl = $baseUrl
  checkoutCode = $checkout.checkoutCode
  grandTotal = $checkout.grandTotal
  childOrders = @($checkout.orders).Count
  historyContainsCheckout = @($historyMatch).Count -eq 1
  detailChildOrders = @($detail.orders).Count
  publicLookupChildOrders = @($publicReceipt.orders).Count
  wrongPhoneFailed = $wrongPhoneFailed
  trackedOrderCode = $tracked.orderCode
} | ConvertTo-Json -Compress
