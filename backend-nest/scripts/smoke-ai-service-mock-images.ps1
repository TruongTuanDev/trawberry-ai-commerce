$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$aiServiceBaseUrl = if ($env:AI_SERVICE_BASE_URL) { $env:AI_SERVICE_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:8000' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-ai-service-mock-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](5000000 + (Get-Random -Minimum 1 -Maximum 99999))

$health = Invoke-RestMethod -Method Get -Uri "$aiServiceBaseUrl/health"
if ($health.status -ne 'OK') {
  throw "ai-service health check failed."
}
if ($health.aiImageProvider -ne 'mock') {
  throw "Expected ai-service mock provider, got '$($health.aiImageProvider)'."
}
if (@('mock', 'local') -notcontains $health.storageDriver) {
  throw "Expected ai-service mock-safe storage, got '$($health.storageDriver)'."
}
if ($health.openaiConfigured) {
  throw 'OpenAI real mode must be disabled for this smoke.'
}

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke AI Service Mock Seller'
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
  name = 'Smoke AI Service Mock Shop'
  slug = "smoke-ai-service-mock-shop-$timestamp"
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke AI Service Mock Product'
  localTitle = 'Smoke AI Service Mock Product'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$runtime = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/ai-images/runtime" -Headers $headers
if ($runtime.workerMode -ne 'ai-service') {
  throw "Expected backend worker mode ai-service, got '$($runtime.workerMode)'."
}
if (-not $runtime.aiServiceReachable) {
  throw 'Expected ai-service to be reachable from backend.'
}
if ($runtime.aiServiceProvider -ne 'mock') {
  throw "Expected runtime provider mock, got '$($runtime.aiServiceProvider)'."
}
if (@('mock', 'local') -notcontains $runtime.aiServiceStorageDriver) {
  throw "Expected runtime storage driver mock/local, got '$($runtime.aiServiceStorageDriver)'."
}
if ($runtime.sellerFlowEffectiveMode -ne 'AI_SERVICE_MOCK') {
  throw "Expected seller flow effective mode AI_SERVICE_MOCK, got '$($runtime.sellerFlowEffectiveMode)'."
}
if ($runtime.openAiRealEnabled) {
  throw 'Expected OpenAI real mode to stay disabled.'
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "strawberry-smoke-ai-service-mock-$timestamp"
New-Item -ItemType Directory -Path $tempDir | Out-Null
$frontFile = Join-Path $tempDir 'front.jpg'
[System.IO.File]::WriteAllBytes($frontFile, [byte[]](255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,217))

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
  prompt = 'Create a clean marketplace studio image for this product without changing the item.'
  stylePreset = 'STUDIO'
  inputFrontImageId = $frontImageId
} | ConvertTo-Json)

$taskDetail = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  $taskDetail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/ai-images/tasks/$($task.id)" -Headers $headers
  if ($taskDetail.status -eq 'COMPLETED') {
    break
  }
}

if (-not $taskDetail -or $taskDetail.status -ne 'COMPLETED') {
  throw "AI task $($task.id) did not complete in time."
}

$generatedImage = $taskDetail.generatedImages[0]
if (-not $generatedImage) {
  throw 'Expected at least one generated image.'
}
if ($generatedImage.provider -notmatch 'MOCK') {
  throw "Expected ai-service mock provider marker, got '$($generatedImage.provider)'."
}

$attached = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/ai-images/$($generatedImage.id)/attach" -Headers $headers
$productImages = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" -Headers $headers
$creditsAfter = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/ai-credits" -Headers $headers

Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue

[pscustomobject]@{
  aiServiceStatus = $health.status
  aiServiceProvider = $health.aiImageProvider
  aiServiceStorageDriver = $health.storageDriver
  runtimeWorkerMode = $runtime.workerMode
  runtimeEffectiveMode = $runtime.sellerFlowEffectiveMode
  taskId = $task.id
  taskStatus = $taskDetail.status
  generatedProvider = $generatedImage.provider
  attachedImageType = $attached.imageType
  hasAiGeneratedProductImage = @($productImages | Where-Object { $_.imageType -eq 'AI_GENERATED' }).Count -gt 0
  creditsBefore = $creditsBefore.remainingCredits
  creditsAfter = $creditsAfter.remainingCredits
  creditDelta = $creditsBefore.remainingCredits - $creditsAfter.remainingCredits
} | ConvertTo-Json -Compress
