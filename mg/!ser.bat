@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Запуск локального сервера на Python
echo   Папка: %CD%
echo ============================================
echo.

REM Проверка, что Python есть
where python >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Python не найден в PATH.
    echo Установи Python 3: https://www.python.org/downloads/
    echo При установке отметь "Add Python to PATH".
    pause
    exit /b 1
)

REM Открыть браузер через 1 секунду (сервер успеет подняться)
start "" cmd /c "timeout /t 1 >nul & start http://localhost:8000/Galaxy-J/g-menu.html"

REM Запустить сервер (Ctrl+C — остановить)
python -m http.server 8000

pause