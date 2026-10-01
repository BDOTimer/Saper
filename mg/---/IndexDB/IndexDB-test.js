const DB_NAME = 'test-game-db';
const VERSION = 1;

// Хелпер: promisify для IDBRequest
const idb = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// Хелпер: дождаться завершения транзакции, в том числе с ошибкой
const txDone = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Транзакция прервана'));
  });

(async () => {
  console.group('%c📊 IndexedDB Inspector + Test Data', 'color:#a8ff78; font-weight:bold; font-size:14px;');

  try {
    await createTestDataIfNeeded(DB_NAME, VERSION);
    await inspectDatabase(DB_NAME);
  } catch (e) {
    console.error('❌ Непредвиденная ошибка:', e);
  } finally {
    console.groupEnd(); // выполнится всегда
  }
})();

async function createTestDataIfNeeded(dbName, version) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);

    req.onupgradeneeded = (e) => {
      console.log('🆕 Создаём/обновляем БД…');
      const db = e.target.result;

      if (!db.objectStoreNames.contains('saves')) {
        const store = db.createObjectStore('saves', { keyPath: 'id', autoIncrement: true });
        store.createIndex('playerName', 'playerName', { unique: false });
        console.log('  ✅ Создано хранилище "saves"');
      }
      if (!db.objectStoreNames.contains('scores')) {
        const store = db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
        store.createIndex('score', 'score', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        console.log('  ✅ Создано хранилище "scores"');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
        console.log('  ✅ Создано хранилище "settings"');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Открытие БД заблокировано другой вкладкой'));
  });

  try {
    // Есть ли уже данные?
    const count = await idb(
      db.transaction('saves', 'readonly').objectStore('saves').count()
    );

    if (count > 0) {
      console.log('  🗄 Данные уже есть — пропускаем заполнение.');
      return;
    }

    console.log('  📝 Добавляем тестовые данные…');

    // saves
    const saveTx = db.transaction('saves', 'readwrite');
    [
      { playerName: 'HeroAlpha', level: 5, credits: 1230, ship: 'Interceptor' },
      { playerName: 'NovaRider', level: 12, credits: 4890, ship: 'Cruiser' },
      { playerName: 'CosmoWolf', level: 3, credits: 210, ship: 'Scout' },
    ].forEach(s => saveTx.objectStore('saves').add(s));
    await txDone(saveTx);

    // scores
    const scoreTx = db.transaction('scores', 'readwrite');
    [
      { playerName: 'HeroAlpha', score: 15200, date: new Date().toISOString() },
      { playerName: 'NovaRider', score: 42100, date: new Date().toISOString() },
      { playerName: 'StarFox', score: 38900, date: new Date().toISOString() },
    ].forEach(s => scoreTx.objectStore('scores').add(s));
    await txDone(scoreTx);

    // settings
    const settingTx = db.transaction('settings', 'readwrite');
    [
      { key: 'volume', value: 0.7 },
      { key: 'musicEnabled', value: true },
      { key: 'difficulty', value: 'normal' },
    ].forEach(s => settingTx.objectStore('settings').add(s));
    await txDone(settingTx);

    console.log('  ✅ Тестовые данные добавлены.');
  } catch (err) {
    console.error('  ❌ Ошибка при записи данных:', err);
  } finally {
    db.close();
  }
}

async function inspectDatabase(dbName) {
  const fmtBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Открытие заблокировано'));
      req.onsuccess = () => resolve(req.result);
    });
  } catch (e) {
    console.error('❌ Не удалось открыть БД:', e);
    return;
  }

  const storeNames = Array.from(db.objectStoreNames);
  if (!storeNames.length) {
    console.log('%c(нет хранилищ)', 'color:#888');
    db.close();
    return;
  }

  let totalSize = 0;
  let totalRecords = 0;

  for (const storeName of storeNames) {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      const count = await idb(store.count());

      let storeSize = 0;
      if (count > 0) {
        const data = await idb(store.getAll());
        try {
          storeSize = new Blob([JSON.stringify(data)]).size;
        } catch {
          storeSize = 0;
        }
      }

      const keyInfo = store.keyPath
        ? (store.autoIncrement ? `keyPath: ${JSON.stringify(store.keyPath)} (auto)` : `keyPath: ${JSON.stringify(store.keyPath)}`)
        : 'key: out-of-line';

      const idxNames = Array.from(store.indexNames);
      const idxInfo = idxNames.length ? `indexes: ${idxNames.join(', ')}` : 'indexes: none';

      console.log(
        `🗄 ${storeName} — ` +
        `записей: %c${count}%c | ` +
        `размер: %c${fmtBytes(storeSize)}%c | ` +
        `${keyInfo} | ${idxInfo}`,
        'color:#a8ff78; font-weight:bold;',
        'color:inherit;',
        'color:#a8ff78; font-weight:bold;',
        'color:inherit;'
      );

      totalSize += storeSize;
      totalRecords += count;
    } catch (e) {
      console.warn(`  ⚠️ Ошибка чтения хранилища ${storeName}:`, e);
    }
  }

  db.close();

  console.log('');
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#333;');
  console.log(
    `%cВСЕГО: ${totalRecords} записей | ${fmtBytes(totalSize)}`,
    'color:#a8ff78; font-weight:bold; font-size:13px;'
  );
}