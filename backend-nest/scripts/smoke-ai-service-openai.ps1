$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$aiServiceBaseUrl = if ($env:AI_SERVICE_BASE_URL) { $env:AI_SERVICE_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:8000' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-ai-service-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](4000000 + (Get-Random -Minimum 1 -Maximum 99999))

$health = Invoke-RestMethod -Method Get -Uri "$aiServiceBaseUrl/health"
if ($health.status -ne 'OK') {
  throw "ai-service health check failed."
}

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke AI Service Seller'
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
  name = 'Smoke AI Service Shop'
  slug = "smoke-ai-service-shop-$timestamp"
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke AI Service Product'
  localTitle = 'Smoke AI Service Product'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "strawberry-smoke-ai-service-$timestamp"
New-Item -ItemType Directory -Path $tempDir | Out-Null
$frontFile = Join-Path $tempDir 'front.jpg'
Invoke-WebRequest -Uri 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80' -OutFile $frontFile

$uploadResponse = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "files=@$frontFile;type=image/jpeg" `
  -F "imageType=FRONT" `
  "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" | ConvertFrom-Json
$frontImageId = $uploadResponse[0].id

$creditsBefore = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/ai-credits" -Headers $headers

$task = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/ai-images/tasks" -Headers $headers -ContentType 'application/json' -Body (@{
  taskType = 'PRODUCT_MODEL_IMAGE'
  quantity = 1
  prompt = 'Create a clean marketplace product model image with balanced studio lighting.'
  stylePreset = 'STUDIO'
  inputFrontImageId = $frontImageId
} | ConvertTo-Json)

$taskDetail = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  $taskDetail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/ai-images/tasks/$($task.id)" -Headers $headers
  if ($taskDetail.status -in @('COMPLETED', 'FAILED')) {
    break
  }
}

if (-not $taskDetail -or $taskDetail.status -notin @('COMPLETED', 'FAILED')) {
  throw "AI task $($task.id) did not complete or fail in time."
}

$creditsAfter = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/ai-credits" -Headers $headers
$creditDelta = $creditsBefore.remainingCredits - $creditsAfter.remainingCredits

$generatedProvider = $null
$attachedImageType = $null
$hasAiGeneratedProductImage = $false

if ($taskDetail.status -eq 'COMPLETED') {
  $generatedImage = $taskDetail.generatedImages[0]
  if (-not $generatedImage -or [string]::IsNullOrWhiteSpace($generatedImage.provider)) {
    throw 'Generated image provider metadata was empty.'
  }
  if ($generatedImage.provider -ne 'OPENAI') {
    throw "Expected provider OPENAI but got $($generatedImage.provider)."
  }
  $generatedProvider = $generatedImage.provider

  $attached = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/ai-images/$($generatedImage.id)/attach" -Headers $headers
  $productImages = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" -Headers $headers
  $attachedImageType = $attached.imageType
  $hasAiGeneratedProductImage = @($productImages | Where-Object { $_.imageType -eq 'AI_GENERATED' }).Count -gt 0

  if ($creditDelta -ne 1) {
    throw "Expected 1 credit to be deducted, but delta was $creditDelta."
  }
} elseif ($taskDetail.status -eq 'FAILED') {
  if ($creditDelta -ne 0) {
    throw "Expected 0 credits to be deducted on FAILED, but delta was $creditDelta."
  }
}

Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue

[pscustomobject]@{
  aiServiceStatus = $health.status
  shopId = $shop.id
  productId = $product.id
  taskId = $task.id
  taskStatus = $taskDetail.status
  errorMessage = $taskDetail.errorMessage
  generatedCount = @($taskDetail.generatedImages).Count
  generatedProvider = $generatedProvider
  attachedImageType = $attachedImageType
  hasAiGeneratedProductImage = $hasAiGeneratedProductImage
  creditsBefore = $creditsBefore.remainingCredits
  creditsAfter = $creditsAfter.remainingCredits
  creditDelta = $creditDelta
} | ConvertTo-Json -Compress
