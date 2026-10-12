# Защита клиентской JS-игры без бэкенда

Сначала честно о потолке: раз код и данные целиком у игрока — **абсолютной защиты не существует**. Любую переменную можно поменять через DevTools, любой JS — переписать в рантайме. Задача клиентской защиты — сделать чит **долгим и муторным**, а вмешательство — **обнаружимым**. Ниже рабочий набор слоёв, которого хватает против 95% желающих.

---

## Откуда бьют

1. **Консоль**: `money = 999999` — если баланс лежит в глобалке.
2. **Сейвы**: правка localStorage/IndexedDB напрямую.
3. **Подмена кода**: Tampermonkey, расширения, Local Overrides.
4. **Откат времени** в сейве (болезнь idle-игр).

---

## Слой 1. Не держите число «голым»

Плохо:
```js
window.money = 100; // читер пишет money = 999999 в консоль — конец
```

Хорошо: закрытая область видимости + маскировка + зеркальная копия + все изменения только через API с лимитами:

```js
const Wallet = (() => {
  const K = crypto.getRandomValues(new Uint32Array(2)); // ключ только на сессию
  let m = 0, mirror = 0, flag = false;
  let ledger = [];

  const mask   = v => (v ^ K[0]) >>> 0;
  const unmask = v => (v ^ K[0]) >>> 0;

  // Белый список источников дохода: [максимум за раз, максимум в секунду]
  const LIMITS = Object.freeze({ click: [10, 500], quest: [1000, 5000] });
  let sec = 0, sum = 0;

  function balance() {
    const a = unmask(m), b = (mirror - K[1]) >>> 0;
    if (a !== b) flag = true;          // копии разошлись — кто-то лез
    return unmask(m);
  }

  function set(v, delta, src) {
    v = Math.min(4294967295, Math.max(0, Math.floor(v))); // потолок 2^32 (для больших сумм — старшая/младшая части)
    m = mask(v);
    mirror = (v + K[1]) >>> 0;
    ledger.push({ t: Date.now(), d: delta, s: src });
    if (ledger.length > 300) ledger.shift();
  }

  function earn(amount, src) {
    const lim = LIMITS[src];
    if (!lim || amount <= 0 || amount > lim[0]) { flag = true; return; }
    const now = (Date.now() / 1000) | 0;
    if (now !== sec) { sec = now; sum = 0; }
    if (sum + amount > lim[1]) { flag = true; return; }   // слишком быстро кликает
    sum += amount;
    set(balance() + amount, amount, src);
  }

  function spend(amount, reason) {
    if (amount <= 0 || amount > balance()) return false;
    set(balance() - amount, -amount, reason);
    return true;
  }

  return { balance, earn, spend, get tampered() { return flag; } };
})();
```

Что это даёт:
- поиск по памяти «обычного числа» ничего не находит — оно хранится XOR-нутым и в двух местах;
- правка одной копии ломает вторую → тихий флаг;
- нельзя «начислить» себе миллион — изменения идут только через `earn/spend` с лимитами и журналом.

## Слой 2. Сейвы под подписью

HMAC-SHA256 через WebCrypto:

```js
const KEY_PARTS = ['s3cr', 'et_p', 'hras']; // куски по разным местам кода

async function hmac(text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',
    enc.encode(KEY_PARTS.join('') + '::v1'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function save(state) {
  const data = JSON.stringify(state);
  localStorage.setItem('save1', data);
  localStorage.setItem('sig1', await hmac(data));
}

async function load() {
  const data = localStorage.getItem('save1');
  if (!data || (await hmac(data)) !== localStorage.getItem('sig1')) {
    return null; // сейв подменён/повреждён → откат к другому слоту
  }
  return JSON.parse(data);
}
```

Плюс:
- **2–3 слота** сейва: текущий «побит» → откат к последнему валидному;
- **анти-роллбэк**: храните `lastSeen = Date.now()`; если время из сейва «убежало в будущее» относительно служебной записи — зажимайте офлайн-доход и ставьте флаг.

## Слой 3. Фоновые проверки и тихая реакция

```js
(function loop() {
  Wallet.balance(); // сверка зеркальных копий
  if (Wallet.tampered) restoreLastValidSave(); // НЕ сохранять битое состояние
  setTimeout(loop, 5000 + Math.random() * 20000); // случайный интервал
})();
```

Важно: **не делайте** `alert('ЧИТЕР!')` — читер найдёт проверку по алерту за минуту. Реакция тихая: откат к снапшоту, отказ сохраняться, нематериальный флаг. Цены/награды — в `Object.freeze`-конфиге.

## Слой 4. Приманка (honeypot)

