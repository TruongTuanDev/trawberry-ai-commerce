$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-admin-dashboard-$timestamp@example.com"
$pendingSellerEmail = "smoke-admin-dashboard-pending-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7500000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = "+7993$((Get-Random -Minimum 1000000 -Maximum 9999999))"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function Approve-SellerProfile($userId) {
  $env:TARGET_USER_ID = $userId
@'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.sellerProfile.update({
    where: { userId: process.env.TARGET_USER_ID },
    data: { approvalStatus: 'APPROVED', approvedAt: new Date() },
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

$pendingSeller = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $pendingSellerEmail
  password = $password
  fullName = 'Smoke Pending Dashboard Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Assert-True ($pendingSeller.userId) 'Pending seller was not created.'

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Admin Dashboard Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = 'demo-admin@trawberry.local'
  password = 'DemoAdmin123!'
} | ConvertTo-Json)
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  name = 'Smoke Admin Dashboard Shop'
  slug = "smoke-admin-dashboard-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Admin Dashboard Product'
  localTitle = 'Smoke Admin Dashboard Product'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  await prisma.productVariant.createMany({
    data: [
      {
        id: randomUUID(),
        productId: process.env.TARGET_PRODUCT_ID,
        chrtId: BigInt(Date.now()),
        isActive: true,
        basePrice: 120,
        discountPrice: 99,
        stockQuantity: 1,
        reservedStock: 0,
        lowStockThreshold: 5,
      },
      {
        id: randomUUID(),
        productId: process.env.TARGET_PRODUCT_ID,
        chrtId: BigInt(Date.now() + 1),
        isActive: true,
        basePrice: 120,
        discountPrice: 99,
        stockQuantity: 0,
        reservedStock: 0,
        lowStockThreshold: 5,
      },
    ],
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-admin-dashboard.jpg',
      localUrl: 'https://example.com/smoke-admin-dashboard.jpg',
      isMain: true,
      sortOrder: 0,
    },
  });
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
Remove-Item Env:TARGET_PRODUCT_ID

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{ productId = $product.id; quantity = 1 })
  customer = @{
    fullName = 'Smoke Admin Dashboard Customer'
    phone = $customerPhone
    email = "smoke-admin-dashboard-customer-$timestamp@example.com"
    address = 'Lenina 10, Moscow'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  note = 'Paid for admin dashboard smoke'
} | ConvertTo-Json)
Assert-True ($paid.paymentStatus -eq 'PAID') 'Order was not marked paid.'

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  trackingNumber = "DASHBOARD-$timestamp"
  trackingUrl = "https://track.example/dashboard/$timestamp"
} | ConvertTo-Json)

$failed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-failed" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  reasonCode = 'CUSTOMER_UNAVAILABLE'
  customerVisibleMessage = 'Courier could not reach you.'
} | ConvertTo-Json)
Assert-True ($failed.internalStatus -eq 'FAILED') 'Delivery was not marked failed.'

$summary = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/dashboard/summary" -Headers $adminHeaders
Assert-True ($summary.orders.total -gt 0) 'Dashboard total orders count was empty.'
Assert-True ($summary.sellers.pending -gt 0) 'Dashboard pending sellers count was empty.'
Assert-True ($summary.inventory.lowStock -gt 0) 'Dashboard low stock count was empty.'
Assert-True ($summary.inventory.outOfStock -gt 0) 'Dashboard out of stock count was empty.'
Assert-True ($summary.deliveries.exceptions -gt 0) 'Dashboard delivery exceptions count was empty.'

$forbiddenStatus = $null
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/dashboard/summary" -Headers $sellerHeaders | Out-Null
} catch {
  $forbiddenStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($forbiddenStatus -eq 403) "Expected seller dashboard access 403, got $forbiddenStatus."

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  pendingSellers = $summary.sellers.pending
  lowStock = $summary.inventory.lowStock
  outOfStock = $summary.inventory.outOfStock
  deliveryExceptions = $summary.deliveries.exceptions
  sellerAccessStatus = $forbiddenStatus
} | ConvertTo-Json -Compress
