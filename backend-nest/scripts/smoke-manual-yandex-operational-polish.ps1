$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-yandex-polish-seller-$timestamp@example.com"
$customerEmail = "smoke-yandex-polish-customer-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7800000 + (Get-Random -Minimum 1 -Maximum 99999))
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

$adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = 'demo-admin@trawberry.local'
  password = 'DemoAdmin123!'
} | ConvertTo-Json)
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Manual Yandex Polish Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  name = 'Smoke Manual Yandex Polish Shop'
  slug = "smoke-manual-yandex-polish-shop-$timestamp"
  paymentInstructions = 'Pay seller directly.'
} | ConvertTo-Json)

Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/payment-settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  paymentMode = 'STATIC_QR'
  status = 'READY'
  bankName = 'T-Bank'
  recipientName = 'Smoke Manual Yandex Polish Seller'
  recipientPhone = '+79990000099'
  recipientAccount = '40817810000000000990'
  sbpPhone = '+79990000099'
  paymentInstruction = 'Pay seller directly by QR.'
  allowPrepaidQr = $true
} | ConvertTo-Json)

Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
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

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Manual Yandex Polish Product'
  localTitle = 'Smoke Manual Yandex Polish Product'
  localDescription = 'Operational polish smoke product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
  variants = @(@{ chrtId = $productNmId + 1000; basePrice = 219; discountPrice = 219; stockQuantity = 5 })
  images = @(@{ wbUrl = 'https://example.com/smoke-manual-yandex-polish.jpg'; localUrl = 'https://example.com/smoke-manual-yandex-polish.jpg'; isMain = $true; sortOrder = 0 })
} | ConvertTo-Json -Depth 6)

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $sellerHeaders -ContentType 'application/json' -Body '{}'

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
  fullName = 'Smoke Manual Yandex Polish Customer'
  role = 'CUSTOMER'
} | ConvertTo-Json) | Out-Null

$customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/customer/login" -ContentType 'application/json' -Body (@{
  identifier = $customerEmail
  password = $password
} | ConvertTo-Json)
$customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

$address = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/addresses" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  fullName = 'Smoke Manual Yandex Polish Customer'
  phone = $customerPhone
  country = 'Russia'
  countryCode = 'RU'
  city = 'Moscow'
  region = 'Moscow'
  street = 'Tverskaya'
  building = '18'
  entrance = '2'
  intercom = '45'
  floor = '6'
  apartment = '28'
  comment = 'Leave at concierge'
  latitude = 55.765369
  longitude = 37.605192
  geoPrecision = 'MANUAL_PIN'
  geoProvider = 'MANUAL'
} | ConvertTo-Json)

Assert-True ($address.yandexManualReady -eq $true) 'Expected address to be manual-ready.'

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{ productId = $product.id; quantity = 1 })
  addressId = $address.id
  paymentMethod = 'PREPAID_SELLER_QR'
  customer = @{
    fullName = ''
    phone = ''
    address = ''
  }
} | ConvertTo-Json -Depth 6)

Assert-True ($checkout.addressGeoReadiness.isYandexManualReady -eq $true) 'Checkout should keep manual-ready status.'

$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  note = 'Paid for manual Yandex operational polish smoke'
} | ConvertTo-Json)
Assert-True ($paid.status -eq 'READY_TO_CREATE_YANDEX') "Expected READY_TO_CREATE_YANDEX, got $($paid.status)."

$sellerOrder = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $sellerHeaders
Assert-True ($sellerOrder.customer.name -eq 'Smoke Manual Yandex Polish Customer') 'Seller order detail missing customer name.'
Assert-True ($sellerOrder.dropoffAddressFullName -like '*Moscow*') 'Seller order detail missing structured dropoff.'
Assert-True ($sellerOrder.dropoffGeoReadiness.isYandexManualReady -eq $true) 'Expected dropoff manual readiness.'

$missingBefore = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/deliveries?status=MISSING_YANDEX_ORDER_ID&search=$([uri]::EscapeDataString($checkout.orderCode))" -Headers $adminHeaders
Assert-True (($missingBefore.items | Measure-Object).Count -ge 1) 'Expected admin missing Yandex ID queue to include order.'

$reminder = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/deliveries/$($checkout.orderId)/remind-yandex" -Headers $adminHeaders -ContentType 'application/json' -Body '{}'
Assert-True ($reminder.reminderCreated -eq $true) 'Expected reminder to be created.'

$sellerOrderAfterReminder = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $sellerHeaders
Assert-True ($null -ne $sellerOrderAfterReminder.latestYandexReminder) 'Expected seller order detail to expose latest Yandex reminder.'

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
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
Assert-True ($shipment.manualYandexOrderId -eq "YANDEX-MANUAL-$timestamp") 'Expected shipment to persist manualYandexOrderId.'

$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($tracked.delivery.manualYandexOrderId -eq "YANDEX-MANUAL-$timestamp") 'Expected customer tracking to show Yandex order id.'

$missingAfter = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/deliveries?status=MISSING_YANDEX_ORDER_ID&search=$([uri]::EscapeDataString($checkout.orderCode))" -Headers $adminHeaders
Assert-True (($missingAfter.items | Measure-Object).Count -eq 0) 'Expected admin missing Yandex ID queue to exclude order after ID save.'

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  orderCode = $checkout.orderCode
  reminderCreated = $reminder.reminderCreated
  yandexOrderId = $shipment.manualYandexOrderId
} | ConvertTo-Json -Compress
