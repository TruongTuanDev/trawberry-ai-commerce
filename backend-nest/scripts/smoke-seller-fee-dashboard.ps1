$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-seller-fee-$timestamp@example.com"
$password = 'password123'
$buyerPhone = "+7996$((Get-Random -Minimum 1000000 -Maximum 9999999))"
$buyerEmail = "smoke-seller-fee-buyer-$timestamp@example.com"
$productNmId = [int64](7800000 + (Get-Random -Minimum 1 -Maximum 99999))
$tmpImage = Join-Path ([System.IO.Path]::GetTempPath()) "seller-fee-$timestamp.png"
$proofPath = Join-Path ([System.IO.Path]::GetTempPath()) "seller-fee-proof-$timestamp.png"
$pngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=')
[System.IO.File]::WriteAllBytes($tmpImage, $pngBytes)
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

function Assert-Equal($actual, $expected, $message) {
  if ($actual -ne $expected) {
    throw "$message. Expected '$expected' but got '$actual'."
  }
}

try {
  $register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
    fullName = 'Smoke Seller Fee Seller'
    role = 'SELLER'
  } | ConvertTo-Json)
  Approve-SellerProfile $register.userId

  $sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $password
  } | ConvertTo-Json)
  $sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    name = 'Smoke Seller Fee Shop'
    slug = "smoke-seller-fee-shop-$timestamp"
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/payment-settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    paymentMode = 'STATIC_QR'
    status = 'READY'
    bankName = 'T-Bank'
    recipientName = 'Smoke Seller Fee Seller'
    recipientPhone = '+79990000061'
    recipientAccount = '40817810000000000661'
    sbpPhone = '+79990000061'
    paymentInstruction = 'Pay seller directly by QR.'
    allowPrepaidQr = $true
    allowPayOnDeliverySellerQr = $true
    allowDepositPayment = $false
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    wbNmId = $productNmId
    wbTitle = 'Smoke Seller Fee Product'
    localTitle = 'Smoke Seller Fee Product'
    localDescription = 'Seller fee smoke product'
    categoryName = 'Smoke Category'
    visibility = 'ACTIVE'
    variants = @(@{
      chrtId = $productNmId + 1
      techSize = 'Default'
      basePrice = 300
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

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = 'demo-admin@trawberry.local'
    password = 'DemoAdmin123!'
  } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

  $commission = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/admin/finance/shops/$($shop.id)/commission" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
    commissionPercent = 3
  } | ConvertTo-Json)
  Assert-Equal $commission.commissionPercent '3' 'Admin commission update should persist'

  $checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(@{ productId = $product.id; quantity = 1 })
    customer = @{
      fullName = 'Smoke Seller Fee Buyer'
      phone = $buyerPhone
      email = $buyerEmail
      address = 'Moscow, Finance Street 1'
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 6)

  $proof = & curl.exe --ipv4 -s -X POST `
    -F "phone=$buyerPhone" `
    -F "buyerNote=Transferred by seller QR." `
    -F "file=@$proofPath;type=image/png" `
    "$baseUrl/api/public/orders/$($checkout.orderId)/payment-proof" | ConvertFrom-Json
  Assert-Equal $proof.paymentProofStatus 'BUYER_MARKED_PAID' 'Buyer proof upload should mark order paid for seller review'

  $confirmed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/confirm" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Seller verified direct payment.'
  } | ConvertTo-Json)
  Assert-Equal $confirmed.paymentStatus 'PAID' 'Seller payment confirmation should finalize the order payment'

  $metrics = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/seller/shops/$($shop.id)/dashboard-metrics" -Headers $sellerHeaders
  Assert-Equal $metrics.confirmedRevenueThisMonth '300' 'Seller metrics should show confirmed product revenue'
  Assert-Equal $metrics.estimatedPlatformFeeThisMonth '9' 'Seller metrics should apply 3 percent fee'

  $ledger = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/seller/shops/$($shop.id)/finance-ledger" -Headers $sellerHeaders
  if (@($ledger | Where-Object { $_.orderId -eq $checkout.orderId -and $_.commissionAmount -eq '9' }).Count -le 0) {
    throw 'Seller finance ledger should include a 3 percent commission entry for the confirmed order.'
  }

  $sellerFees = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/finance/seller-fees" -Headers $adminHeaders
  $shopRow = @($sellerFees | Where-Object { $_.shopId -eq $shop.id })[0]
  if (-not $shopRow) {
    throw 'Admin seller-fees list should include the finance smoke shop.'
  }
  Assert-Equal $shopRow.platformFeeDue '9' 'Admin seller-fees list should show the expected fee due'

  $invoice = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/finance/shops/$($shop.id)/invoices/generate" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
    billingPeriod = $metrics.billingPeriod
  } | ConvertTo-Json)
  Assert-Equal $invoice.status 'ISSUED' 'Invoice generation should issue a monthly invoice'

  $paidInvoice = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/finance/invoices/$($invoice.id)/mark-paid" -Headers $adminHeaders -ContentType 'application/json' -Body '{}'
  Assert-Equal $paidInvoice.status 'PAID' 'Admin should be able to mark invoice paid'

  $sellerInvoices = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/seller/shops/$($shop.id)/invoices" -Headers $sellerHeaders
  $matchingInvoice = @($sellerInvoices | Where-Object { $_.id -eq $invoice.id })[0]
  if (-not $matchingInvoice) {
    throw 'Seller invoices should include the generated invoice.'
  }
  Assert-Equal $matchingInvoice.status 'PAID' 'Seller invoices should reflect the paid invoice status'

  [pscustomobject]@{
    baseUrl = $baseUrl
    shopId = $shop.id
    orderId = $checkout.orderId
    billingPeriod = $metrics.billingPeriod
    confirmedRevenueThisMonth = $metrics.confirmedRevenueThisMonth
    estimatedPlatformFeeThisMonth = $metrics.estimatedPlatformFeeThisMonth
    invoiceStatus = $matchingInvoice.status
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path $tmpImage) {
    Remove-Item $tmpImage -Force
  }
  if (Test-Path $proofPath) {
    Remove-Item $proofPath -Force
  }
}
