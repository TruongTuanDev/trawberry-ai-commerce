$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$customerEmail = "smoke-yandex-ready-$timestamp@example.com"
$password = 'password123'
$customerPhone = "+7995$((Get-Random -Minimum 1000000 -Maximum 9999999))"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType 'application/json' -Body (@{
  email = $customerEmail
  password = $password
  fullName = 'Smoke Yandex Ready Customer'
  role = 'CUSTOMER'
} | ConvertTo-Json) | Out-Null

$customerLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/customer/login" -ContentType 'application/json' -Body (@{
  identifier = $customerEmail
  password = $password
} | ConvertTo-Json)
$customerHeaders = @{ Authorization = "Bearer $($customerLogin.accessToken)" }

$address = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/customer/addresses" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  fullName = 'Smoke Yandex Ready Customer'
  phone = $customerPhone
  country = 'Russia'
  countryCode = 'RU'
  city = 'Moscow'
  region = 'Moscow'
  street = 'Tverskaya'
  building = '18'
  entrance = '1'
} | ConvertTo-Json)

Assert-True ($address.yandexManualReady -eq $true) 'Expected manual-ready address.'
Assert-True ($address.yandexApiReady -eq $false) 'Expected address without coordinates to stay API-not-ready.'

$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/customer/addresses/$($address.id)" -Headers $customerHeaders -ContentType 'application/json' -Body (@{
  latitude = 55.765369
  longitude = 37.605192
  geoPrecision = 'MANUAL_PIN'
  geoProvider = 'MANUAL'
} | ConvertTo-Json)

Assert-True ($updated.yandexApiReady -eq $true) 'Expected manual pin coordinates to become API-ready.'
Assert-True ($updated.geoReadiness.hasCoordinates -eq $true) 'Expected coordinates readiness.'

[pscustomobject]@{
  baseUrl = $baseUrl
  addressId = $updated.id
  manualReady = $updated.yandexManualReady
  apiReady = $updated.yandexApiReady
} | ConvertTo-Json -Compress
