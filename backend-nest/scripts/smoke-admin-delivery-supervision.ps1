$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-admin-delivery-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7200000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = "+7996$((Get-Random -Minimum 1000000 -Maximum 9999999))"

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

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Admin Delivery Seller'
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
  name = 'Smoke Admin Delivery Shop'
  slug = "smoke-admin-delivery-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Admin Delivery Product'
  localTitle = 'Smoke Admin Delivery Product'
  localDescription = 'Admin delivery smoke product'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now()),
      isActive: true,
      basePrice: 120,
      discountPrice: 99,
      stockQuantity: 10,
      reservedStock: 0,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-admin-delivery.jpg',
      localUrl: 'https://example.com/smoke-admin-delivery.jpg',
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
    fullName = 'Smoke Admin Delivery Customer'
    phone = $customerPhone
    email = "smoke-admin-delivery-customer-$timestamp@example.com"
    address = 'Lenina 10, Moscow'
    note = 'Admin delivery supervision smoke'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  note = 'Paid for admin delivery smoke'
} | ConvertTo-Json)
Assert-True ($paid.paymentStatus -eq 'PAID') 'Order was not marked PAID.'

$withoutDelivery = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/deliveries?paidWithoutDelivery=true&shopId=$($shop.id)" -Headers $adminHeaders
Assert-True (@($withoutDelivery.items | Where-Object { $_.orderId -eq $checkout.orderId }).Count -eq 1) 'Admin did not see paid order without delivery.'

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  trackingNumber = "YANDEX-ADMIN-$timestamp"
  trackingUrl = "https://track.example/admin-yandex/$timestamp"
  deliveryNote = 'Seller-created delivery for admin supervision.'
} | ConvertTo-Json)

$createdList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/deliveries?status=CREATED_MANUALLY&shopId=$($shop.id)" -Headers $adminHeaders
Assert-True (@($createdList.items | Where-Object { $_.deliveryShipmentId -eq $shipment.id }).Count -eq 1) 'Admin did not see created manual delivery.'

$override = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/deliveries/$($shipment.id)/mark-in-transit" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
  note = 'Admin verified carrier dashboard.'
} | ConvertTo-Json)
Assert-True ($override.internalStatus -eq 'IN_TRANSIT') "Admin override did not mark IN_TRANSIT: $($override.internalStatus)."

$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($tracked.delivery.status -eq 'IN_TRANSIT') "Customer tracking did not show IN_TRANSIT: $($tracked.delivery.status)."

$env:TARGET_SHIPMENT_ID = $shipment.id
$eventRaw = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.deliveryEvent.count({
    where: {
      deliveryShipmentId: process.env.TARGET_SHIPMENT_ID,
      actorRole: 'ADMIN',
      newStatus: 'IN_TRANSIT',
    },
  });
  console.log(JSON.stringify({ count }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
Remove-Item Env:TARGET_SHIPMENT_ID
$event = $eventRaw | ConvertFrom-Json
Assert-True ($event.count -gt 0) 'Admin delivery audit event was not recorded.'

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  shipmentId = $shipment.id
  paidWithoutDeliverySeen = $true
  createdSeen = $true
  adminOverrideStatus = $override.internalStatus
  auditEventCount = $event.count
} | ConvertTo-Json -Compress
