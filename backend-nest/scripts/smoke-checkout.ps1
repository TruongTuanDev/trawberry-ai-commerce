$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$sellerEmail = "smoke-checkout-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](6000000 + (Get-Random -Minimum 1 -Maximum 99999))

$sellerRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Checkout Seller'
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
  name = 'Smoke Checkout Shop'
  slug = "smoke-checkout-shop-$timestamp"
  paymentInstructions = 'Transfer to bank account 123.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Checkout Product'
  localTitle = 'Smoke Checkout Product'
  localDescription = 'Checkout-ready product'
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
      wbUrl: 'https://example.com/smoke-checkout.jpg',
      localUrl: 'https://example.com/smoke-checkout.jpg',
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
  throw 'Checkout smoke product was not published.'
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
    fullName = 'Smoke Checkout Customer'
    phone = '0123456789'
    email = "smoke-checkout-customer-$timestamp@example.com"
    address = '123 Smoke Test Street'
    note = 'Call before delivery'
  }
  paymentMethod = 'MANUAL_TRANSFER'
} | ConvertTo-Json -Depth 6)

$orders = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders?page=1&size=10&search=Smoke" -Headers $headers
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders/$($checkout.orderId)" -Headers $headers

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  orderId = $checkout.orderId
  orderCode = $checkout.orderCode
  status = $checkout.status
  paymentStatus = $checkout.paymentStatus
  totalAmount = $checkout.totalAmount
  paymentInstructions = $checkout.paymentInstructions
  sellerListTotal = $orders.meta.total
  sellerCanSeeOrder = @($orders.items | Where-Object { $_.id -eq $checkout.orderId }).Count -gt 0
  detailCustomerName = $detail.customer.name
  detailItemCount = @($detail.items).Count
} | ConvertTo-Json -Compress
