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

REM Создаём временный сервер с запретом кэширования
> "%~dp0_no_cache_server.py" (
    echo import http.server
    echo import socketserver
    echo.
    echo PORT = 8000
    echo.
    echo class NoCacheHandler^(http.server.SimpleHTTPRequestHandler^):
    echo     def end_headers^(self^):
    echo         self.send_header^("Cache-Control", "no-cache, no-store, must-revalidate"^)
    echo         self.send_header^("Pragma", "no-cache"^)
    echo         self.send_header^("Expires", "0"^)
    echo         super^(^).end_headers^(^)
    echo.
    echo socketserver.TCPServer.allow_reuse_address = True
    echo.
    echo with socketserver.TCPServer^(^("", PORT^), NoCacheHandler^) as httpd:
    echo     print^(f"Сервер запущен на http://localhost:{PORT}/ ^(без кэширования^)"^)
    echo     httpd.serve_forever^(^)
)

REM Открыть браузер через 1 секунду (сервер успеет подняться)
start "" cmd /c "timeout /t 1 >nul & start http://localhost:8000/mg/etc/bs/005-hunt-3.html"

REM Запустить сервер без кэша (Ctrl+C — остановить)
python "%~dp0_no_cache_server.py"

REM Уборка временного файла после остановки сервера
del "%~dp0_no_cache_server.py" >nul 2>nul

pause