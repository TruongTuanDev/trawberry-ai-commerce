$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-inventory-alerts-$timestamp@example.com"
$password = 'password123'

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke Inventory Alerts Seller'
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
  name = 'Smoke Inventory Alerts Shop'
  slug = "smoke-inventory-alerts-shop-$timestamp"
  paymentInstructions = 'Transfer then await confirmation.'
} | ConvertTo-Json)

function New-SmokeProduct {
  param(
    [string]$Title,
    [int64]$WbNmId
  )

  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
    wbNmId = $WbNmId
    wbTitle = $Title
    localTitle = $Title
    localDescription = "$Title description"
    visibility = 'ACTIVE'
  } | ConvertTo-Json)
}

$productOut = New-SmokeProduct -Title 'Alerts Out Product' -WbNmId (7000000 + (Get-Random -Minimum 1 -Maximum 99999))
$productLow = New-SmokeProduct -Title 'Alerts Low Product' -WbNmId (7100000 + (Get-Random -Minimum 1 -Maximum 99999))
$productIn = New-SmokeProduct -Title 'Alerts In Product' -WbNmId (7200000 + (Get-Random -Minimum 1 -Maximum 99999))

$env:PRODUCT_OUT_ID = $productOut.id
$env:PRODUCT_LOW_ID = $productLow.id
$env:PRODUCT_IN_ID = $productIn.id
@'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createVariant(productId, chrtId, stockQuantity, lowStockThreshold) {
  await prisma.productVariant.create({
    data: {
      productId,
      chrtId: BigInt(chrtId),
      techSize: 'ONE',
      wbSize: 'ONE',
      basePrice: 49,
      stockQuantity,
      reservedStock: 0,
      lowStockThreshold,
      trackInventory: true,
    },
  });
}

(async () => {
  const now = Date.now();
  await createVariant(process.env.PRODUCT_OUT_ID, now + 1, 0, 5);
  await createVariant(process.env.PRODUCT_LOW_ID, now + 2, 2, 5);
  await createVariant(process.env.PRODUCT_IN_ID, now + 3, 10, 5);
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
Remove-Item Env:PRODUCT_OUT_ID
Remove-Item Env:PRODUCT_LOW_ID
Remove-Item Env:PRODUCT_IN_ID

$outList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?page=1&size=20&stockStatus=OUT_OF_STOCK" -Headers $headers
$lowList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?page=1&size=20&stockStatus=LOW_STOCK" -Headers $headers
$inList = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?page=1&size=20&stockStatus=IN_STOCK" -Headers $headers

$updatedLowInventory = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$($productLow.id)/inventory" -Headers $headers -ContentType 'application/json' -Body (@{
  stockQuantity = 7
} | ConvertTo-Json)

$lowAfterUpdate = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?page=1&size=20&stockStatus=LOW_STOCK" -Headers $headers
$inAfterUpdate = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products?page=1&size=20&stockStatus=IN_STOCK" -Headers $headers

[pscustomobject]@{
  shopId = $shop.id
  outOfStockIds = @($outList.items | ForEach-Object { $_.id })
  lowStockIds = @($lowList.items | ForEach-Object { $_.id })
  inStockIds = @($inList.items | ForEach-Object { $_.id })
  updatedLowStockStatus = $updatedLowInventory.stockStatus
  lowAfterUpdateIds = @($lowAfterUpdate.items | ForEach-Object { $_.id })
  inAfterUpdateIds = @($inAfterUpdate.items | ForEach-Object { $_.id })
} | ConvertTo-Json -Compress