```js
Object.defineProperty(window, 'money', {
  get: () => Wallet.balance(),        // выглядит как настоящее
  set: () => { flagCheat('honeypot'); } // запись ничего не меняет, но палит
});
```

В консоли `money = 999999` срабатывает «успешно», но баланс не меняется, а попытка зафиксирована.

## Слой 5. Затруднение реверса

```bash
npx javascript-obfuscator dist/game.js \
  --compact true --string-array true \
  --string-array-encoding rc4 \
  --control-flow-flattening true --self-defending true
```

- никаких маркерных имён `money`, `gold`, `cheat`, `check`; в консоль баланс не логировать;
- ловушки DevTools (`debugger;` в цикле, замер таймингов `setInterval`) — по желанию: новичков отпугивают, но обходятся и бьют по UX.

---

## Чеклист минимума

1. Деньги только внутри модуля, ноль глобалок.
2. Маскированное хранение + зеркальная копия.
3. `earn/spend` с белым списком источников, разовыми и посекундными лимитами.
4. Сейв подписан HMAC, 2–3 слота, анти-роллбэк времени.
5. Фоновые проверки, тихая реакция, honeypot.
6. Обфускация, «правильные» имена переменных.

Это полностью отсекает правку через консоль и сейвы и серьёзно замедляет остальных. Но если игре когда-нибудь станет важен честный рейтинг или покупки — единственное настоящее решение останется только одно: авторитетный сервер, пусть даже бесплатный serverless.

---

Сразу отвечу честно и прямо: **на 100% защитить клиентскую JS-игру без бекенда от читерства НЕВОЗМОЖНО.** 

Правило информационной безопасности гласит: **клиент всегда лжёт**. Игрок имеет полный контроль над своим браузером. Он может поставить игру на паузу, изменить переменные в памяти через DevTools, подменить сам JS-код перед выполнением, использовать расширения типа Cheat Engine или просто отредактировать `localStorage` вручную.

Однако, ваша задача — **максимально усложнить жизнь читеру**, чтобы отсеять 99% ленивых игроков, которые просто хотят «вписать себе денег» через консоль.

Вот многоуровневая система защиты для вашего случая (сохранение денег в `localStorage`).

---

### Уровень 1. Не храним «голые» числа (Обфускация)
Самая частая ошибка: `localStorage.setItem('money', 1000)`. Игрок открывает консоль, пишет `localStorage.setItem('money', 999999)` и побеждает.

**Решение:** Шифруем значение перед сохранением. Используем простое XOR-шифрование с секретным ключом (солью), который зашит в коде игры.

```javascript
const SECRET_KEY = "super_secret_dev_key_2026"; // Ваш секретный ключ

// Простая функция XOR шифрования
function xorEncrypt(text, key) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result); // Дополнительно кодируем в Base64, чтобы не было мусора в localStorage
}

function xorDecrypt(encoded, key) {
    const decoded = atob(encoded);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

// Сохранение
function saveMoney(money) {
    const encrypted = xorEncrypt(money.toString(), SECRET_KEY);
    localStorage.setItem('game_money', encrypted);
}

// Загрузка
function loadMoney() {
    const encrypted = localStorage.getItem('game_money');
    if (!encrypted) return 0;
    const decrypted = xorDecrypt(encrypted, SECRET_KEY);
    return parseInt(decrypted, 10) || 0;
}
```
*Теперь в `localStorage` будет лежать что-то вроде `AwcGBQo=`, а не `1000`. Обычный игрок в консоли сломает себе сохранение.*

---

### Уровень 2. Контрольные суммы (Защита от подмены)
Продвинутый читер поймет, что значение зашифровано, найдет в коде ключ `SECRET_KEY`, расшифрует, изменит число, зашифрует обратно и сохранит.

**Решение:** Сохраняем не только зашифрованные деньги, но и их «хэш» (контрольную сумму). При загрузке мы проверяем: если хэш не сходится — значит, файл сохранения подделан.

```javascript
// Простая хэш-функция (не криптографическая, но для игры подойдет)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
}

function saveMoneySecure(money) {
    const encrypted = xorEncrypt(money.toString(), SECRET_KEY);
    // Хэш зависит от зашифрованной строки И от секретного ключа
    const checksum = simpleHash(encrypted + SECRET_KEY); 
    
    localStorage.setItem('game_save', JSON.stringify({
        m: encrypted,
        h: checksum
    }));
}

function loadMoneySecure() {
    const raw = localStorage.getItem('game_save');
    if (!raw) return 0;
    
    try {
        const save = JSON.parse(raw);
        const expectedHash = simpleHash(save.m + SECRET_KEY);
        
        if (save.h !== expectedHash) {
            console.warn("Обнаружена подмена сохранения! Штраф.");
            return -1000; // Или обнуление, или бан аккаунта в рамках игры
        }
        
        const decrypted = xorDecrypt(save.m, SECRET_KEY);
        return parseInt(decrypted, 10) || 0;
    } catch (e) {
        return 0;
    }
}
```

