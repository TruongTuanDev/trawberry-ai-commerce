$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-orders-$timestamp@example.com"
$otherSellerEmail = "smoke-orders-other-$timestamp@example.com"
$customerEmail = "smoke-orders-customer-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](5000000 + (Get-Random -Minimum 1 -Maximum 99999))

function Approve-SellerProfile($userId) {
  $env:TARGET_USER_ID = $userId
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
}

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Orders Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$otherSellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $otherSellerEmail
  password = $password
  fullName = 'Smoke Orders Other Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $otherSellerRegister.userId

$customerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
  fullName = 'Smoke Orders Customer'
  role = 'USER'
} | ConvertTo-Json)

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Orders Shop'
  slug = "smoke-orders-shop-$timestamp"
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Orders Product'
  localTitle = 'Smoke Orders Product'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:SMOKE_CUSTOMER_ID = $customerRegister.userId
$env:SMOKE_SHOP_ID = $shop.id
$env:SMOKE_PRODUCT_TITLE = $product.wbTitle
$env:SMOKE_PRODUCT_SLUG = if ($product.seoSlug) { $product.seoSlug } else { "smoke-orders-product-$timestamp" }
$seedResult = @'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();

(async () => {
  const orderId = randomUUID();
  const orderNumber = `ORD-SMOKE-${Date.now()}`;
  const itemId = randomUUID();

  await prisma.order.create({
    data: {
      id: orderId,
      customerId: process.env.SMOKE_CUSTOMER_ID,
      shopId: process.env.SMOKE_SHOP_ID,
      orderNumber,
      status: 'NEW',
      paymentStatus: 'APPROVED',
      totalAmount: 99.99,
      shippingAddress: '123 Smoke Test Street',
      customerName: 'Smoke Orders Customer',
      customerPhone: '0123456789',
      customerEmail: 'smoke-orders-customer@example.com',
      shippingCost: 5,
      shippingMethodName: 'Courier',
      items: {
        create: {
          id: itemId,
          quantity: 1,
          priceAtPurchase: 94.99,
          productTitleSnapshot: process.env.SMOKE_PRODUCT_TITLE,
          productSlugSnapshot: process.env.SMOKE_PRODUCT_SLUG,
        },
      },
    },
  });

  console.log(JSON.stringify({ orderId, orderNumber }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node - | ConvertFrom-Json
Remove-Item Env:SMOKE_CUSTOMER_ID
Remove-Item Env:SMOKE_SHOP_ID
Remove-Item Env:SMOKE_PRODUCT_TITLE
Remove-Item Env:SMOKE_PRODUCT_SLUG

$list = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders?page=1&size=10&status=NEW&search=Smoke" -Headers $headers
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($seedResult.orderId)" -Headers $headers
$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($seedResult.orderId)/status" -Headers $headers -ContentType 'application/json' -Body (@{
  status = 'ASSEMBLING'
} | ConvertTo-Json)

$otherSellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $otherSellerEmail
  password = $password
} | ConvertTo-Json)
$otherHeaders = @{ Authorization = "Bearer $($otherSellerLogin.accessToken)" }
$crossShopStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders" -Headers $otherHeaders -ErrorAction Stop | Out-Null
  $crossShopStatus = 'ALLOWED'
} catch {
  $crossShopStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  orderId = $seedResult.orderId
  orderNumber = $seedResult.orderNumber
  listItems = @($list.items).Count
  listTotal = $list.meta.total
  detailStatus = $detail.status
  detailPaymentStatus = $detail.paymentStatus
  updatedStatus = $updated.status
  searchOrderMatched = @($list.items | Where-Object { $_.id -eq $seedResult.orderId }).Count -gt 0
  crossShopStatus = $crossShopStatus
} | ConvertTo-Json -Compress
