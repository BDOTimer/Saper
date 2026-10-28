/**
 * Инжектор бандла в HTML-шаблон автономной сборки.
 * Читает .build/bundle.js (результат esbuild) и scripts/standalone-template.html,
 * пишет готовый single-file index.html в download/ и public/standalone/.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const root = '/home/z/my-project';
const tpl = readFileSync(join(root, 'scripts/standalone-template.html'), 'utf8');
let js = readFileSync(join(root, '.build/bundle.js'), 'utf8');

// Защита от преждевременного закрытия тега <script> внутри бандла
js = js.replaceAll('</script', '<\\/script');
// $ в replacement-строках не интерпретируем: используем функцию
const html = tpl.replace('/*__BUNDLE__*/', () => js);

mkdirSync(join(root, 'download/warlords2-standalone'), { recursive: true });
writeFileSync(join(root, 'download/warlords2-standalone/index.html'), html);

mkdirSync(join(root, 'public/standalone'), { recursive: true });
writeFileSync(join(root, 'public/standalone/index.html'), html);

console.log('standalone index.html:', (html.length / 1024).toFixed(0), 'KB');
