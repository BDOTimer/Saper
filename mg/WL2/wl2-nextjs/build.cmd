@echo off
call next build
if errorlevel 1 exit /b 1

robocopy .next\static .next\standalone\.next\static /E >nul
if errorlevel 8 exit /b 1

robocopy public .next\standalone\public /E >nul
if errorlevel 8 exit /b 1

exit /b 0