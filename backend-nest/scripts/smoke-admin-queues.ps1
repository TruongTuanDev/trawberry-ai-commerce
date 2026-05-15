$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'
$sellerEmail = "smoke-admin-queues-$timestamp@example.com"
$pendingSellerEmail = "smoke-admin-queues-pending-$timestamp@example.com"
$customerPhone = "+7997$((Get-Random -Minimum 1000000 -Maximum 9999999))"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function Invoke-Json($method, $path, $headers, $body = $null) {
  $params = @{
    Method = $method
    Uri = "$baseUrl$path"
  }
  if ($headers) { $params.Headers = $headers }
  if ($body) {
    $params.ContentType = 'application/json'
    $params.Body = ($body | ConvertTo-Json -Depth 8)
  }
  Invoke-RestMethod @params
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

$pendingSeller = Invoke-Json 'POST' '/api/auth/register' $null @{
  email = $pendingSellerEmail
  password = $password
  fullName = 'Smoke Admin Queues Pending Seller'
  role = 'SELLER'
}
Assert-True ($pendingSeller.userId) 'Pending seller was not created.'

$seller = Invoke-Json 'POST' '/api/auth/register' $null @{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Admin Queues Seller'
  role = 'SELLER'
}
Approve-SellerProfile $seller.userId

$sellerLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = $sellerEmail; password = $password }
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }
$adminLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = 'demo-admin@trawberry.local'; password = 'DemoAdmin123!' }
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

$shop = Invoke-Json 'POST' '/api/shops' $sellerHeaders @{
  name = 'Smoke Admin Queues Shop'
  slug = "smoke-admin-queues-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
}

