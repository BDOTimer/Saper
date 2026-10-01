async function deleteDatabase(dbName) {
  // закрываем соединение, открытое в этой вкладке
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // базы нет — нормально
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(
      new Error('Удаление заблокировано: база открыта в другой вкладке/приложением.')
    );
  });
}

async function deleteAllDatabases() {
  const dbs = await indexedDB.databases();

  if (!dbs || !dbs.length) {
    console.log('(баз нет)');
    return;
  }

  for (const { name } of dbs) {
    await deleteDatabase(name);
    console.log('🗑 Удалена:', name);
  }
}

await deleteAllDatabases();
console.log('✅ Готово');