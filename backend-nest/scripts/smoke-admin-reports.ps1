$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'
$sellerEmail = "smoke-admin-reports-$timestamp@example.com"
$customerPhone = "+7996$((Get-Random -Minimum 1000000 -Maximum 9999999))"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function Invoke-Json($method, $path, $headers = $null, $body = $null) {
  $params = @{ Method = $method; Uri = "$baseUrl$path" }
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

$seller = Invoke-Json 'POST' '/api/auth/register' $null @{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Admin Reports Seller'
  role = 'SELLER'
}
Approve-SellerProfile $seller.userId

$sellerLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = $sellerEmail; password = $password }
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }
$adminLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = 'demo-admin@trawberry.local'; password = 'DemoAdmin123!' }
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

$shop = Invoke-Json 'POST' '/api/shops' $sellerHeaders @{
  name = 'Smoke Admin Reports Shop'
  slug = "smoke-admin-reports-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
}

$product = Invoke-Json 'POST' "/api/shops/$($shop.id)/products" $sellerHeaders @{
  wbNmId = [int64](8800000 + (Get-Random -Minimum 1 -Maximum 99999))
  wbTitle = 'Smoke Admin Reports Product'
  localTitle = 'Smoke Admin Reports Product'
  visibility = 'ACTIVE'
}

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
      stockQuantity: 5,
      reservedStock: 0,
      lowStockThreshold: 5,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-admin-reports.jpg',
      localUrl: 'https://example.com/smoke-admin-reports.jpg',
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
      fullName = "Smoke Admin Reports Customer $suffix"
      phone = "$customerPhone$suffix"
      email = "smoke-admin-reports-customer-$timestamp-$suffix@example.com"
      address = 'Lenina 20, Moscow'
    }
    paymentMethod = 'MANUAL_TRANSFER'
  }
}

$pendingPaymentOrder = New-Checkout '1'
$failedDeliveryOrder = New-Checkout '2'
Invoke-Json 'POST' "/api/shops/$($shop.id)/payments/$($failedDeliveryOrder.orderId)/mark-paid" $sellerHeaders @{ note = 'Paid for reports smoke' } | Out-Null
$shipment = Invoke-Json 'POST' "/api/shops/$($shop.id)/orders/$($failedDeliveryOrder.orderId)/delivery/manual" $sellerHeaders @{
  provider = 'YANDEX'
  trackingNumber = "REPORTS-$timestamp"
  trackingUrl = "https://track.example/reports/$timestamp"
}
Invoke-Json 'POST' "/api/shops/$($shop.id)/orders/$($failedDeliveryOrder.orderId)/delivery/shipments/$($shipment.id)/mark-failed" $sellerHeaders @{
  reasonCode = 'CUSTOMER_UNAVAILABLE'
  reasonText = 'Customer did not answer, "quoted" value'
  customerVisibleMessage = 'Courier could not reach you.'
} | Out-Null

$task = Invoke-Json 'POST' '/api/admin/queue-tasks' $adminHeaders @{
  entityType = 'DELIVERY'
  entityId = $shipment.id
  shopId = $shop.id
  sellerId = $seller.userId
  title = "Reports SLA breach, shipment $($shipment.id)"
  summary = 'Smoke report task'
  slaStatus = 'BREACHED'
  priority = 'HIGH'
}
$assigned = Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/assign" $adminHeaders @{ assignedToUserId = 'me' }
Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/escalate" $adminHeaders @{ priority = 'URGENT'; note = 'Smoke report escalation' } | Out-Null

$summary = Invoke-Json 'GET' "/api/admin/reports/ops-summary?shopId=$($shop.id)&sellerId=$($seller.userId)&assignedToUserId=$($adminLogin.userId)" $adminHeaders
$sla = Invoke-Json 'GET' "/api/admin/reports/sla-breaches?assignedToUserId=$($adminLogin.userId)&limit=50" $adminHeaders
$workload = Invoke-Json 'GET' '/api/admin/reports/workload' $adminHeaders
$exceptions = Invoke-Json 'GET' "/api/admin/reports/delivery-exceptions?shopId=$($shop.id)&provider=YANDEX&limit=50" $adminHeaders
$payments = Invoke-Json 'GET' "/api/admin/reports/payment-aging?shopId=$($shop.id)&limit=50" $adminHeaders

Assert-True ($summary.totalTasks -ge 1) 'Ops summary did not include smoke task.'
Assert-True ($summary.breachedTasks -ge 1) 'Ops summary did not include breached task.'
Assert-True (@($sla.items | Where-Object { $_.id -eq $task.id }).Count -eq 1) 'SLA report did not include smoke task.'
Assert-True (@($workload.items | Where-Object { $_.adminUserId -eq $adminLogin.userId }).Count -ge 1) 'Workload report did not include admin.'
Assert-True (@($exceptions.items | Where-Object { $_.id -eq $shipment.id }).Count -eq 1) 'Delivery exception report did not include smoke shipment.'
Assert-True (@($payments.items | Where-Object { $_.orderNumber -eq $pendingPaymentOrder.orderCode }).Count -eq 1) 'Payment aging report did not include pending order.'

$csvResponse = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$baseUrl/api/admin/reports/delivery-exceptions.csv?shopId=$($shop.id)" -Headers $adminHeaders
Assert-True ($csvResponse.Headers['Content-Type'] -like 'text/csv*') 'CSV content type was not text/csv.'
Assert-True ($csvResponse.Content -match 'orderNumber') 'CSV header missing.'
Assert-True ($csvResponse.Content -match '""quoted""') 'CSV escaping did not double quotes.'

$forbiddenStatus = $null
try {
  Invoke-Json 'GET' '/api/admin/reports/ops-summary' $sellerHeaders | Out-Null
} catch {
  $forbiddenStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($forbiddenStatus -eq 403) "Expected seller report access 403, got $forbiddenStatus."

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  taskId = $task.id
  assignedToUserId = $assigned.assignedToUserId
  summaryTasks = $summary.totalTasks
  breachedTasks = $summary.breachedTasks
  slaRows = $sla.total
  workloadRows = @($workload.items).Count
  deliveryExceptionRows = $exceptions.total
  paymentAgingRows = $payments.total
  csvLength = $csvResponse.Content.Length
  sellerAccessStatus = $forbiddenStatus
} | ConvertTo-Json -Compress
