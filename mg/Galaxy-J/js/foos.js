//-----------------------------------------------------------------------------|
// foos.js
// Скрипт содержит функции общего назначения (утилиты).
// Глобальный неймспейс: FO (Foos Objects/Functions)
//
// Использование:
//      <script src="./js/foos.js"></script>
//      <script>
//          const angle = FO.math.degToRad(90);
//          const shuffled = FO.array.shuffle(myArray);
//      </script>
//-----------------------------------------------------------------------------|

// ------------------------------------------------------------------
//  Отладочные переключатели
// ------------------------------------------------------------------
window.DEBUG =
{   isSpawnEnemies: false, // ← временно выключено для дебага
    //isSpawnMeteors: true,
    //isLogJumps    : true,
};

(function (global) {
    'use strict';

    global.KEY_EXIT = "Backquote"; // 'Ё' "Escape" 

    // Создаем корневой объект, если он еще не существует.
    // Это защищает от затирания данных, если скрипт подключается дважды.
    const FO = global.FO || {};

    //=========================================================================|
    //  МАТЕМАТИКА
    //=========================================================================|
    FO.math = {
        /**
         * Генератор случайных чисел Mulberry32 (быстрый и детерминированный).
         * @param {number} seed 
         * @returns {function(): number}
         */
        random(seed = 0) {
            let a = seed >>> 0;
            return function () {
                a |= 0;
                a = (a + 0x6d2b79f5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        },

        /**
         * Линейная интерполяция (от 0 до 1).
         */
        lerp(a, b, t) {
            return a + (b - a) * t;
        },

        /**
         * Перевод градусов в радианы.
         */
        degToRad(deg) {
            return deg * (Math.PI / 180);
        },

        /**
         * Перевод радиан в градусы.
         */
        radToDeg(rad) {
            return rad * (180 / Math.PI);
        },

        /**
         * Привязка числа к диапазону [min, max].
         */
        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }
    };

    //=========================================================================|
    //  МАССИВЫ И ОБЪЕКТЫ
    //=========================================================================|
    FO.array = {
        /**
         * Перемешивает массив на месте (алгоритм Фишера — Йетса).
         * @param {Array} array 
         * @returns {Array} Тот же массив, но перемешанный.
         */
        shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },

        /**
         * Выбирает случайный элемент массива.
         */
        choice(array) {
            return array[Math.floor(Math.random() * array.length)];
        },

        /**
         * Проверяет, является ли объект настоящим массивом.
         */
        isArray(obj) {
            return Array.isArray(obj);
        }
    };

    FO.obj = {
        /**
         * Безопасное глубокое слияние двух объектов 
         * (как Object.assign, но рекурсивно).
         */
        deepAssign(target, ...sources) {
            if (!sources.length) return target;
            const source = sources.shift();

            if (this.isMergeable(target) && this.isMergeable(source)) {
                for (const key in source) {
                    if (this.isMergeable(source[key])) {
                        if (!target[key]) {
                            Object.assign(target, { [key]: {} });
                        }
                        this.deepAssign(target[key], source[key]);
                    } else {
                        Object.assign(target, { [key]: source[key] });
                    }
                }
            }
            return this.deepAssign(target, ...sources);
        },

        isMergeable(item) {
            return item && typeof item === 'object' && !Array.isArray(item);
        }
    };

    //=========================================================================|
    //  РАБОТА СО СТРОКАМИ И URL
    //=========================================================================|
    FO.string = {
        /**
         * Проверяет, пустая ли строка, null или undefined.
         */
        isEmpty(str) {
            return str === null || str === undefined || str.trim() === '';
        },

        /**
         * Форматирует строку: "Hello, {0}".format(name) -> "Hello, Alex"
         */
        format(str, ...args) {
            return str.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] !== 'undefined' ? args[number] : match;
            });
        }
    };

    FO.url = {
        /**
         * Безопасное получение GET-параметра по имени.
         */
        getQueryParam(name) {
            const params = new URLSearchParams(window.location.search);
            return params.get(name);
        },

        /**
         * Собирает URL из частей.
         */
        build(base, path, params) {
            let url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
            if (params && typeof params === 'object') {
                const search = new URLSearchParams(params).toString();
                if (search) url += `?${search}`;
            }
            return url;
        }
    };

    //=========================================================================|
    //  DOM И ЗАПРОСЫ
    //=========================================================================|
    FO.dom = {
        /**
         * Создает элемент с атрибутами и текстом.
         */
        create(tag, attrs = {}, text = '') {
            const el = document.createElement(tag);
            for (const key in attrs) {
                el.setAttribute(key, attrs[key]);
            }
            if (text) el.textContent = text;
            return el;
        },

        /**
         * Удаляет элемент из DOM, если он существует.
         */
        remove(el) {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
    };

    FO.ajax = {
        /**
         * Упрощенный GET-запрос (возвращает Promise).
         */
        get(url) {
            return fetch(url).then(r => {
                if (!r.ok) throw new Error('Network response was not ok');
                return r.json();
            });
        }
    };

    //=========================================================================|
    //  ЛОГИРОВАНИЕ
    //=========================================================================|
    FO.log = {
        info(...args) {
            console.info('[FO]', ...args);
        },
        warn(...args) {
            console.warn('[FO]', ...args);
        },
        error(...args) {
            console.error('[FO]', ...args);
        }
    };

    //=========================================================================|
    //  ...
    //=========================================================================|
    FO.version = () => { return "FOOS-v:0.1"; };

    //=========================================================================|
    //  ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ВИДИМОСТИ
    //=========================================================================|
    global.FO = FO;

})(typeof window !== 'undefined' ? window : this);