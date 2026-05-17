$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'

function Register-ApprovedSeller {
  param([string]$Email, [string]$FullName)

  $registered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
    email = $Email; password = $password; fullName = $FullName; role = 'SELLER'
  } | ConvertTo-Json)

  $env:TARGET_USER_ID = $registered.userId
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

  $login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
    email = $Email; password = $password
  } | ConvertTo-Json)
  return @{ accessToken = $login.accessToken; userId = $registered.userId }
}

function Create-ShopProduct {
  param(
    [string]$AccessToken,
    [string]$ShopName,
    [string]$ShopSlug,
    [string]$ProductName,
    [int]$Price,
    [int]$Stock,
    [int64]$NmId,
    [string]$Size
  )

  $headers = @{ Authorization = "Bearer $AccessToken" }
  $shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
    name = $ShopName
    slug = $ShopSlug
    paymentInstructions = "Manual transfer for $ShopName."
  } | ConvertTo-Json)

  $product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
    wbNmId = $NmId
    wbTitle = $ProductName
    localTitle = $ProductName
    localDescription = "$ProductName support-ready"
    categoryName = 'Smoke Category'
    visibility = 'ACTIVE'
  } | ConvertTo-Json)

  $env:TARGET_PRODUCT_ID = $product.id
  $env:TARGET_PRICE = "$Price"
  $env:TARGET_STOCK = "$Stock"
  $env:TARGET_SIZE = $Size
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  const variant = await prisma.productVariant.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now() + Math.floor(Math.random() * 1000)),
      sellerSku: `SUPPORT-${process.env.TARGET_SIZE}`,
      sizeName: process.env.TARGET_SIZE,
      isActive: true,
      basePrice: Number(process.env.TARGET_PRICE),
      stockQuantity: Number(process.env.TARGET_STOCK),
      reservedStock: 0,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: `https://example.com/${process.env.TARGET_PRODUCT_ID}.jpg`,
      localUrl: `https://example.com/${process.env.TARGET_PRODUCT_ID}.jpg`,
      isMain: true,
      sortOrder: 0,
    },
  });
  console.log(JSON.stringify({ variantId: variant.id }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node - | Set-Variable -Name variantJson
  Remove-Item Env:TARGET_PRODUCT_ID
  Remove-Item Env:TARGET_PRICE
  Remove-Item Env:TARGET_STOCK
  Remove-Item Env:TARGET_SIZE

  $published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
  $variant = $variantJson | ConvertFrom-Json
  if ($published.catalogStatus -ne 'PUBLISHED') { throw 'Support smoke product was not published.' }
  return @{ shop = $shop; product = $product; variantId = $variant.variantId; headers = $headers }
}

$customerEmail = "support-customer-$timestamp@example.com"
$phone = "018$($timestamp.Substring($timestamp.Length - 7))"
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
  fullName = 'Support Smoke Customer'
  role = 'CUSTOMER'
} | ConvertTo-Json) | Out-Null
$customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
} | ConvertTo-Json)
$customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

$adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = 'demo-admin@trawberry.local'
  password = 'DemoAdmin123!'
} | ConvertTo-Json)
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

$sellerA = Register-ApprovedSeller -Email "support-a-$timestamp@example.com" -FullName 'Support Seller A'
$sellerB = Register-ApprovedSeller -Email "support-b-$timestamp@example.com" -FullName 'Support Seller B'
$a = Create-ShopProduct -AccessToken $sellerA.accessToken -ShopName 'Support Shop A' -ShopSlug "support-shop-a-$timestamp" -ProductName 'Support Product A' -Price 100 -Stock 10 -NmId ([int64](8100000 + (Get-Random -Minimum 1 -Maximum 99999))) -Size 'A'
$b = Create-ShopProduct -AccessToken $sellerB.accessToken -ShopName 'Support Shop B' -ShopSlug "support-shop-b-$timestamp" -ProductName 'Support Product B' -Price 200 -Stock 10 -NmId ([int64](9100000 + (Get-Random -Minimum 1 -Maximum 99999))) -Size 'B'

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  shopId = $a.shop.id
  items = @(
    @{ productId = $a.product.id; variantId = $a.variantId; quantity = 1 },
    @{ productId = $b.product.id; variantId = $b.variantId; quantity = 1 }
  )
  customer = @{
    fullName = 'Support Smoke Customer'
    phone = $phone
    email = $customerEmail
    address = '123 Support Street'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

if (-not $checkout.checkoutCode) { throw 'Expected checkoutCode from checkout.' }
if (@($checkout.orders).Count -ne 2) { throw 'Expected two child orders for support smoke.' }

$checkoutCase = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/checkouts/$($checkout.checkoutCode)/support-cases" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  issueType = 'DELIVERY_DELAY'
  subject = 'Where is my full checkout?'
  description = 'Parent checkout needs attention.'
} | ConvertTo-Json)
if ($checkoutCase.status -ne 'OPEN') { throw 'Expected OPEN support case.' }

