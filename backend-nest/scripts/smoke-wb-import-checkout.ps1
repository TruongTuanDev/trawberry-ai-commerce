$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-wb-import-checkout-$timestamp@example.com"
$password = 'password123'
$fixturePath = Join-Path (Resolve-Path '.').Path 'test\fixtures\wb-products-sample.xlsx'
$unitPrice = 1990
$checkoutQuantity = 2
$customerPhone = "+7998$($timestamp.Substring($timestamp.Length - 7))"

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
      fullName = 'WB Import Checkout Customer'
      phone = $phone
      email = "wb-import-checkout-customer-$timestamp@example.com"
      address = 'WB Import Checkout Street 1'
      note = "WB import checkout smoke $timestamp"
    }
    paymentMethod = 'MANUAL_TRANSFER'
  } | ConvertTo-Json -Depth 6)
}

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke WB Import Checkout Seller'
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
  name = 'Smoke WB Import Checkout Shop'
  slug = "smoke-wb-import-checkout-shop-$timestamp"
  paymentInstructions = 'Manual transfer pending seller review.'
} | ConvertTo-Json)

$previewRaw = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$fixturePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "defaultStockQuantity=0" `
  -F "publishMode=ACTIVE" `
  -F "imageMode=REMOTE_URL" `
  "$baseUrl/api/shops/$($shop.id)/imports/wildberries/preview"
$preview = $previewRaw | ConvertFrom-Json

Assert-True ($preview.totalProducts -gt 0) "Expected imported products > 0: $previewRaw"
Assert-True ($preview.totalVariants -gt 0) "Expected imported variants > 0: $previewRaw"
Assert-True ($preview.totalImages -gt 0) "Expected imported images > 0: $previewRaw"
Assert-True (@($preview.errors).Count -eq 0) "Preview returned blocking errors: $previewRaw"

$confirm = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/imports/wildberries/confirm" -Headers $headers -ContentType 'application/json' -Body (@{
  importId = $preview.importId
} | ConvertTo-Json)

$products = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?search=WB%20Linen&page=1&size=10" -Headers $headers
Assert-True (@($products.items).Count -gt 0) 'Imported product was not visible in seller products.'

$productId = $products.items[0].id
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId" -Headers $headers
Assert-True (@($detail.variants).Count -gt 0) 'Imported product has no variants.'
Assert-True (@($detail.images).Count -gt 0) 'Imported product has no images.'
Assert-True (@($detail.images | Where-Object { $_.wbUrl -like 'http*' -or $_.localUrl -like 'http*' }).Count -gt 0) 'Imported images did not retain remote URLs.'

$variant = $detail.variants[0]
$updatedProduct = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId" -Headers $headers -ContentType 'application/json' -Body (@{
  visibility = 'ACTIVE'
  variants = @(@{
    chrtId = [int64]$variant.chrtId
    basePrice = $unitPrice
    discountPrice = $unitPrice
  })
} | ConvertTo-Json -Depth 5)
Assert-True (($updatedProduct.variants | Where-Object { $_.id -eq $variant.id })[0].basePrice -eq "$unitPrice") 'Seller price update did not persist.'

$inventoryBeforeUpdate = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/inventory" -Headers $headers
$updatedInventory = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/inventory" -Headers $headers -ContentType 'application/json' -Body (@{
  variantId = $variant.id
  stockQuantity = 5
} | ConvertTo-Json)
Assert-True ($updatedInventory.totalAvailableQuantity -eq 5) 'Seller stock update did not persist.'

$publicProducts = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products?search=WB%20Linen&page=1&size=20"
Assert-True (@($publicProducts.items | Where-Object { $_.id -eq $productId }).Count -eq 1) 'Public products did not contain checkout-ready imported product.'

$publicDetail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/products/$productId"
Assert-True ($publicDetail.id -eq $productId) 'Public product detail did not return imported product.'
Assert-True ([decimal]$publicDetail.price -gt 0) 'Public product price was not available.'
Assert-True ([decimal]$publicDetail.price -le $unitPrice) 'Public product price should use the lowest active variant price.'

$checkout = Invoke-Checkout $shop.id $productId $checkoutQuantity $customerPhone
Assert-True ($checkout.orderId) 'Checkout did not create an order.'
Assert-True ([decimal]$checkout.totalAmount -eq ($unitPrice * $checkoutQuantity)) "Unexpected checkout totalAmount: $($checkout.totalAmount)"
Assert-True ($checkout.paymentStatus -eq 'PENDING') "Unexpected paymentStatus: $($checkout.paymentStatus)"
Assert-True ($checkout.status -eq 'PENDING') "Unexpected order status: $($checkout.status)"

$inventoryAfterCheckout = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId/inventory" -Headers $headers
Assert-True ($inventoryAfterCheckout.totalAvailableQuantity -eq 3) "Expected stock after checkout to be 3, got $($inventoryAfterCheckout.totalAvailableQuantity)."

$insufficientStatus = 'UNKNOWN'
try {
  Invoke-Checkout $shop.id $productId 4 "+7998$($timestamp.Substring($timestamp.Length - 6))9" | Out-Null
  $insufficientStatus = 'ALLOWED'
} catch {
  $insufficientStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}
Assert-True ($insufficientStatus -ne 'ALLOWED') 'Checkout unexpectedly allowed quantity above available stock.'

$sellerOrders = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/orders?page=1&size=10&search=$($checkout.orderCode)" -Headers $headers
Assert-True (@($sellerOrders.items | Where-Object { $_.id -eq $checkout.orderId }).Count -eq 1) 'Seller orders did not contain checkout order.'

$sellerPayments = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/payments?page=1&size=10&search=$($checkout.orderCode)" -Headers $headers
Assert-True (@($sellerPayments.items | Where-Object { $_.id -eq $checkout.orderId -and $_.paymentStatus -eq 'PENDING' }).Count -eq 1) 'Seller payments did not contain pending payment.'

$tracked = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/public/orders/track?orderCode=$($checkout.orderCode)&phone=$([uri]::EscapeDataString($customerPhone))"
Assert-True ($tracked.orderCode -eq $checkout.orderCode) 'Customer order tracking by orderCode and phone failed.'

$env:TARGET_PRODUCT_ID = $productId
$beforeReimportRaw = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const productId = process.env.TARGET_PRODUCT_ID;
  const [variants, images] = await Promise.all([
    prisma.productVariant.count({ where: { productId } }),
    prisma.productImage.count({ where: { productId } }),
  ]);
  console.log(JSON.stringify({ variants, images }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
$beforeReimport = $beforeReimportRaw | ConvertFrom-Json

$secondPreviewRaw = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$fixturePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "defaultStockQuantity=0" `
  -F "publishMode=ACTIVE" `
  -F "imageMode=REMOTE_URL" `
  "$baseUrl/api/shops/$($shop.id)/imports/wildberries/preview"
