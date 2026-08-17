@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-flux2.ps1"
set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" (
  echo Installer finished with error code %EXIT_CODE%.
) else (
  echo Installer finished successfully.
)
pause
exit /b %EXIT_CODE%
