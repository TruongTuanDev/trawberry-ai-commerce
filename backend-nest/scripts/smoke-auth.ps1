$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke-auth-$timestamp@example.com"
$password = 'password123'

$registerPayload = @{
  email = $email
  password = $password
  fullName = 'Smoke Auth User'
  role = 'USER'
} | ConvertTo-Json

$loginPayload = @{
  email = $email
  password = $password
} | ConvertTo-Json

$health = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/health"
$docs = Invoke-WebRequest -UseBasicParsing "$baseUrl/api/docs"
$register = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body $registerPayload
$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body $loginPayload
$headers = @{
  Authorization = "Bearer $($login.accessToken)"
}
$me = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/auth/me" -Headers $headers

[pscustomobject]@{
  baseUrl = $baseUrl
  healthStatus = $health.StatusCode
  docsStatus = $docs.StatusCode
  registerEmail = $register.email
  registerRole = $register.role
  loginEmail = $login.email
  loginRole = $login.role
  tokenPresent = [bool]$login.accessToken
  meEmail = $me.email
  meRole = $me.role
} | ConvertTo-Json -Compress