$product = Invoke-Json 'POST' "/api/shops/$($shop.id)/products" $sellerHeaders @{
  wbNmId = [int64](7700000 + (Get-Random -Minimum 1 -Maximum 99999))
  wbTitle = 'Smoke Admin Queues Product'
  localTitle = 'Smoke Admin Queues Product'
  visibility = 'ACTIVE'
}

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  await prisma.productVariant.createMany({
    data: [
      {
        id: randomUUID(),
        productId: process.env.TARGET_PRODUCT_ID,
        chrtId: BigInt(Date.now()),
        isActive: true,
        basePrice: 120,
        discountPrice: 99,
        stockQuantity: 5,
        reservedStock: 0,
        lowStockThreshold: 5,
      },
      {
        id: randomUUID(),
        productId: process.env.TARGET_PRODUCT_ID,
        chrtId: BigInt(Date.now() + 1),
        isActive: true,
        basePrice: 120,
        discountPrice: 99,
        stockQuantity: 0,
        reservedStock: 0,
        lowStockThreshold: 5,
      },
    ],
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-admin-queues.jpg',
      localUrl: 'https://example.com/smoke-admin-queues.jpg',
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

function New-Checkout($suffix) {
  Invoke-Json 'POST' '/api/checkout/orders' $null @{
    shopId = $shop.id
    items = @(@{ productId = $product.id; quantity = 1 })
    customer = @{
      fullName = "Smoke Admin Queues Customer $suffix"
      phone = "$customerPhone$suffix"
      email = "smoke-admin-queues-customer-$timestamp-$suffix@example.com"
      address = 'Lenina 10, Moscow'
    }
    paymentMethod = 'MANUAL_TRANSFER'
  }
}

$pendingPaymentOrder = New-Checkout '1'
$paidWithoutDeliveryOrder = New-Checkout '2'
$failedDeliveryOrder = New-Checkout '3'

Invoke-Json 'POST' "/api/shops/$($shop.id)/payments/$($paidWithoutDeliveryOrder.orderId)/mark-paid" $sellerHeaders @{ note = 'Paid without delivery for admin queues smoke' } | Out-Null
Invoke-Json 'POST' "/api/shops/$($shop.id)/payments/$($failedDeliveryOrder.orderId)/mark-paid" $sellerHeaders @{ note = 'Paid failed delivery for admin queues smoke' } | Out-Null
$shipment = Invoke-Json 'POST' "/api/shops/$($shop.id)/orders/$($failedDeliveryOrder.orderId)/delivery/manual" $sellerHeaders @{
  provider = 'YANDEX'
  trackingNumber = "QUEUES-$timestamp"
  trackingUrl = "https://track.example/queues/$timestamp"
}
Invoke-Json 'POST' "/api/shops/$($shop.id)/orders/$($failedDeliveryOrder.orderId)/delivery/shipments/$($shipment.id)/mark-failed" $sellerHeaders @{
  reasonCode = 'CUSTOMER_UNAVAILABLE'
  customerVisibleMessage = 'Courier could not reach you.'
} | Out-Null

$sellerQueue = Invoke-Json 'GET' "/api/admin/queues/sellers?status=PENDING&q=$([uri]::EscapeDataString($pendingSellerEmail))&limit=50" $adminHeaders
$paymentQueue = Invoke-Json 'GET' "/api/admin/queues/payments?status=PENDING&shopId=$($shop.id)&limit=50" $adminHeaders
$paidWithoutDeliveryQueue = Invoke-Json 'GET' "/api/admin/queues/deliveries?queueType=PAID_WITHOUT_DELIVERY&shopId=$($shop.id)&limit=50" $adminHeaders
$exceptionQueue = Invoke-Json 'GET' "/api/admin/queues/deliveries?queueType=EXCEPTION&shopId=$($shop.id)&limit=50" $adminHeaders
$lowStockQueue = Invoke-Json 'GET' "/api/admin/queues/inventory?stockStatus=LOW_STOCK&shopId=$($shop.id)&limit=50" $adminHeaders
$outOfStockQueue = Invoke-Json 'GET' "/api/admin/queues/inventory?stockStatus=OUT_OF_STOCK&shopId=$($shop.id)&limit=50" $adminHeaders

Assert-True (@($sellerQueue.items | Where-Object { $_.sellerEmail -eq $pendingSellerEmail }).Count -eq 1) 'Pending seller queue did not include smoke seller.'
Assert-True (@($paymentQueue.items | Where-Object { $_.orderCode -eq $pendingPaymentOrder.orderCode }).Count -eq 1) 'Payment queue did not include smoke order.'
Assert-True (@($paidWithoutDeliveryQueue.items | Where-Object { $_.orderCode -eq $paidWithoutDeliveryOrder.orderCode }).Count -eq 1) 'Paid without delivery queue did not include smoke order.'
Assert-True (@($exceptionQueue.items | Where-Object { $_.orderCode -eq $failedDeliveryOrder.orderCode }).Count -eq 1) 'Exception queue did not include smoke delivery.'
Assert-True (@($lowStockQueue.items | Where-Object { $_.productName -eq 'Smoke Admin Queues Product' }).Count -ge 1) 'Low stock queue did not include smoke product.'
Assert-True (@($outOfStockQueue.items | Where-Object { $_.productName -eq 'Smoke Admin Queues Product' }).Count -ge 1) 'Out of stock queue did not include smoke product.'
Assert-True ($sellerQueue.items[0].slaStatus) 'Seller queue item did not include SLA status.'

$forbiddenStatus = $null
try {
  Invoke-Json 'GET' '/api/admin/queues/sellers' $sellerHeaders | Out-Null
} catch {
  $forbiddenStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($forbiddenStatus -eq 403) "Expected seller queue access 403, got $forbiddenStatus."

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  pendingSeller = $pendingSellerEmail
  pendingPaymentOrder = $pendingPaymentOrder.orderCode
  paidWithoutDeliveryOrder = $paidWithoutDeliveryOrder.orderCode
  failedDeliveryOrder = $failedDeliveryOrder.orderCode
  sellerQueueTotal = $sellerQueue.total
  paymentQueueTotal = $paymentQueue.total
  deliveryExceptionTotal = $exceptionQueue.total
  sellerAccessStatus = $forbiddenStatus
} | ConvertTo-Json -Compress
