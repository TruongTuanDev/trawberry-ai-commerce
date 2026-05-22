$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-delivery-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7000000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = "+7999$((Get-Random -Minimum 1000000 -Maximum 9999999))"

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
  fullName = 'Smoke Delivery Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Delivery Shop'
  slug = "smoke-delivery-shop-$timestamp"
  paymentInstructions = 'Transfer to account 123.'
} | ConvertTo-Json)

$settings = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $headers -ContentType 'application/json' -Body (@{
  pickupAddress = 'Tverskaya 1'
  pickupCity = 'Moscow'
  pickupPostalCode = '101000'
  pickupContactPhone = '+74950000000'
  pickupContactName = 'Delivery Ops'
  enabledCarriers = @('CDEK', 'YANDEX')
  defaultCarrier = 'YANDEX'
  sameCityPreferredCarrier = 'YANDEX'
  interCityPreferredCarrier = 'CDEK'
  fallbackCarrier = 'CDEK'
  defaultWeightGram = 1200
  defaultLengthCm = 30
  defaultWidthCm = 20
  defaultHeightCm = 10
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Delivery Product'
  localTitle = 'Smoke Delivery Product'
  localDescription = 'Delivery-enabled product'
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
      wbUrl: 'https://example.com/smoke-delivery.jpg',
      localUrl: 'https://example.com/smoke-delivery.jpg',
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
  items = @(
    @{
      productId = $product.id
      quantity = 1
    }
  )
  customer = @{
    fullName = 'Smoke Delivery Customer'
    phone = $customerPhone
    email = "smoke-delivery-customer-$timestamp@example.com"
    address = 'Lenina 10, Moscow'
    note = 'Yandex-first same-city mock delivery smoke'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Paid for delivery smoke'
} | ConvertTo-Json)

$offers = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/offers" -Headers $headers -ContentType 'application/json' -Body (@{} | ConvertTo-Json)
$recommendedOffer = @($offers.offers) | Where-Object { $_.isRecommended -eq $true } | Select-Object -First 1
if (-not $recommendedOffer -or $recommendedOffer.provider -ne 'YANDEX') {
  throw "Expected Yandex recommended offer for same-city order."
}
$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments" -Headers $headers -ContentType 'application/json' -Body (@{
  provider = $recommendedOffer.provider
  selectedOfferId = $recommendedOffer.id
} | ConvertTo-Json)
$refreshed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($shipment.id)/refresh" -Headers $headers
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery" -Headers $headers
$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  orderId = $checkout.orderId
  paidStatus = $paid.paymentStatus
  settingsCarrierCount = @($settings.enabledCarriers).Count
  offerCount = @($offers.offers).Count
  recommendedProvider = $recommendedOffer.provider
  shipmentProvider = $shipment.provider
  shipmentStatus = $shipment.internalStatus
  refreshedStatus = $refreshed.internalStatus
  detailProvider = $detail.activeShipment.provider
  detailTrackingUrl = $detail.activeShipment.trackingUrl
  trackedProvider = $tracked.delivery.provider
  trackedStatus = $tracked.delivery.status
  trackedTrackingUrl = $tracked.delivery.trackingUrl
} | ConvertTo-Json -Compress
