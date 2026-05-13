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

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$sellerEmail = "onboarding-seller-$stamp@example.com"
$password = "password123"

$seller = Invoke-Json -Method "POST" -Path "/api/auth/register" -Body @{
  email = $sellerEmail
  password = $password
  fullName = "Onboarding Smoke Seller"
  role = "SELLER"
}
if ($seller.approvalStatus -ne "PENDING") {
  throw "Expected new seller approvalStatus PENDING, got $($seller.approvalStatus)"
}

$sellerLogin = Invoke-Json -Method "POST" -Path "/api/auth/login" -Body @{
  email = $sellerEmail
  password = $password
}

$profile = Invoke-Json -Method "PUT" -Path "/api/seller/onboarding/profile" -Token $sellerLogin.accessToken -Body @{
  legalType = "LLC"
  legalName = "Onboarding Smoke LLC"
  inn = "7700000000"
  ogrn = "1027700000000"
  kpp = "770001001"
  legalAddress = "Moscow, Smoke Avenue 7"
  contactName = "Onboarding Smoke Seller"
  contactPhone = "+79990000002"
  contactEmail = $sellerEmail
  bankName = "Smoke Bank"
  bankAccount = "40702810000000000000"
  bik = "044525225"
}
if ($profile.legalName -ne "Onboarding Smoke LLC") {
  throw "Expected onboarding profile to be saved."
}

$documentPath = Join-Path $env:TEMP "onboarding-kyc-$stamp.pdf"
"%PDF-1.4`n% smoke seller onboarding document`n" | Set-Content -LiteralPath $documentPath -Encoding ASCII
$uploadOutput = & curl.exe --ipv4 -s -X POST "$baseUrl/api/seller/onboarding/documents" `
  -H "Authorization: Bearer $($sellerLogin.accessToken)" `
  -F "documentType=COMPANY_REGISTRATION" `
  -F "file=@$documentPath;type=application/pdf"
if ($LASTEXITCODE -ne 0) {
  throw "curl document upload failed with exit code $LASTEXITCODE"
}
$document = $uploadOutput | ConvertFrom-Json
if ($document.status -ne "PENDING") {
  throw "Expected uploaded document PENDING, got $($document.status)"
}

$sellerDocuments = Invoke-Json -Method "GET" -Path "/api/seller/onboarding/documents" -Token $sellerLogin.accessToken
if (@($sellerDocuments | Where-Object { $_.id -eq $document.id }).Count -ne 1) {
  throw "Expected seller document list to contain uploaded document."
}

$adminLogin = Invoke-Json -Method "POST" -Path "/api/auth/login" -Body @{
  email = "demo-admin@trawberry.local"
  password = "DemoAdmin123!"
}

$adminOnboarding = Invoke-Json -Method "GET" -Path "/api/admin/sellers/$($seller.userId)/onboarding" -Token $adminLogin.accessToken
if ($adminOnboarding.profile.legalName -ne "Onboarding Smoke LLC") {
  throw "Expected admin onboarding view to include seller legal profile."
}

$approvedDocument = Invoke-Json -Method "POST" -Path "/api/admin/sellers/$($seller.userId)/documents/$($document.id)/approve" -Token $adminLogin.accessToken
if ($approvedDocument.status -ne "APPROVED") {
  throw "Expected admin-approved document APPROVED, got $($approvedDocument.status)"
}

$approvedSeller = Invoke-Json -Method "POST" -Path "/api/admin/sellers/$($seller.userId)/approve" -Token $adminLogin.accessToken
if ($approvedSeller.sellerApprovalStatus -ne "APPROVED") {
  throw "Expected seller APPROVED after admin approval, got $($approvedSeller.sellerApprovalStatus)"
}

$auditLogs = Invoke-Json -Method "GET" -Path "/api/admin/audit-logs?targetUserId=$($seller.userId)" -Token $adminLogin.accessToken
$sellerApprovedAudit = @($auditLogs | Where-Object { $_.action -eq "SELLER_APPROVED" })
if ($sellerApprovedAudit.Count -lt 1) {
  throw "Expected SELLER_APPROVED audit log for seller."
}

$createdShop = Invoke-Json -Method "POST" -Path "/api/shops" -Token $sellerLogin.accessToken -Body @{
  name = "Onboarding Approved Smoke Shop"
  slug = "onboarding-approved-smoke-shop-$stamp"
}
if (-not $createdShop.id) {
  throw "Expected approved seller to create a shop."
}

@{
  baseUrl = $baseUrl
  sellerId = $seller.userId
  profileLegalName = $profile.legalName
  documentId = $document.id
  documentStatus = $approvedDocument.status
  sellerStatus = $approvedSeller.sellerApprovalStatus
  auditLogCount = @($auditLogs).Count
  createdShopId = $createdShop.id
} | ConvertTo-Json -Compress
