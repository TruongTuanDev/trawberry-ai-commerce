$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-payments-$timestamp@example.com"
$otherSellerEmail = "smoke-payments-other-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](7000000 + (Get-Random -Minimum 1 -Maximum 99999))

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
  fullName = 'Smoke Payments Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $sellerRegister.userId

$otherSellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $otherSellerEmail
  password = $password
  fullName = 'Smoke Payments Other Seller'
  role = 'SELLER'
} | ConvertTo-Json)
Approve-SellerProfile $otherSellerRegister.userId

$sellerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Payments Shop'
  slug = "smoke-payments-shop-$timestamp"
  paymentInstructions = 'Transfer to account 123.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Payments Product'
  localTitle = 'Smoke Payments Product'
  localDescription = 'Payment review product'
  categoryName = 'Smoke Category'
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
      wbUrl: 'https://example.com/smoke-payments.jpg',
      localUrl: 'https://example.com/smoke-payments.jpg',
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

$published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
if ($published.catalogStatus -ne 'PUBLISHED') {
  throw 'Payments smoke product was not published.'
}

$checkout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(
    @{
      productId = $product.id
      quantity = 2
    }
  )
  customer = @{
    fullName = 'Smoke Payments Customer'
    phone = '0123456789'
    email = "smoke-payments-customer-$timestamp@example.com"
    address = '123 Payment Street'
    note = 'Waiting for confirmation'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 6)

$payments = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments?page=1&size=10" -Headers $headers
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)" -Headers $headers
$noted = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/notes" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Bank transfer screenshot reviewed.'
} | ConvertTo-Json)
$paid = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/payments/$($checkout.orderId)/mark-paid" -Headers $headers -ContentType 'application/json' -Body (@{
  note = 'Funds received in seller account.'
} | ConvertTo-Json)
$orderDetail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $headers

$otherLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $otherSellerEmail
  password = $password
} | ConvertTo-Json)
$otherHeaders = @{ Authorization = "Bearer $($otherLogin.accessToken)" }
$crossShopStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments" -Headers $otherHeaders -ErrorAction Stop | Out-Null
  $crossShopStatus = 'ALLOWED'
} catch {
  $crossShopStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  orderId = $checkout.orderId
  listTotal = $payments.meta.total
  sellerCanSeePending = @($payments.items | Where-Object { $_.id -eq $checkout.orderId }).Count -gt 0
  detailPaymentStatus = $detail.paymentStatus
  detailPaymentMethod = $detail.paymentMethod
  noteLogCreated = @($noted.reviewLogs | Where-Object { $_.action -eq 'ADD_NOTE' }).Count -gt 0
  paidStatus = $paid.paymentStatus
  paidLogCreated = @($paid.reviewLogs | Where-Object { $_.action -eq 'SELLER_CONFIRMED' }).Count -gt 0
  reviewLogCount = @($paid.reviewLogs).Count
  orderDetailPaymentStatus = $orderDetail.paymentStatus
  crossShopStatus = $crossShopStatus
} | ConvertTo-Json -Compress
