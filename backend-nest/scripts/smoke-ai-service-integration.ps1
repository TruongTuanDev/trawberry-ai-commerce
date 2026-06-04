$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Net.Http

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$aiServiceBaseUrl = if ($env:AI_SERVICE_BASE_URL) { $env:AI_SERVICE_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:8000' }
$allowPaidOpenAiSmoke = if ($env:ALLOW_PAID_OPENAI_SMOKE) { $env:ALLOW_PAID_OPENAI_SMOKE.Trim().ToLowerInvariant() } else { 'false' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-ai-service-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](4000000 + (Get-Random -Minimum 1 -Maximum 99999))
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$composeFile = Join-Path $repoRoot 'infra\docker-compose.yml'
$composeEnvFile = Join-Path $repoRoot 'infra\.env'

function Invoke-Compose {
  param(
    [string[]]$Arguments,
    [hashtable]$EnvironmentOverrides = @{}
  )

  $previousValues = @{}
  foreach ($key in $EnvironmentOverrides.Keys) {
    $previousValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, [string]$EnvironmentOverrides[$key], 'Process')
  }

  try {
    & docker compose -f $composeFile --env-file $composeEnvFile @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose failed with exit code $LASTEXITCODE"
    }
  } finally {
    foreach ($key in $EnvironmentOverrides.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previousValues[$key], 'Process')
    }
  }
}

function Wait-ForHttpOk {
  param(
    [string]$Uri,
    [int]$Attempts = 30,
    [int]$DelayMilliseconds = 1000
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri $Uri
      if ($response) {
        return $response
      }
    } catch {
      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }

  throw "Timed out waiting for $Uri"
}

function Ensure-MockSafeRuntime {
  param(
    [psobject]$Health
  )

  if ($allowPaidOpenAiSmoke -eq 'true') {
    return $Health
  }

  if ($Health.aiImageProvider -eq 'mock') {
    return $Health
  }

  Write-Output 'Recreating ai-service and backend-nest in mock-safe mode for default smoke.'
  Invoke-Compose -Arguments @('up', '-d', '--force-recreate', 'ai-service', 'backend-nest') -EnvironmentOverrides @{
    AI_IMAGE_PROVIDER = 'mock'
    RUN_OPENAI_SMOKE = 'false'
    OPENAI_API_KEY = ''
    STORAGE_DRIVER = 'mock'
    AI_WORKER_MODE = 'ai-service'
  }

  Wait-ForHttpOk -Uri "$baseUrl/api/health" | Out-Null
  $updatedHealth = Wait-ForHttpOk -Uri "$aiServiceBaseUrl/health"
  if ($updatedHealth.aiImageProvider -ne 'mock') {
    throw "Expected ai-service mock provider after mock-safe recreate, got '$($updatedHealth.aiImageProvider)'."
  }

  return $updatedHealth
}

$health = Wait-ForHttpOk -Uri "$aiServiceBaseUrl/health"
if ($health.status -ne 'OK') {
  throw 'ai-service health check failed.'
}

$health = Ensure-MockSafeRuntime -Health $health

if ($health.aiImageProvider -ne 'mock') {
  throw "Default smoke must use mock provider, got '$($health.aiImageProvider)'."
}
if (@('mock', 'local') -notcontains $health.storageDriver) {
  throw "Expected ai-service mock-safe storage, got '$($health.storageDriver)'."
}
if ($health.openaiSmokeEnabled) {
  throw 'Default smoke must not enable paid OpenAI smoke.'
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
if ($runtime.sellerFlowEffectiveMode -ne 'AI_SERVICE_MOCK') {
  throw "Expected seller flow effective mode AI_SERVICE_MOCK, got '$($runtime.sellerFlowEffectiveMode)'."
}
if ($runtime.openAiRealEnabled) {
  throw 'Expected OpenAI real mode to stay disabled in default smoke.'
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "strawberry-smoke-ai-service-$timestamp"
$httpClient = $null

try {
  New-Item -ItemType Directory -Path $tempDir | Out-Null
  $frontFile = Join-Path $tempDir 'front.png'
  $sourceFrontFile = Resolve-Path (Join-Path $PSScriptRoot '..\..\frontend-next\public\demo\try-on-model-female-regular.png')
  Copy-Item -LiteralPath $sourceFrontFile -Destination $frontFile

  $httpClient = [System.Net.Http.HttpClient]::new()
  $httpClient.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $login.accessToken)
  $multipart = [System.Net.Http.MultipartFormDataContent]::new()
  $fileBytes = [System.IO.File]::ReadAllBytes($frontFile)
  $fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
  $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('image/png')
  $multipart.Add($fileContent, 'files', [System.IO.Path]::GetFileName($frontFile))
  $multipart.Add([System.Net.Http.StringContent]::new('FRONT'), 'imageType')

  $uploadHttpResponse = $httpClient.PostAsync("$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images", $multipart).GetAwaiter().GetResult()
  $uploadHttpResponse.EnsureSuccessStatusCode() | Out-Null
  $uploadResponse = $uploadHttpResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
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
} finally {
  if ($httpClient) {
    $httpClient.Dispose()
  }
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

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
  allowPaidOpenAiSmoke = $allowPaidOpenAiSmoke
} | ConvertTo-Json -Compress
