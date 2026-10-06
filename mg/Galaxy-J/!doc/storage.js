//-----------------------------------------------------------------------------|
// storage.js
// Скрипт отвечает за сохранения состояний в игре.
// Срипт рализует работу только с ОДНИМ сохранением!
//
// Использование:
//      <script src="./person/storage.js"></script>
//      <script>
//          const  STORAGE = new StorageSlot();
//          window.STORAGE = STORAGE; // Делаем глобальным
//          ...
//      </script>
//-----------------------------------------------------------------------------|

class StorageSlot
{
    static keyDefault  = 'saver-';
    static count       = 0;
    static isAvailable = false;

    constructor(storageKey = this.constructor.keyDefault)
    {
        this.key = storageKey + this.constructor.count++;

        console.log(`... StorageSlot: ${this.key}`);

    /// this.test();
    }

    // -----------------------------------------|
    //  Сохранение состояния игры.
    // -----------------------------------------:
    save(player)
    {   try 
        {   localStorage.setItem(this.key, JSON.stringify(player));
        } catch (e) 
        {   if (e.name === 'QuotaExceededError')
            {   // обработать: старое сохранение, очистка кэша и т.п.
            }
        }
    }

    // -----------------------------------------|
    //  Загрузка состояния игры.
    // -----------------------------------------:
    load() {
        return JSON.parse(localStorage.getItem(this.key));
    }

    // -----------------------------------------|
    //  Удаление состояния игры.
    // -----------------------------------------:
    remove(){
        localStorage.removeItem(this.key);
    }

    static clearAll(){
        localStorage.clear();  
    }

    getKey()
    {   return this.key;
    }

    static checkAvailable()
    {   try 
        {   const key = '__test__';
            localStorage.setItem(key, '1');
            localStorage.removeItem(key);
            StorageSlot.isAvailable = true;
            return true;
        } catch
        {   StorageSlot.isAvailable = false;
            return false;
        }
    }

    // -----------------------------------------|
    //  Dispose (для будущих расширений)
    // -----------------------------------------:
    dispose()
    {   // Сейчас метод пуст, 
        // но зарезервирован для очистки тяжелых ресурсов.
    }

    test()
    {
        console.log(window.FO.version());

        const rnd = window.FO.math.random();
        console.log(rnd());
    }
}

// -----------------------------------------|
//  Экспорт для Node.js и браузеров
// -----------------------------------------:
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = StorageSlot;
} else {
    window.StorageSlot = StorageSlot;
}