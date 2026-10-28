#!/bin/bash
# Сборка автономной single-file версии Warlords II (download/warlords2-standalone/index.html)
set -euo pipefail
cd /home/z/my-project

echo "[1/3] esbuild: бандлим three.js + игровое ядро + ванильный UI..."
bunx esbuild src/standalone/main.ts \
  --bundle --minify --format=iife --charset=utf8 \
  --outfile=.build/bundle.js

echo "[2/3] Инжектим бандл в HTML-шаблон..."
bun scripts/inject-standalone.ts

echo "[3/3] Готово: download/warlords2-standalone/index.html"
