$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-product-curation-$timestamp@example.com"
$password = 'password123'
$fixturePath = Join-Path (Resolve-Path '.').Path 'test\fixtures\wb-products-sample.xlsx'
$unitPrice = 1990
$checkoutQuantity = 2
$customerPhone = "+7997$($timestamp.Substring($timestamp.Length - 7))"

function Assert-True($condition, $message) {
  if (-not $condition) {
    throw $message
  }
}

function Invoke-Checkout($shopId, $productId, $quantity, $phone) {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shopId
    items = @(@{
      productId = $productId
      quantity = $quantity
    })
    customer = @{
      fullName = 'Product Curation Customer'
      phone = $phone
      email = "product-curation-customer-$timestamp@example.com"
      address = 'Product Curation Street 1'
      note = "Product curation smoke $timestamp"
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 6)
}

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke Product Curation Seller'
  role = 'SELLER'
} | ConvertTo-Json)

$env:TARGET_USER_ID = $register.userId
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

$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke Product Curation Shop'
  slug = "smoke-product-curation-shop-$timestamp"
  paymentInstructions = 'Manual transfer pending seller review.'
} | ConvertTo-Json)

$previewRaw = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$fixturePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "defaultStockQuantity=0" `
  -F "publishMode=DRAFT" `
  -F "imageMode=REMOTE_URL" `
  "$baseUrl/api/shops/$($shop.id)/imports/wildberries/preview"
$preview = $previewRaw | ConvertFrom-Json
Assert-True ($preview.totalProducts -gt 0) "Expected imported products > 0: $previewRaw"
Assert-True (@($preview.errors).Count -eq 0) "Preview returned blocking errors: $previewRaw"

$confirm = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/imports/wildberries/confirm" -Headers $headers -ContentType 'application/json' -Body (@{
  importId = $preview.importId
} | ConvertTo-Json)

$products = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?catalogStatus=IMPORTED&page=1&size=20" -Headers $headers
Assert-True (@($products.items).Count -gt 0) 'Imported products were not visible in seller catalog.'
$productId = $products.items[0].id
$productTitle = $products.items[0].title

$publicBeforeStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$productId" | Out-Null
  $publicBeforeStatus = 'VISIBLE'
} catch {
  $publicBeforeStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}
Assert-True ($publicBeforeStatus -eq '404') "Imported product was public before publish: $publicBeforeStatus"

$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId" -Headers $headers
Assert-True (@($detail.variants).Count -gt 0) 'Imported product has no variants.'

$variant = $detail.variants[0]
$updatedProduct = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId" -Headers $headers -ContentType 'application/json' -Body (@{
  variants = @(@{
    chrtId = [int64]$variant.chrtId
    basePrice = $unitPrice
    discountPrice = $unitPrice
  })
} | ConvertTo-Json -Depth 5)
Assert-True (($updatedProduct.variants | Where-Object { $_.id -eq $variant.id })[0].basePrice -eq "$unitPrice") 'Price update did not persist.'

$updatedInventory = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/inventory" -Headers $headers -ContentType 'application/json' -Body (@{
  variantId = $variant.id
  stockQuantity = 5
} | ConvertTo-Json)
Assert-True ($updatedInventory.totalAvailableQuantity -eq 5) 'Stock update did not persist.'

$readiness = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/readiness" -Headers $headers
Assert-True ($readiness.ready -eq $true) "Product was not ready to publish: $($readiness | ConvertTo-Json -Compress)"

$published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
Assert-True ($published.catalogStatus -eq 'PUBLISHED') "Publish did not set PUBLISHED status: $($published | ConvertTo-Json -Compress)"

$publicProducts = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products?search=$([uri]::EscapeDataString($productTitle))&page=1&size=20"
Assert-True (@($publicProducts.items | Where-Object { $_.id -eq $productId }).Count -eq 1) 'Published product did not appear in public products.'

$checkout = Invoke-Checkout $shop.id $productId $checkoutQuantity $customerPhone
Assert-True ($checkout.orderId) 'Checkout did not create an order.'
Assert-True ([decimal]$checkout.totalAmount -eq ($unitPrice * $checkoutQuantity)) "Unexpected checkout totalAmount: $($checkout.totalAmount)"

$unpublished = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/unpublish" -Headers $headers -ContentType 'application/json' -Body '{}'
Assert-True ($unpublished.catalogStatus -eq 'UNPUBLISHED') "Unpublish did not set UNPUBLISHED status: $($unpublished | ConvertTo-Json -Compress)"

$publicAfterUnpublishStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$productId" | Out-Null
  $publicAfterUnpublishStatus = 'VISIBLE'
} catch {
  $publicAfterUnpublishStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}
Assert-True ($publicAfterUnpublishStatus -eq '404') "Unpublished product was still public: $publicAfterUnpublishStatus"

$checkoutAfterUnpublishStatus = 'UNKNOWN'
try {
  Invoke-Checkout $shop.id $productId 1 "+7996$($timestamp.Substring($timestamp.Length - 7))" | Out-Null
  $checkoutAfterUnpublishStatus = 'ALLOWED'
} catch {
  $checkoutAfterUnpublishStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}
Assert-True ($checkoutAfterUnpublishStatus -eq '400') "Checkout after unpublish should fail with 400, got $checkoutAfterUnpublishStatus"

$archived = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/archive" -Headers $headers -ContentType 'application/json' -Body '{}'
Assert-True ($archived.catalogStatus -eq 'ARCHIVED') "Archive did not set ARCHIVED status: $($archived | ConvertTo-Json -Compress)"

$publicAfterArchiveStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$productId" | Out-Null
  $publicAfterArchiveStatus = 'VISIBLE'
} catch {
  $publicAfterArchiveStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}
Assert-True ($publicAfterArchiveStatus -eq '404') "Archived product was still public: $publicAfterArchiveStatus"

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $productId
  productTitle = $productTitle
  importId = $preview.importId
  previewProducts = $preview.totalProducts
  createdProducts = $confirm.createdProducts
  readinessReady = $readiness.ready
  publishStatus = $published.catalogStatus
  orderId = $checkout.orderId
  orderCode = $checkout.orderCode
  totalAmount = $checkout.totalAmount
  unpublishStatus = $unpublished.catalogStatus
  checkoutAfterUnpublishStatus = $checkoutAfterUnpublishStatus
  archiveStatus = $archived.catalogStatus
} | ConvertTo-Json -Compress
