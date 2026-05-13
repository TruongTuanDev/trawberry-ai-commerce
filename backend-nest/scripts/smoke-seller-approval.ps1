$ErrorActionPreference = "Stop"

$baseUrl = $env:BACKEND_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3001"
}

function Invoke-Json {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null,
    [string]$Token = $null
  )

  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Method = $Method
    Uri = "$baseUrl$Path"
    Headers = $headers
    ContentType = "application/json"
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  return Invoke-RestMethod @params
}

function Invoke-Status {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null,
    [string]$Token = $null
  )

  try {
    Invoke-Json -Method $Method -Path $Path -Body $Body -Token $Token | Out-Null
    return 200
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    throw
  }
}

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$sellerEmail = "approval-seller-$stamp@example.com"
$rejectedEmail = "approval-rejected-$stamp@example.com"
$password = "password123"

$seller = Invoke-Json -Method "POST" -Path "/api/auth/register" -Body @{
  email = $sellerEmail
  password = $password
  fullName = "Approval Smoke Seller"
  role = "SELLER"
}
if ($seller.approvalStatus -ne "PENDING") {
  throw "Expected new seller approvalStatus PENDING, got $($seller.approvalStatus)"
}

$sellerLogin = Invoke-Json -Method "POST" -Path "/api/auth/login" -Body @{
  email = $sellerEmail
  password = $password
}

$pendingShopStatus = Invoke-Status -Method "POST" -Path "/api/shops" -Token $sellerLogin.accessToken -Body @{
  name = "Pending Smoke Shop"
  slug = "pending-smoke-shop-$stamp"
}
if ($pendingShopStatus -ne 403) {
  throw "Expected pending seller shop creation to fail with 403, got $pendingShopStatus"
}

$adminLogin = Invoke-Json -Method "POST" -Path "/api/auth/login" -Body @{
  email = "demo-admin@trawberry.local"
  password = "DemoAdmin123!"
}

$pendingSellers = Invoke-Json -Method "GET" -Path "/api/admin/sellers?status=PENDING" -Token $adminLogin.accessToken
$foundPending = @($pendingSellers | Where-Object { $_.userId -eq $seller.userId })
if ($foundPending.Count -ne 1) {
  throw "Expected admin pending list to include smoke seller."
}

$approved = Invoke-Json -Method "POST" -Path "/api/admin/sellers/$($seller.userId)/approve" -Token $adminLogin.accessToken
if ($approved.sellerApprovalStatus -ne "APPROVED") {
  throw "Expected approved seller status APPROVED, got $($approved.sellerApprovalStatus)"
}

$createdShop = Invoke-Json -Method "POST" -Path "/api/shops" -Token $sellerLogin.accessToken -Body @{
  name = "Approved Smoke Shop"
  slug = "approved-smoke-shop-$stamp"
}
if (-not $createdShop.id) {
  throw "Expected approved seller to create a shop."
}

$rejectedSeller = Invoke-Json -Method "POST" -Path "/api/auth/register" -Body @{
  email = $rejectedEmail
  password = $password
  fullName = "Rejected Smoke Seller"
  role = "SELLER"
}

$rejected = Invoke-Json -Method "POST" -Path "/api/admin/sellers/$($rejectedSeller.userId)/reject" -Token $adminLogin.accessToken -Body @{
  reason = "Smoke verification rejection."
}
if ($rejected.sellerApprovalStatus -ne "REJECTED") {
  throw "Expected rejected seller status REJECTED, got $($rejected.sellerApprovalStatus)"
}

$rejectedLogin = Invoke-Json -Method "POST" -Path "/api/auth/login" -Body @{
  email = $rejectedEmail
  password = $password
}
$rejectedShopStatus = Invoke-Status -Method "POST" -Path "/api/shops" -Token $rejectedLogin.accessToken -Body @{
  name = "Rejected Smoke Shop"
  slug = "rejected-smoke-shop-$stamp"
}
if ($rejectedShopStatus -ne 403) {
  throw "Expected rejected seller shop creation to fail with 403, got $rejectedShopStatus"
}

$nonAdminApproveStatus = Invoke-Status -Method "POST" -Path "/api/admin/sellers/$($rejectedSeller.userId)/approve" -Token $sellerLogin.accessToken
if ($nonAdminApproveStatus -ne 403) {
  throw "Expected non-admin approve to fail with 403, got $nonAdminApproveStatus"
}

@{
  baseUrl = $baseUrl
  pendingSellerId = $seller.userId
  pendingShopStatus = $pendingShopStatus
  approvedStatus = $approved.sellerApprovalStatus
  createdShopId = $createdShop.id
  rejectedSellerId = $rejectedSeller.userId
  rejectedStatus = $rejected.sellerApprovalStatus
  rejectedShopStatus = $rejectedShopStatus
  nonAdminApproveStatus = $nonAdminApproveStatus
} | ConvertTo-Json -Compress
