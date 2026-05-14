$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-order-track-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7000000 + (Get-Random -Minimum 1 -Maximum 99999))
$customerPhone = '0900111222'
$proofPath = Join-Path $env:TEMP "payment-proof-$timestamp.png"

[byte[]]$pngBytes = 137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,0,0,0,11,73,68,65,84,120,218,99,252,255,31,0,3,3,2,0,239,167,69,221,0,0,0,0,73,69,78,68,174,66,96,130
[System.IO.File]::WriteAllBytes($proofPath, $pngBytes)

try {
  $sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
    fullName = 'Smoke Order Tracking Seller'
    role = 'SELLER'
  } | ConvertTo-Json)

  $env:TARGET_USER_ID = $sellerRegister.userId
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

  $sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
  } | ConvertTo-Json)
  $headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
    name = 'Smoke Order Tracking Shop'
    slug = "smoke-order-track-shop-$timestamp"
    paymentInstructions = 'Transfer to account 555-888.'
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
    wbNmId = $productNmId
    wbTitle = 'Smoke Order Tracking Product'
    localTitle = 'Smoke Order Tracking Product'
    localDescription = 'Payment proof ready product'
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
      basePrice: 199,
      discountPrice: 149,
      stockQuantity: 12,
      reservedStock: 0,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-order-tracking.jpg',
      localUrl: 'https://example.com/smoke-order-tracking.jpg',
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
      fullName = 'Smoke Tracking Customer'
      phone = $customerPhone
      email = "smoke-tracking-customer-$timestamp@example.com"
      address = '456 Tracking Street'
      note = 'Tracking flow'
    }
    paymentMethod = 'MANUAL_TRANSFER'
  } | ConvertTo-Json -Depth 6)

  $tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/track?orderCode=$($checkout.orderCode)&phone=$customerPhone"
  $upload = & curl.exe -s -X POST `
    -F "phone=$customerPhone" `
    -F "file=@$proofPath;type=image/png" `
    "$baseUrl/api/public/orders/$($checkout.orderId)/payment-proof"

  if (-not $upload) {
    throw 'Payment proof upload returned empty response.'
  }

  $uploadJson = $upload | ConvertFrom-Json
  $paymentDetail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)" -Headers $headers
  $paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $headers -ContentType 'application/json' -Body (@{
    note = 'Smoke payment proof confirmed.'
  } | ConvertTo-Json)
  $trackedAgain = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/$($checkout.orderId)/track?phone=$customerPhone"

  [pscustomobject]@{
    baseUrl = $baseUrl
    shopId = $shop.id
    productId = $product.id
    orderId = $checkout.orderId
    orderCode = $checkout.orderCode
    trackedStatus = $tracked.status
    trackedPaymentStatus = $tracked.paymentStatus
    uploadProofPresent = [bool]$uploadJson.paymentProof
    uploadLogCreated = @($uploadJson.paymentLogs | Where-Object { $_.action -eq 'UPLOAD_PROOF' }).Count -gt 0
    sellerPaymentProofPresent = [bool]$paymentDetail.paymentProof
    sellerPaymentProofUrl = $paymentDetail.paymentProof.url
    paidStatus = $paid.paymentStatus
    trackedPaidStatus = $trackedAgain.paymentStatus
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path $proofPath) {
    Remove-Item $proofPath -Force
  }
}
