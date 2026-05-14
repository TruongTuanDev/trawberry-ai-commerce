$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-wb-import-$timestamp@example.com"
$password = 'password123'
$fixturePath = Join-Path (Resolve-Path '.').Path 'test\fixtures\wb-products-sample.xlsx'

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke WB Import Seller'
  role = 'SELLER'
} | ConvertTo-Json)

$env:TARGET_USER_ID = $register.userId
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
  email = $email
  password = $password
} | ConvertTo-Json)

$headers = @{
  Authorization = "Bearer $($login.accessToken)"
}

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body (@{
  name = 'Smoke WB Import Shop'
  slug = "smoke-wb-import-shop-$timestamp"
} | ConvertTo-Json)

$previewRaw = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$fixturePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "defaultStockQuantity=7" `
  -F "publishMode=ACTIVE" `
  -F "imageMode=REMOTE_URL" `
  "$baseUrl/api/shops/$($shop.id)/imports/wildberries/preview"
$preview = $previewRaw | ConvertFrom-Json

if ($preview.totalProducts -le 0 -or $preview.totalVariants -le 0 -or $preview.totalImages -le 0) {
  throw "Unexpected preview counts: $previewRaw"
}
if (@($preview.errors).Count -ne 0) {
  throw "Preview returned blocking errors: $previewRaw"
}

$confirm = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/imports/wildberries/confirm" -Headers $headers -ContentType 'application/json' -Body (@{
  importId = $preview.importId
} | ConvertTo-Json)

$products = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?search=WB%20Linen&page=1&size=10" -Headers $headers
if (@($products.items).Count -lt 1) {
  throw 'Imported product was not visible in seller product list.'
}

$productId = $products.items[0].id
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId" -Headers $headers
if (@($detail.variants).Count -lt 2) {
  throw 'Expected grouped variants for SKU-100.'
}
if (@($detail.images).Count -lt 2) {
  throw 'Expected imported remote images for SKU-100.'
}
if (-not (@($detail.images) | Where-Object { $_.wbUrl -like 'https://example.com/*' -or $_.localUrl -like 'https://example.com/*' })) {
  throw 'Expected product detail to expose remote image URLs.'
}

$env:TARGET_PRODUCT_ID = $productId
$remoteImageAuditRaw = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const images = await prisma.productImage.findMany({
    where: { productId: process.env.TARGET_PRODUCT_ID },
    orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
  });
  const urls = images.map((image) => image.wbUrl);
  const duplicateUrls = urls.filter((url, index) => urls.indexOf(url) !== index);
  console.log(JSON.stringify({
    count: images.length,
    mainUrl: images[0]?.wbUrl ?? null,
    firstIsMain: images[0]?.isMain ?? false,
    remoteUrlCount: images.filter((image) => image.wbUrl?.startsWith('https://example.com/') && image.localUrl?.startsWith('https://example.com/')).length,
    storageKeyCount: images.filter((image) => image.storageKey).length,
    duplicateUrlCount: duplicateUrls.length,
  }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
$remoteImageAudit = $remoteImageAuditRaw | ConvertFrom-Json
Remove-Item Env:TARGET_PRODUCT_ID

if ($remoteImageAudit.remoteUrlCount -lt 2 -or $remoteImageAudit.storageKeyCount -ne 0 -or $remoteImageAudit.duplicateUrlCount -ne 0 -or -not $remoteImageAudit.firstIsMain) {
  throw "Remote image persistence audit failed: $remoteImageAuditRaw"
}

$secondPreviewRaw = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$fixturePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "defaultStockQuantity=7" `
  -F "publishMode=ACTIVE" `
  -F "imageMode=REMOTE_URL" `
  "$baseUrl/api/shops/$($shop.id)/imports/wildberries/preview"
$secondPreview = $secondPreviewRaw | ConvertFrom-Json
$secondConfirm = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/imports/wildberries/confirm" -Headers $headers -ContentType 'application/json' -Body (@{
  importId = $secondPreview.importId
} | ConvertTo-Json)

$after = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?search=WB&page=1&size=20" -Headers $headers
if ($after.meta.total -ne $preview.totalProducts) {
  throw "Re-import duplicated products. Expected $($preview.totalProducts), got $($after.meta.total)."
}

$detailAfterReimport = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$productId" -Headers $headers
if (@($detailAfterReimport.images).Count -ne @($detail.images).Count) {
  throw 'Re-import duplicated product images.'
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  importId = $preview.importId
  previewProducts = $preview.totalProducts
  previewVariants = $preview.totalVariants
  previewImages = $preview.totalImages
  previewWarnings = @($preview.warnings).Count
  createdProducts = $confirm.createdProducts
  updatedProductsOnSecondImport = $secondConfirm.updatedProducts
  productListTotalAfterReimport = $after.meta.total
  groupedVariantCount = @($detail.variants).Count
  imageCount = @($detail.images).Count
  remoteImageCount = $remoteImageAudit.remoteUrlCount
  storageKeyCount = $remoteImageAudit.storageKeyCount
  duplicateImageUrlCount = $remoteImageAudit.duplicateUrlCount
} | ConvertTo-Json -Compress
