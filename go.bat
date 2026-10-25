@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================
REM   НАСТРОЙКИ — меняй здесь
REM ============================================
set "START_PAGE=index"
set "PAGE_EXT=.html"
set "PORT=8000"
REM ============================================

REM Собираем полный URL и путь к файлу ЗАРАНЕЕ
set "URL=http://localhost:%PORT%/%START_PAGE%%PAGE_EXT%"
set "LOCAL_FILE=%CD%\%START_PAGE%%PAGE_EXT%"

echo ============================================
echo   Запуск локального сервера на Python
echo   Папка: %CD%
echo   Страница: %START_PAGE%%PAGE_EXT%
echo   Порт: %PORT%
echo   URL: %URL%
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

REM (Необязательно) Проверка, что файл существует
if not exist "%LOCAL_FILE%" (
    echo [ПРЕДУПРЕЖДЕНИЕ] Файл не найден: %LOCAL_FILE%
    echo Браузер всё равно откроется, но страница может быть недоступна.
    echo.
)

REM Создаём временный сервер с запретом кэширования
> "%~dp0_no_cache_server.py" (
    echo import http.server
    echo import socketserver
    echo.
    echo PORT = %PORT%
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
start "" cmd /c "timeout /t 1 >nul & start "" "%URL%""

REM Запустить сервер без кэша (Ctrl+C — остановить)
python "%~dp0_no_cache_server.py"

REM Уборка временного файла после остановки сервера
del "%~dp0_no_cache_server.py" >nul 2>nul

pause