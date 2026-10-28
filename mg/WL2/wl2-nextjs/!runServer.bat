:powershell

: 1
:REM Сначала bun: -->
:bun install
 bun --version

: 2
: Для Windows + PowerShell --> Установка bun: -->
: iex (irm https://bun.sh/install.ps1)
: перезапустить PS

: 3
:REM  Билд: -->
:bun run dev
:bun run build
:bun run start
:Локльный сервер(запустить как только отработал 'bun run dev'): http://localhost:3000

: 4
REM Запускаем сервер + игру: -->
@echo off
chcp 65001 >nul
title Warlords II Next.js (Bun Dev)

REM Открываем браузер СРАЗУ (он может подождать, если сервер ещё не готов)
start "" "http://localhost:3000"

REM Запускаем сервер (эта строка будет висеть, пока работает сервер)
bun run dev

5
: Включить, если нужен лог: -->
:pause