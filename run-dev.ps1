$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPython = Join-Path $projectRoot "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $backendPython)) {
    throw "Backend environment not found. Follow the README setup steps in backend/ first."
}

Write-Host "Starting Smart EV Journey Planner API on http://localhost:8000" -ForegroundColor Green
$apiJob = Start-Job -ScriptBlock {
    param($root, $pythonExecutable)
    Set-Location "$root\backend"
    & $pythonExecutable -m uvicorn app.main:app --reload --port 8000
} -ArgumentList $projectRoot, $backendPython

Write-Host "Starting React UI on http://localhost:5173" -ForegroundColor Green
try {
    Set-Location "$projectRoot\frontend"
    npm run dev
}
finally {
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob -Force -ErrorAction SilentlyContinue
}
