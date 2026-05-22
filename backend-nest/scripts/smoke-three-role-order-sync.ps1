$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-three-role-seller-$timestamp@example.com"
$sellerPassword = 'password123'
$customerEmail = "smoke-three-role-customer-$timestamp@example.com"
$customerPassword = 'password123'
$buyerPhone = "+7993$((Get-Random -Minimum 1000000 -Maximum 9999999))"
$productNmId = [int64](8200000 + (Get-Random -Minimum 1 -Maximum 99999))
$proofPath = Join-Path ([System.IO.Path]::GetTempPath()) "three-role-proof-$timestamp.png"
$pngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=')
[System.IO.File]::WriteAllBytes($proofPath, $pngBytes)

function Assert-Equal($actual, $expected, $message) {
  if ($actual -ne $expected) {
    throw "$message. Expected '$expected' but got '$actual'."
  }
}

try {
  $seller = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $sellerPassword
    fullName = 'Smoke Three Role Seller'
    role = 'SELLER'
  } | ConvertTo-Json)

  $sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $sellerPassword
  } | ConvertTo-Json)
  $sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

  $null = Invoke-RestMethod -Method Put -Uri "$baseUrl/api/seller/onboarding/profile" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    legalType = 'IP'
    legalName = 'Smoke Three Role Seller IP'
    inn = '123456789012'
    ogrn = '1234567890123'
    legalAddress = 'Moscow'
    contactName = 'Smoke Three Role Seller'
    contactPhone = '+79990000074'
    contactEmail = $sellerEmail
  } | ConvertTo-Json)

  $document = & curl.exe --ipv4 -s -X POST `
    -H "Authorization: Bearer $($sellerLogin.accessToken)" `
    -F "documentType=INN" `
    -F "file=@$proofPath;type=application/pdf;filename=three-role.pdf" `
    "$baseUrl/api/seller/onboarding/documents" | ConvertFrom-Json

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = 'demo-admin@trawberry.local'
    password = 'DemoAdmin123!'
  } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/sellers/$($seller.userId)/documents/$($document.id)/approve" -Headers $adminHeaders -ContentType 'application/json' -Body '{}'
  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/sellers/$($seller.userId)/approve" -Headers $adminHeaders -ContentType 'application/json' -Body '{}'

  $approvedList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/sellers?status=APPROVED&q=$([uri]::EscapeDataString($sellerEmail))" -Headers $adminHeaders
  if (@($approvedList.items | Where-Object { $_.userId -eq $seller.userId }).Count -lt 1) {
    throw 'Approved seller should appear in admin approved seller list.'
  }

  $pendingSeller = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = "smoke-three-role-pending-$timestamp@example.com"
    password = $sellerPassword
    fullName = 'Pending Sync Seller'
    role = 'SELLER'
  } | ConvertTo-Json)
  $pendingList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/sellers?status=PENDING&q=$([uri]::EscapeDataString($pendingSeller.email))" -Headers $adminHeaders
  if (@($pendingList.items | Where-Object { $_.userId -eq $pendingSeller.userId }).Count -lt 1) {
    throw 'Pending seller should appear in admin pending seller list.'
  }

  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    name = 'Smoke Three Role Shop'
    slug = "smoke-three-role-shop-$timestamp"
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/payment-settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    paymentMode = 'STATIC_QR'
    status = 'READY'
    bankName = 'T-Bank'
    recipientName = 'Smoke Three Role Seller'
    recipientPhone = '+79990000074'
    recipientAccount = '40817810000000000774'
    sbpPhone = '+79990000074'
    paymentInstruction = 'Pay seller directly by QR.'
    allowPrepaidQr = $true
    allowPayOnDeliverySellerQr = $true
    allowDepositPayment = $false
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/delivery/settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    pickupAddress = 'Tverskaya Street 7, Moscow'
    pickupCity = 'Moscow'
    pickupPostalCode = '125009'
    pickupContactPhone = '+79990000074'
    pickupContactName = 'Smoke Three Role Seller'
    enabledCarriers = @('YANDEX','CDEK')
    defaultCarrier = 'YANDEX'
    sameCityPreferredCarrier = 'YANDEX'
    interCityPreferredCarrier = 'CDEK'
    fallbackCarrier = 'CDEK'
    defaultWeightGram = 700
    defaultLengthCm = 35
    defaultWidthCm = 25
    defaultHeightCm = 8
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/admin/finance/shops/$($shop.id)/commission" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
    commissionPercent = 3
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    wbNmId = $productNmId
    wbTitle = 'Smoke Three Role Product'
    localTitle = 'Smoke Three Role Product'
    localDescription = 'Three role smoke product'
    categoryName = 'Smoke Category'
    visibility = 'ACTIVE'
    variants = @(@{
      chrtId = $productNmId + 1
      techSize = 'Default'
      basePrice = 320
      stockQuantity = 5
      trackInventory = $true
      isActive = $true
    })
    images = @(@{
      wbUrl = 'https://example.com/three-role.jpg'
      localUrl = 'https://example.com/three-role.jpg'
      isMain = $true
      sortOrder = 0
    })
  } | ConvertTo-Json -Depth 6)

  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $sellerHeaders -ContentType 'application/json' -Body '{}'

  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $customerEmail
    password = $customerPassword
    fullName = 'Smoke Three Role Customer'
    phone = $buyerPhone
    role = 'CUSTOMER'
  } | ConvertTo-Json)
  $customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $customerEmail
    password = $customerPassword
  } | ConvertTo-Json)
  $customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

  $checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(@{ productId = $product.id; quantity = 1 })
    customer = @{
      fullName = 'Smoke Three Role Customer'
      phone = $buyerPhone
      email = $customerEmail
      address = 'Moscow, Sync Street 5'
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 6)

  $customerOrders = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/customer/orders" -Headers $customerHeaders
  if (@($customerOrders.items | Where-Object { $_.checkoutCode -eq $checkout.checkoutCode }).Count -lt 1) {
    throw 'Customer order history should include the checkout.'
  }

  $sellerOrders = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders?q=$([uri]::EscapeDataString($buyerPhone))" -Headers $sellerHeaders
  $sellerOrder = @($sellerOrders.items | Where-Object { $_.id -eq $checkout.orderId })[0]
  if (-not $sellerOrder) {
    throw 'Seller order list should include the new order.'
  }
  Assert-Equal $sellerOrder.sellerStatusBucket 'NEW' 'Seller order should start in NEW bucket'

  $proof = & curl.exe --ipv4 -s -X POST `
    -F "phone=$buyerPhone" `
    -F "buyerNote=Transferred by QR." `
    -F "file=@$proofPath;type=image/png" `
    "$baseUrl/api/public/orders/$($checkout.orderId)/payment-proof" | ConvertFrom-Json
  Assert-Equal $proof.paymentProofStatus 'BUYER_MARKED_PAID' 'Buyer proof should update public tracking state'

  $sellerPayments = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments?proofStatus=BUYER_MARKED_PAID" -Headers $sellerHeaders
  if (@($sellerPayments.items | Where-Object { $_.id -eq $checkout.orderId }).Count -lt 1) {
    throw 'Seller payment queue should include buyer-marked payment proof.'
  }

  $adminPayments = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/payments?proofStatus=BUYER_MARKED_PAID" -Headers $adminHeaders
  if (@($adminPayments.items | Where-Object { $_.id -eq $checkout.orderId }).Count -lt 1) {
    throw 'Admin payment supervision should include buyer-marked payment proof.'
  }

  $confirmed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/confirm" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Seller confirmed direct payment.'
  } | ConvertTo-Json)
  Assert-Equal $confirmed.paymentStatus 'PAID' 'Seller confirmation should finalize prepaid payment'

  $financeRow = @((Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/finance/seller-fees" -Headers $adminHeaders) | Where-Object { $_.shopId -eq $shop.id })[0]
  if (-not $financeRow) {
    throw 'Admin finance page should include the seller shop.'
  }
  Assert-Equal $financeRow.platformFeeDue '9.6' 'Finance ledger should create the expected commission due'

  $manualShipment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/manual" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    provider = 'YANDEX'
    manualYandexOrderId = "YANDEX-$timestamp"
    trackingUrl = 'https://go.yandex/tracking/demo'
    courierName = 'Courier Demo'
    courierPhone = '+79990000075'
    estimatedDeliveryAt = ([DateTime]::UtcNow.AddHours(4).ToString('o'))
    packagePreset = 'FASHION_BAG'
    packageWeightGram = 700
    packageLengthCm = 35
    packageWidthCm = 25
    packageHeightCm = 8
    recipientName = 'Smoke Three Role Customer'
    recipientPhone = $buyerPhone
    pickupAddress = 'Tverskaya Street 7, Moscow'
    note = 'Seller created manual Yandex delivery.'
  } | ConvertTo-Json)
  Assert-Equal $manualShipment.internalStatus 'YANDEX_MANUAL_CREATED' 'Seller should be able to create manual Yandex delivery'

  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)/delivery/shipments/$($manualShipment.id)/mark-delivered" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Delivered by seller for sync smoke.'
  } | ConvertTo-Json)

  $tracking = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$([uri]::EscapeDataString($buyerPhone))"
  Assert-Equal $tracking.delivery.status 'DELIVERED' 'Buyer tracking should show delivered shipment'

  $sellerDelivered = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $sellerHeaders
  if ($sellerDelivered.delivery.status -ne 'DELIVERED') {
    throw 'Seller order detail should show delivered shipment state.'
  }

  $adminDeliveries = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/deliveries?status=DELIVERED" -Headers $adminHeaders
  if (@($adminDeliveries.items | Where-Object { $_.orderId -eq $checkout.orderId }).Count -lt 1) {
    throw 'Admin deliveries should include the delivered order.'
  }

  [pscustomobject]@{
    baseUrl = $baseUrl
    shopId = $shop.id
    checkoutCode = $checkout.checkoutCode
    orderId = $checkout.orderId
    platformFeeDue = $financeRow.platformFeeDue
    deliveryStatus = $tracking.delivery.status
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path $proofPath) {
    Remove-Item $proofPath -Force
  }
}
