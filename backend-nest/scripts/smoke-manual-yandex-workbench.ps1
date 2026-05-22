$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-yandex-workbench-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7400000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = "+7998$((Get-Random -Minimum 1000000 -Maximum 9999999))"

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
  fullName = 'Smoke Yandex Workbench Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Manual Yandex Shop'
  slug = "smoke-manual-yandex-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
} | ConvertTo-Json)

Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $headers -ContentType 'application/json' -Body (@{
  pickupAddress = 'Tverskaya 1, Moscow'
  pickupCity = 'Moscow'
  pickupPostalCode = '101000'
  pickupContactPhone = '+74950000000'
  pickupContactName = 'Seller Ops'
  pickupLatitude = 55.7558
  pickupLongitude = 37.6176
  enabledCarriers = @('CDEK', 'YANDEX')
  defaultCarrier = 'YANDEX'
  sameCityPreferredCarrier = 'YANDEX'
  interCityPreferredCarrier = 'CDEK'
  fallbackCarrier = 'CDEK'
  defaultWeightGram = 1200
  defaultLengthCm = 36
  defaultWidthCm = 26
  defaultHeightCm = 12
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Manual Yandex Product'
  localTitle = 'Smoke Manual Yandex Product'
  localDescription = 'Manual Yandex workbench smoke product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
  variants = @(@{ chrtId = $productNmId + 1000; basePrice = 199; discountPrice = 199; stockQuantity = 5 })
  images = @(@{ wbUrl = 'https://example.com/smoke-manual-yandex.jpg'; localUrl = 'https://example.com/smoke-manual-yandex.jpg'; isMain = $true; sortOrder = 0 })
} | ConvertTo-Json -Depth 6)

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{ productId = $product.id; quantity = 1 })
  customer = @{
    fullName = 'Smoke Manual Yandex Customer'
    phone = $customerPhone
    email = "smoke-manual-yandex-customer-$timestamp@example.com"
    address = 'Lenina 10, Moscow'
    latitude = 55.751244
    longitude = 37.618423
    note = 'Manual Yandex smoke'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Paid for manual Yandex smoke'
} | ConvertTo-Json)
Assert-True ($paid.paymentStatus -eq 'PAID') 'Order was not marked PAID.'
Assert-True ($paid.status -eq 'READY_TO_CREATE_YANDEX') "Expected READY_TO_CREATE_YANDEX, got $($paid.status)."

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $headers -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  manualYandexOrderId = "YANDEX-MANUAL-$timestamp"
  yandexClaimId = "claim-$timestamp"
  trackingNumber = "TRACK-$timestamp"
  trackingUrl = "https://track.example/yandex/$timestamp"
  courierName = 'Courier Ivan'
  courierPhone = '+79991112233'
  deliveryPrice = 450
  estimatedDeliveryAt = (Get-Date).AddHours(3).ToString('o')
  packagePreset = 'FASHION_BAG'
  packageWeightGram = 800
  packageLengthCm = 35
  packageWidthCm = 25
  packageHeightCm = 8
  deliveryNote = 'Created in Yandex manually.'
} | ConvertTo-Json)
Assert-True ($shipment.internalStatus -eq 'YANDEX_MANUAL_CREATED') "Expected YANDEX_MANUAL_CREATED, got $($shipment.internalStatus)."

$assigned = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-courier-assigned" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Courier assigned.'
  courierName = 'Courier Ivan'
  courierPhone = '+79991112233'
} | ConvertTo-Json)
Assert-True ($assigned.internalStatus -eq 'COURIER_ASSIGNED') "Expected COURIER_ASSIGNED, got $($assigned.internalStatus)."

$pickedUp = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-picked-up" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Picked up from warehouse.'
} | ConvertTo-Json)
Assert-True ($pickedUp.internalStatus -eq 'PICKED_UP') "Expected PICKED_UP, got $($pickedUp.internalStatus)."

$onTheWay = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-in-transit" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'On the way.'
} | ConvertTo-Json)
Assert-True ($onTheWay.internalStatus -eq 'ON_THE_WAY') "Expected ON_THE_WAY, got $($onTheWay.internalStatus)."

$trackedTransit = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($trackedTransit.delivery.provider -eq 'YANDEX') 'Tracking did not show YANDEX.'
Assert-True ($trackedTransit.delivery.status -eq 'ON_THE_WAY') "Tracking did not show ON_THE_WAY: $($trackedTransit.delivery.status)."

$delivered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/mark-delivered" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Delivered to customer.'
} | ConvertTo-Json)
Assert-True ($delivered.internalStatus -eq 'DELIVERED') "Expected DELIVERED, got $($delivered.internalStatus)."

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  shipmentId = $shipment.id
  finalStatus = $delivered.internalStatus
} | ConvertTo-Json -Compress