---

### Уровень 3. «Медовые горшки» (Honeytokens) и Ловушки памяти
Читеры часто ищут переменные в памяти браузера или пытаются подменить DOM-элемент, где отображаются деньги.

**Решение:** Разделяем «реальные» деньги и «отображаемые/сохраняемые» деньги.
В памяти игры всегда хранится `realMoney`. В `localStorage` и на экран выводится `fakeMoney`. 

```javascript
let realMoney = 500;
let fakeMoney = 500;

function gameLoop() {
    // Если читер каким-то образом изменил fakeMoney (через память или localStorage),
    // но не тронул realMoney, мы это заметим.
    if (realMoney !== fakeMoney) {
        // Читер вмешался в процесс!
        realMoney = 0;
        fakeMoney = 0;
        alert("Обнаружен чит! Деньги конфискованы.");
    }
    // ... отрисовка fakeMoney на экране ...
}
```
*Суть:* Вы даете читеру «легальную» цель для взлома. Он думает, что взломал игру, а на самом деле попал в ловушку.

---

### Уровень 4. Валидация через игровую логику (Самый надежный)
Не доверяйте числу из `localStorage`. Доверяйте **событиям**.
Вместо того чтобы сохранять просто `money = 1000`, сохраняйте «журнал транзакций» или проверяйте деньги на соответствие прогрессу.

*Пример:* Если игрок может заработать максимум 100 монет за минуту игры.
```javascript
function loadMoney() {
    let money = loadMoneySecure();
    const lastSaveTime = localStorage.getItem('last_save_time');
    const currentTime = Date.now();
    
    // Если с момента последнего сохранения прошло 5 минут, 
    // а денег стало больше, чем (старое_кол-во + 500), значит, их вписали.
    // (Тут нужна ваша собственная логика ограничения заработка)
    
    return money;
}

```
---

### Уровень 5. Обфускация самого JS-кода
Если читер откроет исходный код (Sources в DevTools), он найдет `SECRET_KEY` и сломает вашу защиту за 2 минуты.
**Решение:** Используйте обфускаторы JS (например, [javascriptobfuscator.com](https://www.obfuscator.io/) или webpack-плагины). Они превратят ваш читаемый код в нечитаемую кашу из `eval`, `_0x4a2c` и странных строк, что отобьет желание копаться в коде у 95% игроков.

---

### Уровень 6. Детект DevTools (Параноидальный)
Можно попытаться понять, открыл ли игрок консоль разработчика. Если открыл — перестать сохранять игру или начать портить сохранение.
*Способ 1:* Использование `debugger;` в бесконечном цикле (если открыты DevTools, игра зависнет).
*Способ 2:* Измерение разницы между `window.outerWidth` и `window.innerWidth` (если панель разработчика открыта сбоку/снизу, размеры будут отличаться).

**⚠️ ВАЖНО:** Этот метод **крайне не рекомендуется** для нормальных игр. Он бесит легитимных игроков, которые зашли посмотреть, почему игра тормозит, и вызывает ложные срабатывания. Используйте только если игра рассчитана на жесткий киберспорт (но без бекенда это всё равно не имеет смысла).

---

### Философский итог (Как относиться к читам)

1. **Если игра одиночная (Singleplayer):** 
   Забейте на защиту. Игрок купил/скачал игру, это его компьютер и его время. Если он хочет играть с `999999` золота — пусть играет. Это его单机-песочница. Защита будет бесить только вас (разработчика) и-legit игроков, у которых что-то сломается.
2. **Если в игре есть таблица лидеров (Leaderboard):**
   Без бекенда таблицу лидеров защитить **невозможно**. Любой сможет отправить `fetch` запрос с фейковым рекордом. В таком случае таблица лидеров должна быть "почетной доской позора", либо вам придется внедрять бекенд (хотя бы на бесплатных Firebase/Supabase/Cloudflare Workers).
3. **Если игра с внутриигровыми покупками (даже за крипту/токены):**
   Только бекенд. Клиентская защита взламывается за вечер.

**Резюме для вашего случая:** Используйте **Уровень 1 + Уровень 2 + Обфускацию кода**. Этого достаточно, чтобы защитить игру от школьников, лезущих в консоль браузера, и сохранить целостность сохранения от случайных багов.