$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-bulk-product-edit-$timestamp@example.com"
$password = 'password123'
$fixturePath = Join-Path (Resolve-Path '.').Path 'test\fixtures\wb-products-sample.xlsx'
$categoryId = $null
$unitPrice = 2190
$stockQuantity = 6
$checkoutQuantity = 1
$customerPhone = "+7995$($timestamp.Substring($timestamp.Length - 7))"

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
      fullName = 'Bulk Product Edit Customer'
      phone = $phone
      email = "bulk-product-edit-customer-$timestamp@example.com"
      address = 'Bulk Product Edit Street 1'
      note = "Bulk product edit smoke $timestamp"
    }
    paymentMethod = 'MANUAL_TRANSFER'
  } | ConvertTo-Json -Depth 6)
}

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke Bulk Edit Seller'
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
  name = 'Smoke Bulk Edit Shop'
  slug = "smoke-bulk-edit-shop-$timestamp"
  paymentInstructions = 'Manual transfer pending seller review.'
} | ConvertTo-Json)

$categories = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/categories"
function Get-FirstCategoryId($items) {
  foreach ($item in $items) {
    if ($item.id) {
      return [int]$item.id
    }
    $childId = Get-FirstCategoryId $item.children
    if ($childId) {
      return $childId
    }
  }
  return $null
}
$categoryId = Get-FirstCategoryId $categories
Assert-True ($null -ne $categoryId) 'Could not resolve any public category for bulk edit smoke.'

$previewRaw = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$fixturePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "defaultStockQuantity=0" `
  -F "publishMode=DRAFT" `
  -F "imageMode=REMOTE_URL" `
  "$baseUrl/api/shops/$($shop.id)/imports/wildberries/preview"
$preview = $previewRaw | ConvertFrom-Json
Assert-True ($preview.totalProducts -gt 1) "Expected multiple imported products: $previewRaw"
Assert-True (@($preview.errors).Count -eq 0) "Preview returned blocking errors: $previewRaw"

$confirm = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/imports/wildberries/confirm" -Headers $headers -ContentType 'application/json' -Body (@{
  importId = $preview.importId
} | ConvertTo-Json)
Assert-True ($confirm.createdProducts -gt 0) 'Import confirm did not create products.'

$products = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?catalogStatus=IMPORTED&page=1&size=20" -Headers $headers
Assert-True (@($products.items).Count -gt 0) 'Imported products were not visible in seller catalog.'
$productIds = @($products.items | Select-Object -ExpandProperty id)
$targetProduct = $products.items[0]

$publicBeforeStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$($targetProduct.id)" | Out-Null
  $publicBeforeStatus = 'VISIBLE'
} catch {
  $publicBeforeStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}
Assert-True ($publicBeforeStatus -eq '404') "Imported product was public before publish: $publicBeforeStatus"

$bulkCategory = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/bulk-update" -Headers $headers -ContentType 'application/json' -Body (@{
  productIds = $productIds
  updates = @{
    categoryId = $categoryId
  }
} | ConvertTo-Json -Depth 6)
Assert-True ($bulkCategory.updated -eq $productIds.Count) "Bulk category update failed: $($bulkCategory | ConvertTo-Json -Compress)"

$bulkPrice = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/bulk-update" -Headers $headers -ContentType 'application/json' -Body (@{
  productIds = $productIds
  updates = @{
    price = $unitPrice
  }
  scope = @{
    variantMode = 'MISSING_ONLY'
  }
} | ConvertTo-Json -Depth 6)
Assert-True ($bulkPrice.updated -eq $productIds.Count) "Bulk price update failed: $($bulkPrice | ConvertTo-Json -Compress)"

$bulkStock = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/bulk-update" -Headers $headers -ContentType 'application/json' -Body (@{
  productIds = $productIds
  updates = @{
    stockQuantity = $stockQuantity
  }
  scope = @{
    variantMode = 'MISSING_ONLY'
  }
} | ConvertTo-Json -Depth 6)
Assert-True ($bulkStock.updated -eq $productIds.Count) "Bulk stock update failed: $($bulkStock | ConvertTo-Json -Compress)"
Assert-True (@($bulkStock.items | Where-Object { -not $_.readiness.ready }).Count -eq 0) "Expected all products to be ready after bulk edit: $($bulkStock | ConvertTo-Json -Compress)"

$bulkPublish = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/bulk" -Headers $headers -ContentType 'application/json' -Body (@{
  productIds = $productIds
  action = 'PUBLISH'
} | ConvertTo-Json -Depth 6)
Assert-True ($bulkPublish.successCount -eq $productIds.Count) "Bulk publish did not succeed for all products: $($bulkPublish | ConvertTo-Json -Compress)"

$publicProducts = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products?search=$([uri]::EscapeDataString($targetProduct.title))&page=1&size=20"
Assert-True (@($publicProducts.items | Where-Object { $_.id -eq $targetProduct.id }).Count -eq 1) 'Published product did not appear in public products.'

$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($targetProduct.id)" -Headers $headers
$inventoryBefore = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($targetProduct.id)/inventory" -Headers $headers
$checkout = Invoke-Checkout $shop.id $targetProduct.id $checkoutQuantity $customerPhone
Assert-True ($checkout.orderId) 'Checkout did not create an order.'
Assert-True ([decimal]$checkout.totalAmount -eq ($unitPrice * $checkoutQuantity)) "Unexpected checkout totalAmount: $($checkout.totalAmount)"
$inventoryAfter = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($targetProduct.id)/inventory" -Headers $headers
Assert-True ($inventoryAfter.totalAvailableQuantity -eq ($inventoryBefore.totalAvailableQuantity - $checkoutQuantity)) 'Checkout did not deduct stock as expected.'

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  importId = $preview.importId
  productCount = $productIds.Count
  categoryUpdated = $bulkCategory.updated
  priceUpdated = $bulkPrice.updated
  stockUpdated = $bulkStock.updated
  bulkPublishSuccess = $bulkPublish.successCount
  publicProductId = $targetProduct.id
  orderId = $checkout.orderId
  inventoryBefore = $inventoryBefore.totalAvailableQuantity
  inventoryAfter = $inventoryAfter.totalAvailableQuantity
} | ConvertTo-Json -Compress
