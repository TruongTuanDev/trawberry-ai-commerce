$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'
$sellerEmail = "smoke-wb-api-sync-$timestamp@example.com"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function Invoke-Json($method, $path, $headers = $null, $body = $null) {
  $params = @{ Method = $method; Uri = "$baseUrl$path" }
  if ($headers) { $params.Headers = $headers }
  if ($body) {
    $params.ContentType = 'application/json'
    $params.Body = ($body | ConvertTo-Json -Depth 10)
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
  fullName = 'Smoke WB API Sync Seller'
  role = 'SELLER'
}
Approve-SellerProfile $seller.userId

$sellerLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = $sellerEmail; password = $password }
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-Json 'POST' '/api/shops' $sellerHeaders @{
  name = 'Smoke WB API Sync Shop'
  slug = "smoke-wb-api-sync-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
}

$credentials = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/credentials" $sellerHeaders @{
  apiKey = "mock-wb-api-key-$timestamp"
}
Assert-True ($credentials.hasCredentials -eq $true) 'Credentials status was not stored.'

$previewAll = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products" $sellerHeaders @{
  mode = 'PREVIEW'
  limit = 100
  publishMode = 'DRAFT'
  imageMode = 'REMOTE_URL'
}
Assert-True ($previewAll.status -eq 'COMPLETED') 'Preview all did not complete.'
Assert-True ($previewAll.totalProducts -ge 2) 'Preview all did not fetch mock products.'
Assert-True ($previewAll.createdProducts -eq 0) 'Preview should not create products.'

$importAll = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products" $sellerHeaders @{
  mode = 'IMPORT'
  limit = 100
  publishMode = 'ACTIVE_IF_VALID'
  imageMode = 'REMOTE_URL'
}
Assert-True ($importAll.createdProducts -ge 2) 'Import all did not create products.'
Assert-True ($importAll.createdVariants -ge 2) 'Import all did not create variants.'

$productsAfterImport = Invoke-Json 'GET' "/api/shops/$($shop.id)/products" $sellerHeaders
Assert-True (@($productsAfterImport.items | Where-Object { $_.wbVendorCode -eq 'APT-MOCK-HOODIE' }).Count -eq 1) 'Imported hoodie product not found.'

$articlePreview = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products/by-article" $sellerHeaders @{
  article = 'APT-MOCK-HOODIE'
  mode = 'PREVIEW'
  publishMode = 'DRAFT'
  imageMode = 'REMOTE_URL'
}
Assert-True ($articlePreview.totalProducts -eq 1) 'Article preview did not return exactly one product.'

$articleImport = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products/by-article" $sellerHeaders @{
  article = 'APT-MOCK-HOODIE'
  mode = 'IMPORT'
  publishMode = 'ACTIVE_IF_VALID'
  imageMode = 'REMOTE_URL'
}
Assert-True ($articleImport.updatedProducts -eq 1) 'Article import did not update existing product.'

$resync = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products" $sellerHeaders @{
  mode = 'IMPORT'
  limit = 100
  publishMode = 'ACTIVE_IF_VALID'
  imageMode = 'REMOTE_URL'
}
Assert-True ($resync.updatedProducts -ge 2) 'Re-sync did not update existing products.'

$productsAfterResync = Invoke-Json 'GET' "/api/shops/$($shop.id)/products" $sellerHeaders
$hoodieCount = @($productsAfterResync.items | Where-Object { $_.wbVendorCode -eq 'APT-MOCK-HOODIE' }).Count
Assert-True ($hoodieCount -eq 1) "Expected no duplicate hoodie product, got $hoodieCount."

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  previewProducts = $previewAll.totalProducts
  importCreatedProducts = $importAll.createdProducts
  importCreatedVariants = $importAll.createdVariants
  articlePreviewProducts = $articlePreview.totalProducts
  articleUpdatedProducts = $articleImport.updatedProducts
  resyncUpdatedProducts = $resync.updatedProducts
  hoodieCount = $hoodieCount
} | ConvertTo-Json -Compress
