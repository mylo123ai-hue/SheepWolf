@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Sheep vs Wolf startup

where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major<20 || (major===20 && minor<18) || major>=25 ? 1 : 0)"
if errorlevel 1 goto incompatible_node
rem Reuse an already-running local app rather than starting another copy.
node -e "const timeout=AbortSignal.timeout(1000);Promise.all(['http://127.0.0.1:5173/','http://127.0.0.1:3000/api/health'].map(url=>fetch(url,{signal:timeout}).then(r=>r.ok).catch(()=>false))).then(([web,api])=>process.exit(web&&api?0:web?2:api?3:1))"
set APP_READY=%ERRORLEVEL%
if "%APP_READY%"=="0" goto app_ready
if "%APP_READY%"=="2" goto partial_start
if "%APP_READY%"=="3" goto partial_start

if not exist "node_modules\.bin\vite.cmd" (
  echo First launch: installing the locked Sheep vs Wolf dependencies...
  call npm ci
  if errorlevel 1 goto install_failed
)

rem The Windows CI smoke test keeps the server attached to its tracked process tree.
if defined SHEEPWOLF_LAUNCHER_TEST (
  echo Starting the launcher smoke-test server on loopback...
  call npm run dev
  exit /b !ERRORLEVEL!
)

echo Starting Sheep vs Wolf on this computer only...
start "SheepWolf server - Ctrl+C in this window to stop" cmd /k "cd /d ""%~dp0"" && npm run dev"

for /l %%i in (1,1,45) do (
  node -e "const timeout=AbortSignal.timeout(1000);Promise.all(['http://127.0.0.1:5173/','http://127.0.0.1:3000/api/health'].map(url=>fetch(url,{signal:timeout}).then(r=>r.ok).catch(()=>false))).then(([web,api])=>process.exit(web&&api?0:1))"
  set APP_READY=!ERRORLEVEL!
  if "!APP_READY!"=="0" goto app_ready
  timeout /t 1 /nobreak >nul
)
echo Sheep vs Wolf did not become ready after 45 startup checks.
echo Check the separate SheepWolf server window for startup errors.
echo If ports 3000 or 5173 are already in use, stop that local app and retry.
pause
exit /b 1

:app_ready
echo Sheep vs Wolf is ready at http://127.0.0.1:5173
if defined SHEEPWOLF_LAUNCHER_TEST exit /b 0
start "" http://127.0.0.1:5173
exit /b 0

:missing_node
echo Sheep vs Wolf needs Node.js 20.18 through 24.x.
echo Install the 64-bit Windows LTS release from https://nodejs.org/ and run this file again.
pause
exit /b 1

:incompatible_node
echo This Node.js version is not supported. Sheep vs Wolf needs Node.js 20.18 through 24.x.
echo Install a compatible 64-bit release from https://nodejs.org/ and try again.
pause
exit /b 1

:install_failed
echo Dependency installation failed. Check your internet connection and retry this file.
pause
exit /b 1

:partial_start
echo A Sheep vs Wolf service is already listening, but the full app is not ready.
echo No duplicate server was started. Check ports 3000 and 5173, close the existing server window, and retry.
pause
exit /b 1
