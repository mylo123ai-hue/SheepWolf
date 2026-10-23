@echo off
setlocal
cd /d "%~dp0"
title Sheep vs Wolf
where node >nul 2>nul
if errorlevel 1 (
  echo Sheep vs Wolf needs Node.js 20.18 or newer.
  echo Install the Windows LTS release from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major<20 || (major===20 && minor<18) || major>=25 ? 1 : 0)"
if errorlevel 1 (
  echo Sheep vs Wolf requires Node.js 20.18 through 24.x.
  echo Install a compatible Windows LTS release from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo First launch: installing Sheep vs Wolf dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
start "Sheep vs Wolf server" /min cmd /c "cd /d ""%~dp0"" && npm run dev"
timeout /t 4 /nobreak >nul
start "" http://127.0.0.1:5173
endlocal
