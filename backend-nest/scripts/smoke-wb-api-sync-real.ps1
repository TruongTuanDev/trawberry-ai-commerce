$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$syncMode = if ($env:WB_SYNC_MODE) { $env:WB_SYNC_MODE.Trim().ToLowerInvariant() } else { 'mock' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'
$sellerEmail = "smoke-wb-api-sync-real-$timestamp@example.com"
$realApiKey = if ($env:WB_REAL_API_KEY) { $env:WB_REAL_API_KEY.Trim() } else { '' }
$testArticle = if ($env:WB_REAL_TEST_ARTICLE) { $env:WB_REAL_TEST_ARTICLE.Trim() } else { '' }

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

if ($syncMode -ne 'real') {
  [pscustomobject]@{
    skipped = $true
    reason = 'WB_SYNC_MODE is not real. Real WB smoke skipped.'
    mode = $syncMode
  } | ConvertTo-Json -Compress
  exit 0
}

if (-not $realApiKey) {
  throw 'WB_SYNC_MODE=real but WB_REAL_API_KEY is missing. Export WB_REAL_API_KEY before running smoke:wb-api-sync-real.'
}

$seller = Invoke-Json 'POST' '/api/auth/register' $null @{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke WB Real API Sync Seller'
  role = 'SELLER'
}
Approve-SellerProfile $seller.userId

$sellerLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = $sellerEmail; password = $password }
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$shop = Invoke-Json 'POST' '/api/shops' $sellerHeaders @{
  name = 'Smoke WB Real API Sync Shop'
  slug = "smoke-wb-real-api-sync-shop-$timestamp"
  paymentInstructions = 'Manual transfer.'
}

$credentials = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/credentials" $sellerHeaders @{
  apiKey = $realApiKey
}
Assert-True ($credentials.connected -eq $true) 'Real WB credentials were not stored.'
Assert-True ($credentials.mode -eq 'real') 'Credentials status did not report real mode.'

$status = Invoke-Json 'GET' "/api/shops/$($shop.id)/wb-sync/credentials/status" $sellerHeaders
Assert-True ($status.connected -eq $true) 'Credential status is not connected after save.'
Assert-True ($status.mode -eq 'real') 'Credential status did not report real mode after save.'

$verify = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/credentials/verify" $sellerHeaders
Assert-True ($verify.success -eq $true) 'WB credential verification failed.'
Assert-True ($verify.mode -eq 'real') 'WB credential verification did not use real mode.'

$statusAfterVerify = Invoke-Json 'GET' "/api/shops/$($shop.id)/wb-sync/credentials/status" $sellerHeaders
Assert-True ($statusAfterVerify.lastVerificationStatus -eq 'SUCCESS') 'Credential status did not persist SUCCESS verification.'

$previewAll = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products" $sellerHeaders @{
  mode = 'PREVIEW'
  limit = 5
  publishMode = 'DRAFT'
  imageMode = 'REMOTE_URL'
}
Assert-True ($previewAll.status -eq 'COMPLETED') 'Real preview all did not complete.'
Assert-True ($previewAll.sourceMode -eq 'real') 'Real preview all fell back to mock mode.'
Assert-True ($previewAll.totalProducts -ge 1) 'Real preview all did not return any products.'

$importAll = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products" $sellerHeaders @{
  mode = 'IMPORT'
  limit = 5
  publishMode = 'DRAFT'
  imageMode = 'REMOTE_URL'
}
Assert-True ($importAll.status -eq 'COMPLETED') 'Real import all did not complete.'
Assert-True ($importAll.sourceMode -eq 'real') 'Real import all fell back to mock mode.'
Assert-True (($importAll.createdProducts + $importAll.updatedProducts) -ge 1) 'Real import all did not import any products.'

$productsAfterImport = Invoke-Json 'GET' "/api/shops/$($shop.id)/products" $sellerHeaders
Assert-True (@($productsAfterImport.items).Count -ge 1) 'No products were found after real WB import.'

$articlePreviewResult = $null
$articleImportResult = $null
if ($testArticle) {
  $articlePreviewResult = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products/by-article" $sellerHeaders @{
    article = $testArticle
    mode = 'PREVIEW'
    publishMode = 'DRAFT'
    imageMode = 'REMOTE_URL'
  }
  Assert-True ($articlePreviewResult.status -eq 'COMPLETED') 'Real article preview did not complete.'
  Assert-True ($articlePreviewResult.sourceMode -eq 'real') 'Real article preview fell back to mock mode.'
  Assert-True ($articlePreviewResult.totalProducts -ge 1) "WB article '$testArticle' was not found during preview."

  $articleImportResult = Invoke-Json 'POST' "/api/shops/$($shop.id)/wb-sync/products/by-article" $sellerHeaders @{
    article = $testArticle
    mode = 'IMPORT'
    publishMode = 'DRAFT'
    imageMode = 'REMOTE_URL'
  }
  Assert-True ($articleImportResult.status -eq 'COMPLETED') 'Real article import did not complete.'
  Assert-True ($articleImportResult.sourceMode -eq 'real') 'Real article import fell back to mock mode.'
  Assert-True (($articleImportResult.createdProducts + $articleImportResult.updatedProducts) -ge 1) "WB article '$testArticle' was not imported."
}

[pscustomobject]@{
  baseUrl = $baseUrl
  mode = $syncMode
  shopId = $shop.id
  verifyFetched = $verify.fetched
  previewProducts = $previewAll.totalProducts
  importProductsCreated = $importAll.createdProducts
  importProductsUpdated = $importAll.updatedProducts
  article = if ($testArticle) { $testArticle } else { $null }
  articlePreviewProducts = if ($articlePreviewResult) { $articlePreviewResult.totalProducts } else { $null }
  articleImportCreated = if ($articleImportResult) { $articleImportResult.createdProducts } else { $null }
  articleImportUpdated = if ($articleImportResult) { $articleImportResult.updatedProducts } else { $null }
} | ConvertTo-Json -Compress
