//-----------------------------------------------------------------------------|
// universe.js
// Вся Вселенная начинается от сюда!
//-----------------------------------------------------------------------------|

//----------------------------------------------------------------------------☘️
// class HolderSeeds: Хранитель ключей(сидов) и 
// генератор детерминированного шума для ~200 галактик.
//-----------------------------------------------------------------------------:
class HolderSeeds
{

    #seeds = [];   // ← объявляем приватное поле

    /*
     * @param {number|string} seed - Сид вселенной. Может быть числом или строкой.
     */
    constructor(sseed, amount)
    {
        // Приводим сид к 32-битному беззнаковому целому
        this.sseed = sseed;
        this. seed = HolderSeeds._toUint32(sseed);
        // Создаем привязанный генератор псевдослучайных чисел
        this.random = HolderSeeds._mulberry32(this.seed);

        for(let i = 0; i < amount; ++i)
        {
            const n = this.random()
            this.#seeds.push(n);
        }

    //  for(let i = 0; i < this.#seeds.length; ++i)
    //  {   console.log(`🔍 #seeds [${i}]: ${this.#seeds[i]}`);
    //  }
    }

    // -----------------------------------------|
    //  Конвертация сида
    // -----------------------------------------:
    static _toUint32(value)
    {   if (typeof value === 'number') {
            return value >>> 0;
        }
        // Простой хеш строки в 32-битное число (djb2)
        let hash = 5381;
        for (let i = 0; i < value.length; i++) {
            hash = (hash * 33) ^ value.charCodeAt(i);
            hash = hash >>> 0;
        }
        return hash;
    }

    // -----------------------------------------|
    //  Утилиты: 
    //  Генератор псевдослучайных чисел Mulberry32
    //  Быстрый, детерминированный, 
    //  проходит тесты на равномерность.
    // -----------------------------------------:
    static _mulberry32(a)
    {   return function ()
        {   a |= 0;
            a  = (a + 0x6d2b79f5) | 0;
            let  t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // -----------------------------------------|
    //  Основные методы генерации
    // -----------------------------------------:

    /**
     * Возвращает число от 0 (включительно) до 1 (не включая).
     */
    next() {
        return this.random();
    }

    /**
     * Возвращает число в диапазоне [min, max).
     */
    range(min, max) {
        return min + (max - min) * this.random();
    }

    /**
     * Возвращает случайный элемент массива.
     */
    choice(array) {
        return array[Math.floor(this.random() * array.length)];
    }

    /**
     * Возвращает детерминированный ID галактики по её индексу.
     * Полезно, чтобы не хранить все 200 сидов в памяти, а вычислять их на лету.
     * @param {number} galaxyIndex - Индекс галактики (например, от 0 до 199)
     */
    getGalaxySeed(galaxyIndex) {
        // Смешиваем базовый сид вселенной с индексом галактики
        const combined = this._toUint32(
            this.seed + 0x9e3779b9 + (galaxyIndex << 6) + (galaxyIndex >> 2));
        return Universe._mulberry32(combined);
    }

    getSeed(i) {
        return this.#seeds[i];
    }
}

// -----------------------------------------|
//  Экспорт для Node.js и браузеров
// -----------------------------------------:
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = HolderSeeds;
} else {
    window.Universe = HolderSeeds;
}


//----------------------------------------------------------------------------☘️
// class Universe
// Хранитель HolderSeeds для ~200 галактик.
//
// Использование:
//      <script src="./galaxy/universe.js"></script>
//      <script>
//          const SEED_UNIVERSE = "NGC-4889-Command"; // Или число
//          const UNIVERSE      = new Universe(SEED_UNIVERSE);
//          window.Universe     = UNIVERSE; // Делаем глобальным
//          ...
//      </script>
//-----------------------------------------------------------------------------:

const SEED_ROOT_DEFAULT     = 2026;
const AMOUNT_GALAXY_DEFAULT = 100;

class Universe
{

    /// Здесь храним рутовый сид:
    #seedRoot;

    /// Здесь держим сиды для всех галактик:
    #holderSeeds;

    constructor(sseed = SEED_ROOT_DEFAULT, amount = AMOUNT_GALAXY_DEFAULT)
    {
         this.load(sseed, amount);
    }

    // -----------------------------------------|
    //  Основные методы генерации
    // -----------------------------------------:

    /**
     * Возвращает детерминированный ID галактики по её индексу.
     * Полезно, чтобы не хранить все 200 сидов в памяти, а вычислять их на лету.
     * @param {number} galaxyIndex - Индекс галактики (например, от 0 до 199)
     */
    getGalaxySeed(galaxyIndex) {
        return this.#holderSeeds.getGalaxySeed(i);
    }

    getSeed(i) {
        return this.#holderSeeds.getSeed(i);
    }

    // -----------------------------------------|
    //  Dispose (для будущих расширений)
    // -----------------------------------------:
    dispose() {
        // Сейчас метод пуст, 
        // но зарезервирован для очистки тяжелых ресурсов.
    }

    load(seed, amount)
    {
        /// Загрузить страторвый(рутовый) сид ...
        /// const SEED_ROOT = ...;
        this.#seedRoot    = seed;
        this.#holderSeeds = new HolderSeeds(this.#seedRoot, amount);
    }

    save()
    {
        /// Сохранить страторвый(рутовый) сид: this.#seedRoot

    }
}

// -----------------------------------------|
//  Экспорт для Node.js и браузеров
// -----------------------------------------:
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Universe;
} else {
    window.Universe = Universe;
}