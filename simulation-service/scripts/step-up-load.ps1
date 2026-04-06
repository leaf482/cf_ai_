# Step-up load test for Contents Ranking
# Phases: 100 users (2min) -> 300 (2min) -> 500 (2min) -> 1000 (limit)
# Usage: .\step-up-load.ps1

$SimUrl = if ($env:SIMULATION_URL) { $env:SIMULATION_URL } else { "http://localhost:3000" }
$Duration = 120  # 2 min per phase

$Phases = @(
    @{ users = 100; duration = $Duration },
    @{ users = 300; duration = $Duration },
    @{ users = 500; duration = $Duration },
    @{ users = 1000; duration = 600 }  # 10 min for limit
)

$VideoIds = 1..20 | ForEach-Object { "video$_" }

function Start-Simulation {
    param($Users, $Duration)
    $body = @{
        name = "Phase $Users users"
        type = "normal"
        users = $Users
        video_ids = $VideoIds
        watch_seconds = 30
        ramp_up_seconds = 10
        events_per_second = 1
        duration_seconds = $Duration
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$SimUrl/v1/simulation/start" -Method Post -Body $body -ContentType "application/json"
}

function Stop-Simulation {
    Invoke-RestMethod -Uri "$SimUrl/v1/simulation/stop" -Method Post
}

function Get-Status {
    (Invoke-RestMethod -Uri "$SimUrl/v1/simulation/status" -Method Get)
}

Write-Host "Step-up load test"
Write-Host "Simulation URL: $SimUrl"
Write-Host "Monitor Grafana: http://localhost:3001 (admin/admin)"
Write-Host ""

$i = 0
foreach ($p in $Phases) {
    $i++
    Write-Host "[$i/$($Phases.Count)] Phase: $($p.users) users, $($p.duration)s"
    if ($i -gt 1) {
        Stop-Simulation
        Start-Sleep -Seconds 3
    }
    Start-Simulation -Users $p.users -Duration $p.duration

    $endAt = (Get-Date).AddSeconds($p.duration)
    while ((Get-Date) -lt $endAt) {
        Start-Sleep -Seconds 10
        $s = Get-Status
        if (-not $s.running) {
            Write-Host "  Phase ended early. sent=$($s.sent) errors=$($s.errors)"
            break
        }
        $remaining = [math]::Ceiling(($endAt - (Get-Date)).TotalSeconds)
        Write-Host "  ... ${remaining}s remaining, sent=$($s.sent) errors=$($s.errors)"
    }
}

Stop-Simulation
$final = Get-Status
Write-Host ""
Write-Host "Load test complete."
Write-Host "Total sent: $($final.sent) | Errors: $($final.errors)"
