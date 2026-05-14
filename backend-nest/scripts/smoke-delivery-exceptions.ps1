$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-delivery-exception-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7300000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = "+7995$((Get-Random -Minimum 1000000 -Maximum 9999999))"

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
  fullName = 'Smoke Delivery Exception Seller'
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
  name = 'Smoke Delivery Exception Shop'
  slug = "smoke-delivery-exception-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Delivery Exception Product'
  localTitle = 'Smoke Delivery Exception Product'
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
      wbUrl: 'https://example.com/smoke-delivery-exception.jpg',
      localUrl: 'https://example.com/smoke-delivery-exception.jpg',
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
    fullName = 'Smoke Delivery Exception Customer'
    phone = $customerPhone
    email = "smoke-delivery-exception-customer-$timestamp@example.com"
    address = 'Lenina 10, Moscow'
    note = 'Delivery exception smoke'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  note = 'Paid for delivery exception smoke'
} | ConvertTo-Json)
Assert-True ($paid.paymentStatus -eq 'PAID') 'Order was not marked PAID.'

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  trackingNumber = "YANDEX-EXCEPTION-$timestamp"
  trackingUrl = "https://track.example/yandex-exception/$timestamp"
  courierPhone = '+79991112233'
  deliveryNote = 'Seller created the Yandex shipment manually.'
} | ConvertTo-Json)
Assert-True ($shipment.internalStatus -eq 'CREATED_MANUALLY') "Expected CREATED_MANUALLY, got $($shipment.internalStatus)."

$inTransit = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-in-transit" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  note = 'Courier picked up the order.'
} | ConvertTo-Json)
Assert-True ($inTransit.internalStatus -eq 'IN_TRANSIT') "Expected IN_TRANSIT, got $($inTransit.internalStatus)."

$failed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-failed" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  reasonCode = 'CUSTOMER_UNAVAILABLE'
  reasonText = 'Courier could not reach customer.'
  customerVisibleMessage = 'Courier could not reach you. Support will help arrange the next step.'
} | ConvertTo-Json)
Assert-True ($failed.internalStatus -eq 'FAILED') "Expected FAILED, got $($failed.internalStatus)."

$trackedFailed = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($trackedFailed.delivery.status -eq 'FAILED') "Tracking did not show FAILED: $($trackedFailed.delivery.status)."
Assert-True ($trackedFailed.delivery.customerVisibleMessage -like '*Courier could not reach you*') 'Tracking did not show customer-visible message.'

$exceptions = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/deliveries?exceptionOnly=true" -Headers $adminHeaders
Assert-True (@($exceptions.items | Where-Object { $_.deliveryShipmentId -eq $shipment.id }).Count -eq 1) 'Admin exception filter did not include failed shipment.'

$adminComment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/deliveries/$($shipment.id)/comments" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
  visibility = 'INTERNAL'
  message = 'Internal admin note must stay hidden from customer.'
} | ConvertTo-Json)
Assert-True (@($adminComment.comments).Count -ge 1) 'Admin comment was not recorded.'

$trackedAfterInternal = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ((($trackedAfterInternal | ConvertTo-Json -Depth 10) -notlike '*Internal admin note*')) 'Customer tracking leaked internal admin comment.'

$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/admin/deliveries/$($shipment.id)/customer-message" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
  customerVisibleMessage = 'Admin updated delivery message for the customer.'
} | ConvertTo-Json)
Assert-True ($updated.customerVisibleMessage -eq 'Admin updated delivery message for the customer.') 'Admin customer message was not updated.'

$trackedUpdated = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($trackedUpdated.delivery.customerVisibleMessage -eq 'Admin updated delivery message for the customer.') 'Tracking did not show updated customer message.'

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  shipmentId = $shipment.id
  failedStatus = $trackedFailed.delivery.status
  updatedMessage = $trackedUpdated.delivery.customerVisibleMessage
} | ConvertTo-Json -Compress
