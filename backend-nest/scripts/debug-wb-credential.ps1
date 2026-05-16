$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$shopId = if ($env:SHOP_ID) { $env:SHOP_ID.Trim() } elseif ($env:WB_REAL_SHOP_ID) { $env:WB_REAL_SHOP_ID.Trim() } else { '' }
$sellerEmail = if ($env:WB_DEBUG_SELLER_EMAIL) { $env:WB_DEBUG_SELLER_EMAIL.Trim() } else { 'demo-seller@trawberry.local' }
$sellerPassword = if ($env:WB_DEBUG_SELLER_PASSWORD) { $env:WB_DEBUG_SELLER_PASSWORD.Trim() } else { 'DemoSeller123!' }
$testArticle = if ($env:WB_REAL_TEST_ARTICLE) { $env:WB_REAL_TEST_ARTICLE.Trim() } else { '' }

if (-not $shopId) {
  throw 'SHOP_ID or WB_REAL_SHOP_ID is required. Save the WB API key through the seller UI first, then rerun this script.'
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

$sellerLogin = Invoke-Json 'POST' '/api/auth/login' $null @{
  email = $sellerEmail
  password = $sellerPassword
}
$headers = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$statusBefore = Invoke-Json 'GET' "/api/shops/$shopId/wb-sync/credentials/status" $headers
$diagnostics = Invoke-Json 'GET' "/api/shops/$shopId/wb-sync/diagnostics" $headers

$verifyError = $null
$verify = $null
try {
  $verify = Invoke-Json 'POST' "/api/shops/$shopId/wb-sync/credentials/verify" $headers
} catch {
  $response = $_.Exception.Response
  $statusCode = if ($response) { [int]$response.StatusCode } else { $null }
  $message = try {
    (($response.GetResponseStream() | % { New-Object IO.StreamReader($_) }).ReadToEnd() | ConvertFrom-Json).message
  } catch {
    $_.Exception.Message
  }
  $verifyError = [pscustomobject]@{
    httpStatus = $statusCode
    message = $message
  }
}

$statusAfter = Invoke-Json 'GET' "/api/shops/$shopId/wb-sync/credentials/status" $headers
$preview = $null
if (-not $verifyError) {
  $preview = Invoke-Json 'POST' "/api/shops/$shopId/wb-sync/products" $headers @{
    mode = 'PREVIEW'
    limit = 1
    publishMode = 'DRAFT'
    imageMode = 'REMOTE_URL'
  }
}

$articlePreview = $null
if ($testArticle -and -not $verifyError) {
  $articlePreview = Invoke-Json 'POST' "/api/shops/$shopId/wb-sync/products/by-article" $headers @{
    article = $testArticle
    mode = 'PREVIEW'
    publishMode = 'DRAFT'
    imageMode = 'REMOTE_URL'
  }
}

[pscustomobject]@{
  baseUrl = $baseUrl
  shopId = $shopId
  sellerEmail = $sellerEmail
  mode = $statusAfter.mode
  connected = $statusAfter.connected
  keyLast4 = $statusAfter.keyLast4
  statusBefore = [pscustomobject]@{
    lastVerificationStatus = $statusBefore.lastVerificationStatus
    lastVerificationError = $statusBefore.lastVerificationError
  }
  diagnostics = [pscustomobject]@{
    canAttemptRealVerify = $diagnostics.canAttemptRealVerify
    missingConfig = $diagnostics.missingConfig
  }
  verify = if ($verifyError) {
    [pscustomobject]@{
      success = $false
      httpStatus = $verifyError.httpStatus
      error = $verifyError.message
    }
  } else {
    [pscustomobject]@{
      success = $verify.success
      mode = $verify.mode
      fetched = $verify.fetched
      message = $verify.message
    }
  }
  statusAfter = [pscustomobject]@{
    lastVerificationStatus = $statusAfter.lastVerificationStatus
    lastVerificationError = $statusAfter.lastVerificationError
  }
  preview = if ($preview) {
    [pscustomobject]@{
      status = $preview.status
      sourceMode = $preview.sourceMode
      totalProducts = $preview.totalProducts
      totalFetched = $preview.totalFetched
    }
  } else {
    $null
  }
  article = if ($articlePreview) {
    [pscustomobject]@{
      requested = $testArticle
      status = $articlePreview.status
      totalProducts = $articlePreview.totalProducts
    }
  } else {
    $null
  }
} | ConvertTo-Json -Depth 10
