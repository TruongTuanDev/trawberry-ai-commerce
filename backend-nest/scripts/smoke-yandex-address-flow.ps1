$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-yandex-address-seller-$timestamp@example.com"
$customerEmail = "smoke-yandex-address-customer-$timestamp@example.com"
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

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Yandex Address Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  name = 'Smoke Yandex Address Shop'
  slug = "smoke-yandex-address-shop-$timestamp"
  paymentInstructions = 'Direct seller QR payment.'
} | ConvertTo-Json)

Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  pickupAddress = 'Tverskaya 1'
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
  defaultWeightGram = 900
  defaultLengthCm = 35
  defaultWidthCm = 25
  defaultHeightCm = 8
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Yandex Address Product'
  localTitle = 'Smoke Yandex Address Product'
  localDescription = 'Structured address smoke product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
  variants = @(@{ chrtId = $productNmId + 1000; basePrice = 349; discountPrice = 349; stockQuantity = 5 })
  images = @(@{ wbUrl = 'https://example.com/smoke-yandex-address.jpg'; localUrl = 'https://example.com/smoke-yandex-address.jpg'; isMain = $true; sortOrder = 0 })
} | ConvertTo-Json -Depth 6)

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $sellerHeaders -ContentType 'application/json' -Body '{}'

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
  fullName = 'Smoke Yandex Address Customer'
  role = 'CUSTOMER'
} | ConvertTo-Json) | Out-Null

$customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/customer/login" -ContentType 'application/json' -Body (@{
  identifier = $customerEmail
  password = $password
} | ConvertTo-Json)
$customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

$address = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/addresses" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  fullName = 'Smoke Yandex Address Customer'
  phone = $customerPhone
  country = 'Russia'
  countryCode = 'RU'
  city = 'Moscow'
  region = 'Moscow'
  district = 'Tverskoy District'
  street = 'Tverskaya'
  building = '12'
  entrance = '2'
  intercom = '45B'
  floor = '7'
  apartment = '73'
  postalCode = '101000'
  comment = 'Call 10 minutes before arrival'
  latitude = 55.765369
  longitude = 37.605192
  geoPrecision = 'BUILDING'
  geoProvider = 'MANUAL'
} | ConvertTo-Json)

Assert-True ($address.addressFullName -eq 'Moscow, Tverskaya, 12') "Unexpected addressFullName: $($address.addressFullName)"

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{ productId = $product.id; quantity = 1 })
  customer = @{
    fullName = ''
    phone = ''
    email = $customerEmail
    address = ''
    note = 'Use saved address'
  }
  addressId = $address.id
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)

$order = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $sellerHeaders
Assert-True ($order.dropoffAddressFullName -eq 'Moscow, Tverskaya, 12') 'Order did not snapshot structured dropoff fullname.'
Assert-True ($order.dropoffBuilding -eq '12') 'Order did not snapshot building.'

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  note = 'Paid for structured address smoke'
} | ConvertTo-Json) | Out-Null

$shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
  provider = 'YANDEX'
  manualYandexOrderId = "YA-ADDR-$timestamp"
  trackingUrl = "https://track.example/yandex-address/$timestamp"
  courierName = 'Courier Ivan'
  courierPhone = '+79991112233'
  deliveryPrice = 450
  estimatedDeliveryAt = (Get-Date).AddHours(4).ToString('o')
  packagePreset = 'FASHION_BAG'
} | ConvertTo-Json)

Assert-True ($shipment.dropoffAddressFullName -eq 'Moscow, Tverskaya, 12') 'Shipment did not inherit structured dropoff fullname.'
Assert-True ($shipment.dropoffEntrance -eq '2') 'Shipment did not inherit entrance.'

$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($tracked.customer.addressFullName -eq 'Moscow, Tverskaya, 12') 'Tracked order missing structured address fullname.'
Assert-True ($tracked.delivery.dropoffBuilding -eq '12') 'Tracked order missing structured building.'

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  orderId = $checkout.orderId
  addressId = $address.id
  dropoff = $tracked.customer.addressFullName
  finalShipmentStatus = $shipment.internalStatus
} | ConvertTo-Json -Compress
