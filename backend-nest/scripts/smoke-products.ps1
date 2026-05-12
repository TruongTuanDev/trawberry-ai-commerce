$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-products-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](1000000 + (Get-Random -Minimum 1 -Maximum 99999))

$registerPayload = @{
  email = $email
  password = $password
  fullName = 'Smoke Product Seller'
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
  name = 'Smoke Product Shop'
  slug = "smoke-product-shop-$timestamp"
} | ConvertTo-Json

$shop = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops" -Headers $headers -ContentType 'application/json' -Body $shopPayload

$createProductPayload = @{
  wbNmId = $productNmId
  wbTitle = 'Smoke Product'
  brand = 'Strawberry'
  localTitle = 'Smoke Product Local'
  localDescription = 'Smoke product description'
  visibility = 'ACTIVE'
  images = @(
    @{
      wbUrl = 'https://example.com/smoke-product-main.jpg'
      isMain = $true
      sortOrder = 0
    }
  )
} | ConvertTo-Json -Depth 6

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body $createProductPayload
$list = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?search=Smoke&page=1&size=10&status=ACTIVE" -Headers $headers
$detail = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)" -Headers $headers

$updatePayload = @{
  localTitle = 'Smoke Product Updated'
  visibility = 'DRAFT'
} | ConvertTo-Json

$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)" -Headers $headers -ContentType 'application/json' -Body $updatePayload
Invoke-WebRequest -Method Delete -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)" -Headers $headers -UseBasicParsing | Out-Null

$deleteFollowup = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)" -Headers $headers -ErrorAction Stop | Out-Null
  $deleteFollowup = 'STILL_EXISTS'
} catch {
  if ($_.Exception.Response.StatusCode.value__) {
    $deleteFollowup = [string]$_.Exception.Response.StatusCode.value__
  } else {
    $deleteFollowup = 'ERROR'
  }
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shop.id
  productId = $product.id
  productRole = $login.role
  productApprovalStatus = $login.approvalStatus
  listItems = @($list.items).Count
  listTotal = $list.meta.total
  detailTitle = $detail.wbTitle
  updatedTitle = $updated.localTitle
  updatedVisibility = $updated.visibility
  deleteFollowup = $deleteFollowup
} | ConvertTo-Json -Compress
