$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-product-images-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](2000000 + (Get-Random -Minimum 1 -Maximum 99999))

$registerPayload = @{
  email = $email
  password = $password
  fullName = 'Smoke Product Images Seller'
  role = 'SELLER'
} | ConvertTo-Json

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body $registerPayload
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

$loginPayload = @{
  email = $email
  password = $password
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body $loginPayload
$headers = @{
  Authorization = "Bearer $($login.accessToken)"
}

$shopPayload = @{
  name = 'Smoke Product Image Shop'
  slug = "smoke-product-image-shop-$timestamp"
} | ConvertTo-Json
$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body $shopPayload

$productPayload = @{
  wbNmId = $productNmId
  wbTitle = 'Smoke Product Image Product'
  localTitle = 'Smoke Product Image Product'
  visibility = 'ACTIVE'
} | ConvertTo-Json
$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body $productPayload

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "strawberry-smoke-product-images-$timestamp"
New-Item -ItemType Directory -Path $tempDir | Out-Null
$fileA = Join-Path $tempDir 'front.jpg'
$fileB = Join-Path $tempDir 'back.png'
[System.IO.File]::WriteAllBytes($fileA, [byte[]](255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,217))
[System.IO.File]::WriteAllBytes($fileB, [byte[]](137,80,78,71,13,10,26,10))

$uploadResponse = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "files=@$fileA;type=image/jpeg" `
  -F "imageType=FRONT" `
  "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" | ConvertFrom-Json
$secondUploadResponse = curl.exe -s -X POST `
  -H "Authorization: Bearer $($login.accessToken)" `
  -F "files=@$fileB;type=image/png" `
  -F "imageType=BACK" `
  "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" | ConvertFrom-Json

$firstImageId = $uploadResponse[0].id
$secondImageId = $secondUploadResponse[0].id

$list = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" -Headers $headers
$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images/$secondImageId" -Headers $headers -ContentType 'application/json' -Body (@{
  isMain = $true
  imageType = 'DETAIL'
  sortOrder = 9
} | ConvertTo-Json)
Invoke-WebRequest -Method Delete -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images/$firstImageId" -Headers $headers -UseBasicParsing | Out-Null

$otherRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = "smoke-product-images-other-$timestamp@example.com"
  password = $password
  fullName = 'Other Seller'
  role = 'SELLER'
} | ConvertTo-Json)
$env:TARGET_USER_ID = $otherRegister.userId
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
$otherLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body (@{
  email = $otherRegister.email
  password = $password
} | ConvertTo-Json)
$otherHeaders = @{
  Authorization = "Bearer $($otherLogin.accessToken)"
}
$crossShopStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/images" -Headers $otherHeaders -ErrorAction Stop | Out-Null
  $crossShopStatus = 'ALLOWED'
} catch {
  $crossShopStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}

Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  uploadCount = @($uploadResponse).Count + @($secondUploadResponse).Count
  listCount = @($list).Count
  updatedImageId = $updated.id
  updatedIsMain = $updated.isMain
  updatedImageType = $updated.imageType
  updatedSortOrder = $updated.sortOrder
  crossShopStatus = $crossShopStatus
} | ConvertTo-Json -Compress