$customerReply = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/support-cases/$($checkoutCase.id)/messages" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  message = 'Customer follow-up message.'
} | ConvertTo-Json)
if (@($customerReply.messages).Count -lt 2) { throw 'Expected customer message thread to grow.' }

$adminList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/support-cases" -Headers $adminHeaders
$adminCase = @($adminList.items | Where-Object { $_.id -eq $checkoutCase.id })[0]
if (-not $adminCase) { throw 'Admin cannot see checkout support case.' }

$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/admin/support-cases/$($checkoutCase.id)" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
  status = 'IN_REVIEW'
  priority = 'HIGH'
  resolutionNote = 'Admin triage started.'
} | ConvertTo-Json)
if ($updated.status -ne 'IN_REVIEW') { throw 'Admin status update failed.' }

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/support-cases/$($checkoutCase.id)/messages" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
  message = 'Internal admin note.'
  isInternal = $true
} | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/support-cases/$($checkoutCase.id)/messages" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
  message = 'Public admin update.'
  isInternal = $false
} | ConvertTo-Json) | Out-Null

$customerCaseView = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/customer/support-cases/$($checkoutCase.id)" -Headers $customerHeaders
if (@($customerCaseView.messages | Where-Object { $_.message -eq 'Internal admin note.' }).Count -ne 0) { throw 'Customer should not see internal admin note.' }
if (@($customerCaseView.messages | Where-Object { $_.message -eq 'Public admin update.' }).Count -ne 1) { throw 'Customer missing public admin note.' }

$orderCase = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/checkouts/$($checkout.checkoutCode)/support-cases" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  orderId = @($checkout.orders)[0].orderId
  issueType = 'WRONG_ITEM'
  subject = 'Wrong item from seller A'
  description = 'This is linked to seller A order.'
} | ConvertTo-Json)
if (-not $orderCase.orderId) { throw 'Expected order-linked support case.' }

$sellerAHeaders = @{ Authorization = "Bearer $($sellerA.accessToken)" }
$sellerBHeaders = @{ Authorization = "Bearer $($sellerB.accessToken)" }
$sellerACases = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($a.shop.id)/support-cases" -Headers $sellerAHeaders
if (@($sellerACases.items | Where-Object { $_.id -eq $orderCase.id }).Count -ne 1) { throw 'Seller A cannot see linked order case.' }

$sellerReply = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($a.shop.id)/support-cases/$($orderCase.id)/messages" -Headers $sellerAHeaders -ContentType 'application/json' -Body (@{
  message = 'Seller A acknowledged the issue.'
} | ConvertTo-Json)
if (@($sellerReply.messages | Where-Object { $_.message -eq 'Seller A acknowledged the issue.' }).Count -ne 1) { throw 'Seller reply missing.' }

$sellerBBlocked = $false
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($b.shop.id)/support-cases/$($orderCase.id)" -Headers $sellerBHeaders | Out-Null
} catch {
  $sellerBBlocked = $true
}
if (-not $sellerBBlocked) { throw 'Seller B should not see seller A support case.' }

[pscustomobject]@{
  baseUrl = $baseUrl
  checkoutCode = $checkout.checkoutCode
  checkoutCaseId = $checkoutCase.id
  checkoutCaseStatus = $updated.status
  customerCannotSeeInternal = @($customerCaseView.messages | Where-Object { $_.message -eq 'Internal admin note.' }).Count -eq 0
  customerSeesPublic = @($customerCaseView.messages | Where-Object { $_.message -eq 'Public admin update.' }).Count -eq 1
  orderCaseId = $orderCase.id
  sellerASeesOrderCase = @($sellerACases.items | Where-Object { $_.id -eq $orderCase.id }).Count -eq 1
  sellerBBlocked = $sellerBBlocked
} | ConvertTo-Json -Compress
