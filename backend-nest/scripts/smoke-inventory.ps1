$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-inventory-$timestamp@example.com"
$password = 'password123'
$productNmId = [int64](6000000 + (Get-Random -Minimum 1 -Maximum 99999))

$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $email
  password = $password
  fullName = 'Smoke Inventory Seller'
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
  name = 'Smoke Inventory Shop'
  slug = "smoke-inventory-shop-$timestamp"
  paymentInstructions = 'Transfer then await confirmation.'
} | ConvertTo-Json)

$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products" -Headers $headers -ContentType 'application/json' -Body (@{
  wbNmId = $productNmId
  wbTitle = 'Smoke Inventory Product'
  localTitle = 'Smoke Inventory Product'
  localDescription = 'Inventory smoke product'
  categoryName = 'Smoke Category'
  visibility = 'ACTIVE'
} | ConvertTo-Json)

$env:TARGET_PRODUCT_ID = $product.id
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  await prisma.productVariant.create({
    data: {
      productId: process.env.TARGET_PRODUCT_ID,
      chrtId: BigInt(Date.now()),
      techSize: 'ONE',
      wbSize: 'ONE',
      basePrice: 99,
      stockQuantity: 2,
      reservedStock: 0,
    },
  });
  await prisma.productImage.create({
    data: {
      id: randomUUID(),
      productId: process.env.TARGET_PRODUCT_ID,
      wbUrl: 'https://example.com/smoke-inventory.jpg',
      localUrl: 'https://example.com/smoke-inventory.jpg',
      isMain: true,
      sortOrder: 0,
    },
  });
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
'@ | node -
Remove-Item Env:TARGET_PRODUCT_ID

$published = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/publish" -Headers $headers -ContentType 'application/json' -Body '{}'
if ($published.catalogStatus -ne 'PUBLISHED') {
  throw 'Inventory smoke product was not published.'
}

$inventoryBefore = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/inventory" -Headers $headers
$variantId = $inventoryBefore.variants[0].id

$firstCheckout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{
    productId = $product.id
    quantity = 1
  })
  customer = @{
    fullName = 'Inventory Customer'
    phone = "+79997770001"
    address = 'Inventory Street 1'
  }
  paymentMethod = 'PREPAID_SELLER_QR'
} | ConvertTo-Json -Depth 5)

$inventoryAfterFirst = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/inventory" -Headers $headers

$secondCheckoutStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
    shopId = $shop.id
    items = @(@{
      productId = $product.id
      quantity = 2
    })
    customer = @{
      fullName = 'Inventory Customer Two'
      phone = "+79997770002"
      address = 'Inventory Street 2'
    }
    paymentMethod = 'PREPAID_SELLER_QR'
  } | ConvertTo-Json -Depth 5) -ErrorAction Stop | Out-Null
  $secondCheckoutStatus = 'ALLOWED'
} catch {
  $secondCheckoutStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}

$updatedInventory = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/inventory" -Headers $headers -ContentType 'application/json' -Body (@{
  variantId = $variantId
  stockQuantity = 5
} | ConvertTo-Json)

$thirdCheckout = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/checkout/orders" -ContentType 'application/json' -Body (@{
  shopId = $shop.id
  items = @(@{
    productId = $product.id
    quantity = 2
  })
  customer = @{
    fullName = 'Inventory Customer Three'
    phone = "+79997770003"
    address = 'Inventory Street 3'
  }
  paymentMethod = 'PAY_ON_DELIVERY_SELLER_QR'
} | ConvertTo-Json -Depth 5)

$inventoryAfterThird = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/inventory" -Headers $headers

$otherRegister = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = "smoke-inventory-other-$timestamp@example.com"
  password = $password
  fullName = 'Other Inventory Seller'
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

$crossShopStatus = 'UNKNOWN'
try {
  Invoke-RestMethod -Method Get -Uri "$baseUrl/api/shops/$($shop.id)/products/$($product.id)/inventory" -Headers @{
    Authorization = "Bearer $($otherLogin.accessToken)"
  } -ErrorAction Stop | Out-Null
  $crossShopStatus = 'ALLOWED'
} catch {
  $crossShopStatus = if ($_.Exception.Response.StatusCode.value__) { [string]$_.Exception.Response.StatusCode.value__ } else { 'ERROR' }
}

[pscustomobject]@{
  shopId = $shop.id
  productId = $product.id
  variantId = $variantId
  firstOrderId = $firstCheckout.orderId
  thirdOrderId = $thirdCheckout.orderId
  stockBefore = $inventoryBefore.totalAvailableQuantity
  stockAfterFirstCheckout = $inventoryAfterFirst.totalAvailableQuantity
  secondCheckoutStatus = $secondCheckoutStatus
  stockAfterSellerUpdate = $updatedInventory.totalAvailableQuantity
  stockAfterThirdCheckout = $inventoryAfterThird.totalAvailableQuantity
  crossShopStatus = $crossShopStatus
} | ConvertTo-Json -Compress
