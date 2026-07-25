# Engineering OS — start backend + frontend (two windows)
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host "Starting Engineering OS..." -ForegroundColor Cyan

# Backend window
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$Backend'; if (-not (Test-Path venv)) { python -m venv venv }; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt -q; if (-not (Test-Path ..\data\engineering_os.db)) { python init_db.py }; python app.py"
)

Start-Sleep -Seconds 2

# Frontend window
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$Frontend'; npm install; npm run dev"
)

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:5000/api/health" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:5173" -ForegroundColor Green
