$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-return-seller-$timestamp@example.com"
$sellerPassword = 'password123'
$customerEmail = "smoke-return-customer-$timestamp@example.com"
$customerPassword = 'password123'
$buyerPhone = "+7992$((Get-Random -Minimum 1000000 -Maximum 9999999))"
$productNmId = [int64](8400000 + (Get-Random -Minimum 1 -Maximum 99999))
$proofPath = Join-Path ([System.IO.Path]::GetTempPath()) "return-refund-proof-$timestamp.png"
$refundProofPath = Join-Path ([System.IO.Path]::GetTempPath()) "return-refund-seller-proof-$timestamp.png"
$pngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=')
[System.IO.File]::WriteAllBytes($proofPath, $pngBytes)
[System.IO.File]::WriteAllBytes($refundProofPath, $pngBytes)

function Assert-Equal($actual, $expected, $message) {
  if ($actual -ne $expected) {
    throw "$message. Expected '$expected' but got '$actual'."
  }
}

function Assert-DecimalApprox($actual, $expected, $message) {
  $left = [decimal]$actual
  $right = [decimal]$expected
  if ([math]::Abs($left - $right) -gt 0.0001) {
    throw "$message. Expected '$expected' but got '$actual'."
  }
}

try {
  $seller = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $sellerEmail
    password = $sellerPassword
    fullName = 'Smoke Return Seller'
    role = 'SELLER'
  } | ConvertTo-Json)

  $env:TARGET_USER_ID = $seller.userId
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
    password = $sellerPassword
  } | ConvertTo-Json)
  $sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    name = 'Smoke Return Shop'
    slug = "smoke-return-shop-$timestamp"
  } | ConvertTo-Json)

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/payment-settings" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    paymentMode = 'STATIC_QR'
    status = 'READY'
    bankName = 'T-Bank'
    recipientName = 'Smoke Return Seller'
    recipientPhone = '+79990000081'
    recipientAccount = '40817810000000000881'
    sbpPhone = '+79990000081'
    paymentInstruction = 'Pay seller directly by QR.'
    allowPrepaidQr = $true
    allowPayOnDeliverySellerQr = $true
    allowDepositPayment = $false
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    wbNmId = $productNmId
    wbTitle = 'Smoke Return Product'
    localTitle = 'Smoke Return Product'
    localDescription = 'Refund smoke product'
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
    images = @(@{
      wbUrl = 'https://example.com/return-product.jpg'
      localUrl = 'https://example.com/return-product.jpg'
      isMain = $true
      sortOrder = 0
    })
  } | ConvertTo-Json -Depth 6)

  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $sellerHeaders -ContentType 'application/json' -Body '{}'

  $null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $customerEmail
    password = $customerPassword
    fullName = 'Smoke Return Customer'
    phone = $buyerPhone
    role = 'CUSTOMER'
  } | ConvertTo-Json)
  $customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $customerEmail
    password = $customerPassword
  } | ConvertTo-Json)
  $customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = 'demo-admin@trawberry.local'
    password = 'DemoAdmin123!'
  } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

  $null = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/admin/finance/shops/$($shop.id)/commission" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
    commissionPercent = 3
  } | ConvertTo-Json)

  $checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(@{ productId = $product.id; quantity = 1 })
    customer = @{
      fullName = 'Smoke Return Customer'
      phone = $buyerPhone
      email = $customerEmail
      address = 'Moscow, Return Street 1'
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 6)

  $proof = & curl.exe --ipv4 -s -X POST `
    -F "phone=$buyerPhone" `
    -F "buyerNote=Transferred by QR." `
    -F "file=@$proofPath;type=image/png" `
    "$baseUrl/api/public/orders/$($checkout.orderId)/payment-proof" | ConvertFrom-Json
  Assert-Equal $proof.paymentProofStatus 'BUYER_MARKED_PAID' 'Buyer proof should be recorded'

  $confirmed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/confirm" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    note = 'Seller confirmed direct payment.'
  } | ConvertTo-Json)
  Assert-Equal $confirmed.paymentStatus 'PAID' 'Seller confirmation should finalize payment'

  $initialLedger = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/seller/shops/$($shop.id)/finance-ledger" -Headers $sellerHeaders
  $positiveLedger = @($initialLedger | Where-Object { $_.orderId -eq $checkout.orderId -and $_.source -eq 'PREPAID_CONFIRMED' })[0]
  if (-not $positiveLedger) {
    throw 'Expected positive seller fee ledger entry after payment confirmation.'
  }
  Assert-DecimalApprox $positiveLedger.commissionAmount '9' 'Initial platform fee should be 9'

  $case = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/orders/$($checkout.orderId)/returns" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
    type = 'REFUND_ONLY'
    reason = 'WRONG_SIZE'
    requestedAmount = 120
    buyerComment = 'Size was wrong, requesting partial refund.'
  } | ConvertTo-Json)
  Assert-Equal $case.status 'WAITING_SELLER_RESPONSE' 'Case should wait for seller response'

  $customerCases = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/customer/returns" -Headers $customerHeaders
  if (@($customerCases.items | Where-Object { $_.id -eq $case.id }).Count -lt 1) {
    throw 'Customer returns list should include the opened case.'
  }

  $sellerRejected = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/returns/$($case.id)/respond" -Headers $sellerHeaders -ContentType 'application/json' -Body (@{
    action = 'REJECT'
    sellerComment = 'Seller rejects the refund until admin review.'
  } | ConvertTo-Json)
  Assert-Equal $sellerRejected.status 'SELLER_REJECTED' 'Seller reject should move case to seller rejected'

  $adminCases = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/returns?status=SELLER_REJECTED" -Headers $adminHeaders
  if (@($adminCases.items | Where-Object { $_.id -eq $case.id }).Count -lt 1) {
    throw 'Admin returns list should include the seller-rejected case.'
  }

  $approved = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/returns/$($case.id)/decision" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
    decision = 'APPROVE'
    approvedAmount = 120
    adminNote = 'Admin approved a partial refund.'
  } | ConvertTo-Json)
  Assert-Equal $approved.status 'REFUND_PENDING' 'Admin approve should move case to refund pending'

  $refundSent = & curl.exe --ipv4 -s -X POST `
    -H "Authorization: Bearer $($sellerLogin.accessToken)" `
    -F "amount=120" `
    -F "method=SBP" `
    -F "bankReference=SBP-RETURN-$timestamp" `
    -F "note=Seller sent refund manually." `
    -F "file=@$refundProofPath;type=image/png" `
    "$baseUrl/api/shops/$($shop.id)/returns/$($case.id)/refund-sent" | ConvertFrom-Json
  Assert-Equal $refundSent.status 'REFUND_MARKED_SENT' 'Seller refund sent should update case'

  $confirmedRefund = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/returns/$($case.id)/confirm-refund-received" -Headers $customerHeaders -ContentType 'application/json' -Body '{}'
  Assert-Equal $confirmedRefund.status 'REFUND_CONFIRMED' 'Customer confirmation should finalize the refund case'

  $finalSellerCase = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/returns/$($case.id)" -Headers $sellerHeaders
  Assert-Equal $finalSellerCase.status 'REFUND_CONFIRMED' 'Seller detail should show final refund state'

  $finalAdminCase = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/returns/$($case.id)" -Headers $adminHeaders
  Assert-Equal $finalAdminCase.status 'REFUND_CONFIRMED' 'Admin detail should show final refund state'

  $ledger = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/seller/shops/$($shop.id)/finance-ledger" -Headers $sellerHeaders
  $adjustment = @($ledger | Where-Object { $_.source -eq 'RETURN_REFUND_CONFIRMED' })[0]
  if (-not $adjustment) {
    throw 'Expected refund adjustment entry in seller finance ledger.'
  }
  Assert-DecimalApprox $adjustment.productRevenueAmount '-120' 'Refund adjustment should reverse product revenue proportionally'
  Assert-DecimalApprox $adjustment.commissionAmount '-3.6' 'Refund adjustment should reverse commission proportionally'

  $feeRow = @((Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/finance/seller-fees" -Headers $adminHeaders) | Where-Object { $_.shopId -eq $shop.id })[0]
  if (-not $feeRow) {
    throw 'Expected seller fee row for refund smoke shop.'
  }
  Assert-DecimalApprox $feeRow.platformFeeDue '5.4' 'Platform fee due should be adjusted after confirmed refund'

  [pscustomobject]@{
    baseUrl = $baseUrl
    shopId = $shop.id
    orderId = $checkout.orderId
    caseId = $case.id
    initialCommission = $positiveLedger.commissionAmount
    adjustedCommission = $adjustment.commissionAmount
    platformFeeDue = $feeRow.platformFeeDue
    finalCaseStatus = $finalAdminCase.status
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path $proofPath) {
    Remove-Item $proofPath -Force
  }
  if (Test-Path $refundProofPath) {
    Remove-Item $refundProofPath -Force
  }
}
