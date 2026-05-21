$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-direct-qr-$timestamp@example.com"
$buyerPhone = "+7999$((Get-Random -Minimum 1000000 -Maximum 9999999))"
$buyerEmail = "smoke-direct-qr-buyer-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7300000 + (Get-Random -Minimum 1 -Maximum 99999))
$tmpQrPath = Join-Path ([System.IO.Path]::GetTempPath()) "seller-qr-$timestamp.png"
$proofPath = Join-Path ([System.IO.Path]::GetTempPath()) "buyer-proof-$timestamp.png"
$pngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=')
[System.IO.File]::WriteAllBytes($tmpQrPath, $pngBytes)
[System.IO.File]::WriteAllBytes($proofPath, $pngBytes)

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

try {
  $register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
    fullName = 'Smoke Direct QR Seller'
    role = 'SELLER'
  } | ConvertTo-Json)
  Approve-SellerProfile $register.userId

  $sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
  } | ConvertTo-Json)
  $sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    name = 'Smoke Direct QR Shop'
    slug = "smoke-direct-qr-shop-$timestamp"
  } | ConvertTo-Json)

  $paymentSettings = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/payment-settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    paymentMode = 'STATIC_QR'
    status = 'READY'
    bankName = 'T-Bank'
    recipientName = 'Smoke Direct QR Seller'
    recipientPhone = '+79990000011'
    recipientAccount = '40817810000000000123'
    sbpPhone = '+79990000011'
    paymentInstruction = 'Scan the seller QR and transfer the exact order total.'
  } | ConvertTo-Json)

  $qrUpload = & curl.exe --ipv4 -s -X POST `
    -H "Authorization: Bearer $($sellerLogin.accessToken)" `
    -F "file=@$tmpQrPath;type=image/png" `
    "$baseUrl/api/shops/$($shop.id)/payment-settings/qr-image" | ConvertFrom-Json

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    wbNmId = $productNmId
    wbTitle = 'Smoke Direct QR Product'
    localTitle = 'Smoke Direct QR Product'
    localDescription = 'Direct seller QR smoke product'
    categoryName = 'Smoke Category'
    visibility = 'ACTIVE'
    variants = @(
      @{
        chrtId = $productNmId + 1
        techSize = 'Default'
        basePrice = 149
        stockQuantity = 5
        trackInventory = $true
        isActive = $true
      }
    )
  } | ConvertTo-Json -Depth 6)

  $imageUpload = & curl.exe --ipv4 -s -X POST `
    -H "Authorization: Bearer $($sellerLogin.accessToken)" `
    -F "files=@$tmpQrPath;type=image/png" `
    "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" | ConvertFrom-Json

  $published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $sellerHeaders -ContentType 'application/json' -Body '{}'

  $checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(
      @{
        productId = $product.id
        quantity = 1
      }
    )
    customer = @{
      fullName = 'Smoke Direct Buyer'
      phone = $buyerPhone
      email = $buyerEmail
      address = 'Moscow, QR Street 1'
      note = 'Smoke direct QR checkout'
    }
    paymentMethod = 'MANUAL_TRANSFER'
  } | ConvertTo-Json -Depth 6)

  $proofUpload = & curl.exe --ipv4 -s -X POST `
    -F "phone=$buyerPhone" `
    -F "buyerNote=Transferred via SBP QR." `
    -F "file=@$proofPath;type=image/png" `
    "$baseUrl/api/public/orders/$($checkout.orderId)/payment-proof" | ConvertFrom-Json

  $confirmQueue = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments?page=1&size=10&proofStatus=BUYER_MARKED_PAID" -Headers $sellerHeaders
  $sellerConfirmed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/confirm" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Seller verified incoming transfer.'
  } | ConvertTo-Json)

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = 'demo-admin@trawberry.local'
    password = 'DemoAdmin123!'
  } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }
  $adminPayments = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/payments?page=1&size=10&shopId=$($shop.id)&status=PAID" -Headers $adminHeaders

  [pscustomobject]@{
    baseUrl = $baseUrl
    shopId = $shop.id
    paymentConfigReady = $paymentSettings.isReady
    qrUploaded = [bool]$qrUpload.staticQrImageUrl
    productPublished = $published.catalogStatus
    checkoutId = $checkout.checkoutId
    orderId = $checkout.orderId
    checkoutQrPresent = [bool]$checkout.paymentDetails.staticQrImageUrl
    proofStatusAfterBuyerUpload = $proofUpload.paymentProofStatus
    sellerQueueHasOrder = @($confirmQueue.items | Where-Object { $_.id -eq $checkout.orderId }).Count -gt 0
    sellerConfirmedStatus = $sellerConfirmed.paymentStatus
    sellerConfirmedProofStatus = $sellerConfirmed.paymentProofStatus
    adminCanSeeOrder = @($adminPayments.items | Where-Object { $_.id -eq $checkout.orderId }).Count -gt 0
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path $tmpQrPath) {
    Remove-Item $tmpQrPath -Force
  }
  if (Test-Path $proofPath) {
    Remove-Item $proofPath -Force
  }
}
