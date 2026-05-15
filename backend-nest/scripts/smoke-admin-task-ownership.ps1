$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3001' }
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$password = 'password123'
$sellerEmail = "smoke-admin-task-owner-$timestamp@example.com"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function Invoke-Json($method, $path, $headers = $null, $body = $null) {
  $params = @{ Method = $method; Uri = "$baseUrl$path" }
  if ($headers) { $params.Headers = $headers }
  if ($body) {
    $params.ContentType = 'application/json'
    $params.Body = ($body | ConvertTo-Json -Depth 8)
  }
  Invoke-RestMethod @params
}

$seller = Invoke-Json 'POST' '/api/auth/register' $null @{
  email = $sellerEmail
  password = $password
  fullName = 'Smoke Admin Task Seller'
  role = 'SELLER'
}
Assert-True ($seller.userId) 'Pending seller was not created.'

$adminLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = 'demo-admin@trawberry.local'; password = 'DemoAdmin123!' }
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }
$sellerLogin = Invoke-Json 'POST' '/api/auth/login' $null @{ email = $sellerEmail; password = $password }
$sellerHeaders = @{ Authorization = "Bearer $($sellerLogin.accessToken)" }

$queue = Invoke-Json 'GET' "/api/admin/queues/sellers?status=PENDING&q=$([uri]::EscapeDataString($sellerEmail))" $adminHeaders
Assert-True (@($queue.items).Count -eq 1) 'Expected one pending seller queue item.'
$item = $queue.items[0]
Assert-True ($item.entityType -eq 'SELLER') 'Queue item did not include entityType SELLER.'

$task = Invoke-Json 'POST' '/api/admin/queue-tasks' $adminHeaders @{
  entityType = $item.entityType
  entityId = $item.entityId
  sellerId = $item.sellerId
  title = "Review $sellerEmail"
  summary = 'Smoke ownership task'
  slaStatus = $item.slaStatus
  priority = 'NORMAL'
}
Assert-True ($task.id) 'Task was not created.'

$assigned = Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/assign" $adminHeaders @{ assignedToUserId = 'me' }
Assert-True ($assigned.assignedToUserId -eq $adminLogin.userId) 'Task was not assigned to current admin.'
Assert-True ($assigned.status -eq 'IN_PROGRESS') 'Claim did not set task in progress.'

$inProgress = Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/status" $adminHeaders @{ status = 'IN_PROGRESS'; note = 'Working smoke task' }
Assert-True ($inProgress.status -eq 'IN_PROGRESS') 'Task status update failed.'

$escalated = Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/escalate" $adminHeaders @{ priority = 'URGENT'; note = 'Smoke escalation' }
Assert-True ($escalated.status -eq 'ESCALATED') 'Task escalation status failed.'
Assert-True ($escalated.priority -eq 'URGENT') 'Task escalation priority failed.'

$resolved = Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/status" $adminHeaders @{ status = 'RESOLVED'; note = 'Smoke resolved' }
Assert-True ($resolved.status -eq 'RESOLVED') 'Task resolve failed.'

$events = Invoke-Json 'GET' "/api/admin/queue-tasks/$($task.id)/events" $adminHeaders
Assert-True (@($events).Count -ge 5) 'Expected task events to be created.'

$forbiddenStatus = $null
try {
  Invoke-Json 'POST' "/api/admin/queue-tasks/$($task.id)/assign" $sellerHeaders @{ assignedToUserId = 'me' } | Out-Null
} catch {
  $forbiddenStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($forbiddenStatus -eq 403) "Expected seller task access 403, got $forbiddenStatus."

[pscustomobject]@{
  baseUrl = $baseUrl
  sellerEmail = $sellerEmail
  taskId = $task.id
  assignedToUserId = $assigned.assignedToUserId
  escalatedStatus = $escalated.status
  resolvedStatus = $resolved.status
  eventCount = @($events).Count
  sellerAccessStatus = $forbiddenStatus
} | ConvertTo-Json -Compress
