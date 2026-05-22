$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-payment-choice-$timestamp@example.com"
$password = 'password123'
$buyerPhone = "+7995$((Get-Random -Minimum 1000000 -Maximum 9999999))"
$productNmId = [int64](7400000 + (Get-Random -Minimum 1 -Maximum 99999))
$tmpImage = Join-Path ([System.IO.Path]::GetTempPath()) "payment-choice-$timestamp.png"

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

function Assert-Equal($actual, $expected, $message) {
  if ($actual -ne $expected) {
    throw "$message. Expected '$expected' but got '$actual'."
  }
}

$tmpProof = Join-Path ([System.IO.Path]::GetTempPath()) "delivery-paid-$timestamp.png"
$pngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=')
[System.IO.File]::WriteAllBytes($tmpProof, $pngBytes)
[System.IO.File]::WriteAllBytes($tmpImage, $pngBytes)

try {
  $register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
    fullName = 'Smoke Payment Choice Seller'
    role = 'SELLER'
  } | ConvertTo-Json)
  Approve-SellerProfile $register.userId

  $sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
  } | ConvertTo-Json)
  $sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    name = 'Smoke Payment Choice Shop'
    slug = "smoke-payment-choice-shop-$timestamp"
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/payment-settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    paymentMode = 'STATIC_QR'
    status = 'READY'
    bankName = 'T-Bank'
    recipientName = 'Smoke Payment Choice Seller'
    recipientPhone = '+79990000031'
    recipientAccount = '40817810000000000999'
    sbpPhone = '+79990000031'
    paymentInstruction = 'Pay the seller directly by QR/SBP.'
    allowPrepaidQr = $true
    allowPayOnDeliverySellerQr = $true
    allowDepositPayment = $true
    depositPercent = 30
    codMaxOrderAmount = 5000
    yandexCardOnDeliveryStatus = 'NOT_CONFIGURED'
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    pickupAddress = 'Tverskaya 1, Moscow'
    pickupCity = 'Moscow'
    pickupPostalCode = '101000'
    pickupContactPhone = '+74950000000'
    pickupContactName = 'Seller Ops'
    pickupLatitude = 55.7558
    pickupLongitude = 37.6176
    enabledCarriers = @('YANDEX','CDEK')
    defaultCarrier = 'YANDEX'
    sameCityPreferredCarrier = 'YANDEX'
    interCityPreferredCarrier = 'CDEK'
    fallbackCarrier = 'CDEK'
    defaultWeightGram = 900
    defaultLengthCm = 30
    defaultWidthCm = 20
    defaultHeightCm = 8
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    wbNmId = $productNmId
    wbTitle = 'Smoke Payment Choice Product'
    localTitle = 'Smoke Payment Choice Product'
    localDescription = 'Payment method choice smoke product'
    categoryName = 'Smoke Category'
    visibility = 'ACTIVE'
    variants = @(@{
      chrtId = $productNmId + 1
      techSize = 'Default'
      basePrice = 199
      stockQuantity = 5
      trackInventory = $true
      isActive = $true
    })
  } | ConvertTo-Json -Depth 6)
  $null = & curl.exe --ipv4 -s -X POST `
    -H "Authorization: Bearer $($sellerLogin.accessToken)" `
    -F "files=@$tmpImage;type=image/png" `
    "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" | ConvertFrom-Json
  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $sellerHeaders -ContentType 'application/json' -Body '{}'

  $codCheckout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(@{ productId = $product.id; quantity = 1 })
    customer = @{
      fullName = 'Smoke COD Buyer'
      phone = $buyerPhone
      email = "smoke-cod-buyer-$timestamp@example.com"
      address = 'Lenina 10, Moscow'
      note = 'Pay on delivery seller QR smoke'
    }
    paymentMethod = 'PAY_ON_DELIVERY_SELLER_QR'
  } | ConvertTo-Json -Depth 6)
  Assert-Equal $codCheckout.paymentStatus 'PAY_ON_DELIVERY_SELECTED' 'Checkout should start in pay-on-delivery selected state'

  $accepted = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($codCheckout.orderId)/confirm" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Seller accepts pay-on-delivery flow.'
  } | ConvertTo-Json)
  Assert-Equal $accepted.paymentStatus 'SELLER_ACCEPTED_PAY_ON_DELIVERY' 'Seller acceptance should move order into accepted COD state'
  Assert-Equal $accepted.status 'READY_TO_CREATE_YANDEX' 'Seller acceptance should move order to READY_TO_CREATE_YANDEX'

  $shipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($codCheckout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    provider = 'YANDEX'
    manualYandexOrderId = "YANDEX-$timestamp"
    yandexClaimId = "claim-$timestamp"
    trackingUrl = "https://track.example/yandex/$timestamp"
    courierName = 'Courier Ivan'
    courierPhone = '+79991112233'
    deliveryPrice = 450
    estimatedDeliveryAt = (Get-Date).AddHours(2).ToString('o')
    packagePreset = 'FASHION_BAG'
    packageWeightGram = 700
    packageLengthCm = 35
    packageWidthCm = 25
    packageHeightCm = 8
    pickupAddress = 'Tverskaya 1, Moscow'
  } | ConvertTo-Json)

  $delivered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($codCheckout.orderId)/delivery/shipments/$($shipment.id)/mark-delivered" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Delivered to buyer.'
  } | ConvertTo-Json)
  Assert-Equal $delivered.internalStatus 'DELIVERED' 'Shipment should be delivered'

  $buyerMarked = & curl.exe --ipv4 -s -X POST `
    -F "phone=$buyerPhone" `
    -F "buyerNote=Paid after delivery by seller QR." `
    "$baseUrl/api/public/orders/$($codCheckout.orderId)/payment-proof" | ConvertFrom-Json
  Assert-Equal $buyerMarked.paymentStatus 'BUYER_MARKED_DELIVERY_PAID' 'Buyer mark-paid should update delivery payment status'

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = 'demo-admin@trawberry.local'
    password = 'DemoAdmin123!'
  } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }
  $adminQueue = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/payments?page=1&size=10&shopId=$($shop.id)&status=BUYER_MARKED_DELIVERY_PAID" -Headers $adminHeaders
  if (@($adminQueue.items | Where-Object { $_.id -eq $codCheckout.orderId }).Count -le 0) {
    throw 'Admin payment supervision should include the buyer-marked delivery-paid order.'
  }

  $final = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($codCheckout.orderId)/confirm" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Seller confirmed final payment after delivery.'
  } | ConvertTo-Json)
  Assert-Equal $final.paymentStatus 'SELLER_CONFIRMED_DELIVERY_PAYMENT' 'Seller final confirm should close delivery payment'

  $yandexUnavailable = $false
  try {
    Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
      shopId = $shop.id
      items = @(@{ productId = $product.id; quantity = 1 })
      customer = @{
        fullName = 'Future Yandex COD Buyer'
        phone = '+79950001111'
        email = "future-yandex-cod-$timestamp@example.com"
        address = 'Prospekt Mira 5, Moscow'
      }
      paymentMethod = 'YANDEX_CARD_ON_DELIVERY'
    } | ConvertTo-Json -Depth 6) | Out-Null
  } catch {
    $errorText = $_.ErrorDetails.Message
    if (-not $errorText) {
      $errorText = $_.Exception.Message
    }
    if ($errorText -match 'SHOP_PAYMENT_METHOD_NOT_SUPPORTED') {
      $yandexUnavailable = $true
    } else {
      throw
    }
  }

  $cashUnavailable = $false
  try {
    Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
      shopId = $shop.id
      items = @(@{ productId = $product.id; quantity = 1 })
      customer = @{
        fullName = 'Cash Courier Buyer'
        phone = '+79950002222'
        email = "cash-courier-$timestamp@example.com"
        address = 'Prospekt Mira 6, Moscow'
      }
      paymentMethod = 'CASH_COURIER_COLLECTION'
    } | ConvertTo-Json -Depth 6) | Out-Null
  } catch {
    $errorText = $_.ErrorDetails.Message
    if (-not $errorText) {
      $errorText = $_.Exception.Message
    }
    if ($errorText -match 'SHOP_PAYMENT_METHOD_NOT_SUPPORTED') {
      $cashUnavailable = $true
    } else {
      throw
    }
  }

  [pscustomobject]@{
    baseUrl = $baseUrl
    shopId = $shop.id
    orderId = $codCheckout.orderId
    codCheckoutStatus = $codCheckout.paymentStatus
    sellerAcceptedStatus = $accepted.paymentStatus
    deliveredStatus = $delivered.internalStatus
    buyerMarkedStatus = $buyerMarked.paymentStatus
    finalStatus = $final.paymentStatus
    adminQueueHasItem = @($adminQueue.items | Where-Object { $_.id -eq $codCheckout.orderId }).Count -gt 0
    yandexCardUnavailable = $yandexUnavailable
    cashCourierUnavailable = $cashUnavailable
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path $tmpImage) {
    Remove-Item $tmpImage -Force
  }
  if (Test-Path $tmpProof) {
    Remove-Item $tmpProof -Force
  }
}
