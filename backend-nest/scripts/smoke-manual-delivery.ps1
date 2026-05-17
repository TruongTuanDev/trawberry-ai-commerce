$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-manual-delivery-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7100000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = "+7997$((Get-Random -Minimum 1000000 -Maximum 9999999))"

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
  fullName = 'Smoke Manual Delivery Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Manual Delivery Shop'
  slug = "smoke-manual-delivery-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Manual Delivery Product'
  localTitle = 'Smoke Manual Delivery Product'
  localDescription = 'Manual delivery smoke product'
  categoryName = 'Smoke Category'
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
      wbUrl: 'https://example.com/smoke-manual-delivery.jpg',
      localUrl: 'https://example.com/smoke-manual-delivery.jpg',
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

$published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
Assert-True ($published.catalogStatus -eq 'PUBLISHED') 'Manual delivery smoke product was not published.'

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{ productId = $product.id; quantity = 1 })
  customer = @{
    fullName = 'Smoke Manual Delivery Customer'
    phone = $customerPhone
    email = "smoke-manual-delivery-customer-$timestamp@example.com"
    address = 'Lenina 10, Moscow'
    note = 'Manual delivery smoke'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Paid for manual delivery smoke'
} | ConvertTo-Json)
Assert-True ($paid.paymentStatus -eq 'PAID') 'Order was not marked PAID.'

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $headers -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  trackingNumber = "YANDEX-MANUAL-$timestamp"
  trackingUrl = "https://track.example/yandex/$timestamp"
  courierPhone = '+79991112233'
  deliveryNote = 'Seller created the Yandex shipment manually.'
} | ConvertTo-Json)
Assert-True ($shipment.internalStatus -eq 'CREATED_MANUALLY') "Expected CREATED_MANUALLY, got $($shipment.internalStatus)."

$inTransit = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-in-transit" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Courier picked up the order.'
} | ConvertTo-Json)
Assert-True ($inTransit.internalStatus -eq 'IN_TRANSIT') "Expected IN_TRANSIT, got $($inTransit.internalStatus)."

$trackedTransit = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($trackedTransit.delivery.provider -eq 'YANDEX') 'Tracking did not show YANDEX.'
Assert-True ($trackedTransit.delivery.status -eq 'IN_TRANSIT') "Tracking did not show IN_TRANSIT: $($trackedTransit.delivery.status)."

$delivered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-delivered" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Delivered to customer.'
} | ConvertTo-Json)
Assert-True ($delivered.internalStatus -eq 'DELIVERED') "Expected DELIVERED, got $($delivered.internalStatus)."

$trackedDelivered = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($trackedDelivered.delivery.status -eq 'DELIVERED') "Tracking did not show DELIVERED: $($trackedDelivered.delivery.status)."

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  shipmentId = $shipment.id
  provider = $shipment.provider
  inTransitStatus = $trackedTransit.delivery.status
  deliveredStatus = $trackedDelivered.delivery.status
} | ConvertTo-Json -Compress
