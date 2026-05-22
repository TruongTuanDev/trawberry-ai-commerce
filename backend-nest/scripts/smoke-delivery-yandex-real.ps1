$ErrorActionPreference = 'Stop'

function Get-ConfigValue($name) {
  $processValue = [Environment]::GetEnvironmentVariable($name)
  if ($processValue) { return $processValue }
  $envPath = Join-Path $PSScriptRoot '..\.env'
  if (Test-Path $envPath) {
    $line = Get-Content $envPath | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if ($line) { return ($line -replace "^$name=", '').Trim() }
  }
  return ''
}

$mode = Get-ConfigValue 'DELIVERY_PROVIDER_MODE'
$enabled = Get-ConfigValue 'YANDEX_DELIVERY_ENABLED'
$token = Get-ConfigValue 'YANDEX_DELIVERY_TOKEN'

if ($mode -ne 'yandex' -or $enabled -ne 'true' -or [string]::IsNullOrWhiteSpace($token)) {
  [pscustomobject]@{
    skipped = $true
    reason = 'Yandex real mode env is not ready. Required: DELIVERY_PROVIDER_MODE=yandex, YANDEX_DELIVERY_ENABLED=true, YANDEX_DELIVERY_TOKEN.'
  } | ConvertTo-Json -Compress
  exit 0
}

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-yandex-real-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7900000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = if ($env:YANDEX_SMOKE_CUSTOMER_PHONE) { $env:YANDEX_SMOKE_CUSTOMER_PHONE } else { '+79990000002' }
$pickupAddress = if ($env:YANDEX_SMOKE_PICKUP_ADDRESS) { $env:YANDEX_SMOKE_PICKUP_ADDRESS } else { 'Moscow, Tverskaya 1' }
$dropoffAddress = if ($env:YANDEX_SMOKE_DROPOFF_ADDRESS) { $env:YANDEX_SMOKE_DROPOFF_ADDRESS } else { 'Moscow, Tverskaya 3' }

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
  fullName = 'Smoke Yandex Real Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Yandex Real Shop'
  slug = "smoke-yandex-real-shop-$timestamp"
  paymentInstructions = 'Transfer to account 123.'
} | ConvertTo-Json)

Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $headers -ContentType 'application/json' -Body (@{
  pickupAddress = $pickupAddress
  pickupCity = 'Moscow'
  pickupContactPhone = if ($env:YANDEX_SMOKE_PICKUP_PHONE) { $env:YANDEX_SMOKE_PICKUP_PHONE } else { '+79990000001' }
  pickupContactName = 'Delivery Ops'
  enabledCarriers = @('YANDEX', 'CDEK')
  defaultCarrier = 'YANDEX'
  sameCityPreferredCarrier = 'YANDEX'
  interCityPreferredCarrier = 'CDEK'
  fallbackCarrier = 'CDEK'
  defaultWeightGram = 500
  defaultLengthCm = 20
  defaultWidthCm = 15
  defaultHeightCm = 8
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Yandex Real Product'
  localTitle = 'Smoke Yandex Real Product'
  localDescription = 'Real Yandex smoke product'
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
      basePrice: 50,
      discountPrice: 49,
      stockQuantity: 1,
      reservedStock: 0,
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
    fullName = 'Smoke Yandex Real Customer'
    phone = $customerPhone
    email = "smoke-yandex-real-customer-$timestamp@example.com"
    address = $dropoffAddress
    note = 'Real Yandex smoke delivery'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Paid for real Yandex delivery smoke'
} | ConvertTo-Json)

$offers = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/offers" -Headers $headers -ContentType 'application/json' -Body (@{} | ConvertTo-Json)
$offer = @($offers.offers) | Where-Object { $_.provider -eq 'YANDEX' } | Select-Object -First 1
if (-not $offer) { throw 'Yandex real smoke did not receive a Yandex offer.' }

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments" -Headers $headers -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  selectedOfferId = $offer.id
} | ConvertTo-Json)
$accepted = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/accept" -Headers $headers
$refreshed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/refresh" -Headers $headers
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery" -Headers $headers

[pscustomobject]@{
  skipped = $false
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  paidStatus = $paid.paymentStatus
  offerProvider = $offer.provider
  shipmentProvider = $shipment.provider
  providerShipmentId = $shipment.providerShipmentId
  acceptedStatus = $accepted.internalStatus
  refreshedStatus = $refreshed.internalStatus
  trackingUrl = $detail.activeShipment.trackingUrl
} | ConvertTo-Json -Compress
