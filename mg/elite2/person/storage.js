//-----------------------------------------------------------------------------|
// storage.js
// Скрипт отвечает за сохранения состояний в игре.
// Срипт рализует работу только с ОДНИМ сохранением!
//
// Использование:
//      <script src="./person/storage.js"></script>
//      <script>
//          const  STORAGE = new PlayerStateStorageSlot();
//          window.STORAGE = STORAGE; // Делаем глобальным
//          ...
//      </script>
//-----------------------------------------------------------------------------|

class PlayerStateStorageSlot
{
    static keyDefault  = 'default';
    static count       = 0;
    static isAvailable = false;

    constructor(storageKey = this.constructor.keyDefault)
    {
        this.key = storageKey + this.constructor.count++;
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
            PlayerStateStorageSlot.isAvailable = true;
            return true;
        } catch
        {   PlayerStateStorageSlot.isAvailable = false;
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
}

// -----------------------------------------|
//  Экспорт для Node.js и браузеров
// -----------------------------------------:
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = PlayerStateStorage;
} else {
    window.PlayerStateStorage = PlayerStateStorage;
}