$secondPreview = $secondPreviewRaw | ConvertFrom-Json
$secondConfirm = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/imports/wildberries/confirm" -Headers $headers -ContentType 'application/json' -Body (@{
  importId = $secondPreview.importId
} | ConvertTo-Json)

$afterProducts = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?search=WB&page=1&size=20" -Headers $headers
$afterReimportRaw = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const productId = process.env.TARGET_PRODUCT_ID;
  const [variants, images] = await Promise.all([
    prisma.productVariant.count({ where: { productId } }),
    prisma.productImage.count({ where: { productId } }),
  ]);
  console.log(JSON.stringify({ variants, images }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
$afterReimport = $afterReimportRaw | ConvertFrom-Json
Remove-Item Env:TARGET_PRODUCT_ID

Assert-True ($afterProducts.meta.total -eq $preview.totalProducts) "Re-import duplicated products. Expected $($preview.totalProducts), got $($afterProducts.meta.total)."
Assert-True ($afterReimport.variants -eq $beforeReimport.variants) 'Re-import duplicated variants.'
Assert-True ($afterReimport.images -eq $beforeReimport.images) 'Re-import duplicated images.'

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $productId
  importId = $preview.importId
  previewProducts = $preview.totalProducts
  previewVariants = $preview.totalVariants
  previewImages = $preview.totalImages
  createdProducts = $confirm.createdProducts
  updatedProductsOnSecondImport = $secondConfirm.updatedProducts
  priceBefore = $variant.basePrice
  priceAfter = $unitPrice
  stockBeforeSellerUpdate = $inventoryBeforeUpdate.totalAvailableQuantity
  stockAfterSellerUpdate = $updatedInventory.totalAvailableQuantity
  orderId = $checkout.orderId
  orderCode = $checkout.orderCode
  totalAmount = $checkout.totalAmount
  stockAfterCheckout = $inventoryAfterCheckout.totalAvailableQuantity
  insufficientCheckoutStatus = $insufficientStatus
  sellerCanSeeOrder = $true
  sellerCanSeePendingPayment = $true
  trackedOrderCode = $tracked.orderCode
  productCountAfterReimport = $afterProducts.meta.total
  variantCountAfterReimport = $afterReimport.variants
  imageCountAfterReimport = $afterReimport.images
} | ConvertTo-Json -Compress
