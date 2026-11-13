//  computer-brain.js
//
//  Поиск лучшего хода для игры «Слова».
//  Самодостаточный браузерный модуль (ES2020, classic script).
//  Экспорт: window.ComputerBrain.
//
//  ESM: файл намеренно остаётся classic script; для модульного импорта
//  используйте window.ComputerBrain (иначе ломается подключение через <script>).

'use strict';

(function (global)
{
    'use strict';

    const MAX_WORD_LENGTH = 15;
    const MIN_GAME_LENGTH = 2;
    const MAX_GRID_CELLS = 65536;
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    /**
     * Текущее время в миллисекундах (performance.now или Date.now).
     * @returns {number}
     */
    function clock()
    {
        if (typeof performance !== 'undefined' &&
            performance &&
            typeof performance.now === 'function')
        {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * Единая нормализация слов и букв.
     * @param {*} value
     * @returns {string}
     */
    function norm(value)
    {
        return String(value).toLowerCase().replace(/ё/g, 'е');
    }

    /**
     * Создаёт узел префиксного дерева.
     * @returns {{children: Map<string, Object>, isWord: boolean, word: (string|null)}}
     */
    function createNode()
    {
        return {
            children: new Map(),
            isWord: false,
            word: null,
        };
    }

    /**
     * Приводит значение координаты к целому числу.
     * @param {*} value
     * @returns {number|null}
     */
    function toCoord(value)
    {
        const number = Number(String(value).trim());
        return Number.isInteger(number) ? number : null;
    }

    /**
     * Возвращает итерируемые пары [ключ, значение] поля.
     * @param {*} board
     * @returns {Iterable<[*, *]>|null}
     */
    function boardIterable(board)
    {
        if (!board || typeof board !== 'object')
        {
            return null;
        }
        if (typeof board.entries === 'function')
        {
            return board.entries();
        }
        return Object.entries(board);
    }

    /**
     * Нормализует набор использованных слов, не изменяя исходный.
     * @param {*} words
     * @returns {Set<string>}
     */
    function normalizedSet(words)
    {
        const result = new Set();
        if (words && typeof words[Symbol.iterator] === 'function')
        {
            for (const word of words)
            {
                const normalized = norm(word);
                if (normalized)
                {
                    result.add(normalized);
                }
            }
        }
        return result;
    }

    class ComputerBrain
    {
        /**
         * @param {Iterable<string>|null} wordsSet — словарь (обычно Set<string>).
         */
        constructor(wordsSet)
        {
            const started = clock();

            this._root = createNode();
            this._lengthIndex = new Map();
            this._letterIndex = new Map();
            this._letterMinLen = new Map();
            this._letterMaxLen = new Map();
            this._wordCount = 0;
            this._nodeCount = 1;
            this._maxWordLen = 0;
            this._buildMs = 0;

            const iterable = (wordsSet != null &&
                typeof wordsSet[Symbol.iterator] === 'function')
                ? wordsSet
                : null;

            if (!iterable && wordsSet != null)
            {
                console.warn('ComputerBrain: wordsSet must be iterable');
            }

            if (iterable)
            {
                for (const rawWord of iterable)
                {
                    const word = norm(rawWord);
                    if (word)
                    {
                        this._insert(word);
                    }
                }
            }

            this._buildMs = clock() - started;
        }

        /**
         * Вставляет слово в trie и обновляет индексы.
         * @param {string} word — уже нормализованное слово.
         * @returns {boolean}
         */
        _insert(word)
        {
            let node = this._root;

            for (let i = 0; i < word.length; i++)
            {
                const ch = word[i];
                let next = node.children.get(ch);

                if (!next)
                {
                    next = createNode();
                    node.children.set(ch, next);
                    this._nodeCount++;
                }
                node = next;
            }

            if (node.isWord)
            {
                return false;
            }

            node.isWord = true;
            node.word = word;
            this._wordCount++;

            const length = word.length;
            const bucket = this._lengthIndex.get(length);

            if (bucket)
            {
                bucket.push(word);
            }
            else
            {
                this._lengthIndex.set(length, [word]);
            }

            if (length > this._maxWordLen)
            {
                this._maxWordLen = length;
            }

            const seen = new Set();

            for (const ch of word)
            {
                if (seen.has(ch))
                {
                    continue;
                }
                seen.add(ch);

                let set = this._letterIndex.get(ch);

                if (!set)
                {
                    set = new Set();
                    this._letterIndex.set(ch, set);
                    this._letterMinLen.set(ch, length);
                    this._letterMaxLen.set(ch, length);
                }
                else
                {
                    const min = this._letterMinLen.get(ch);
                    const max = this._letterMaxLen.get(ch);

                    if (length < min)
                    {
                        this._letterMinLen.set(ch, length);
                    }
                    if (length > max)
                    {
                        this._letterMaxLen.set(ch, length);
                    }
                }

                set.add(word);
            }

            return true;
        }

        /**
         * Статистика построения.
         * @returns {{words: number, nodes: number, buildMs: number}}
         */
        get stats()
        {
            return {
                words: this._wordCount,
                nodes: this._nodeCount,
                buildMs: this._buildMs,
            };
        }

        /**
         * Находит лучший ход.
         * @param {{
         *   board: Map<string, string>|Object,
         *   letters: string[]|string,
         *   usedWords: Set<string>|Iterable<string>,
         *   minLen?: number,
         *   size?: number
         * }} params
         * @returns {{word: string, cells: Array<{r: number, c: number}>, score: number}|null}
         */
        findBestMove(params)
        {
            if (this._wordCount === 0 || !params || typeof params !== 'object')
            {
                return null;
            }

            const board = boardIterable(params.board);
            if (!board)
            {
                return null;
            }

            let minLen = Number(params.minLen);
            if (!Number.isFinite(minLen))
            {
                minLen = MIN_GAME_LENGTH;
            }
            minLen = Math.max(MIN_GAME_LENGTH, Math.floor(minLen));

            if (minLen > MAX_WORD_LENGTH)
            {
                return null;
            }

            const usedWords = normalizedSet(params.usedWords);
            const inputLetters = Array.isArray(params.letters)
                ? params.letters
                : (params.letters == null ? [] : [params.letters]);

            const occupied = [];
            const seenCells = new Set();
            let minR = Infinity;
            let maxR = -Infinity;
            let minC = Infinity;
            let maxC = -Infinity;

            for (const entry of board)
            {
                const key = String(entry[0]);
                const comma = key.indexOf(',');

                if (comma < 0)
                {
                    continue;
                }

                const r = toCoord(key.slice(0, comma));
                const c = toCoord(key.slice(comma + 1));

                if (r === null || c === null)
                {
                    continue;
                }

                const cellKey = r + ',' + c;
                if (seenCells.has(cellKey))
                {
                    continue;
                }

                const letter = norm(entry[1]).charAt(0);
                if (!letter)
                {
                    continue;
                }

                seenCells.add(cellKey);
                occupied.push({ r, c, letter });

                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }

            if (occupied.length === 0)
            {
                return null;
            }

            const maxDepth = Math.min(
                MAX_WORD_LENGTH,
                occupied.length + 1,
                this._maxWordLen
            );

            if (maxDepth < minLen)
            {
                return null;
            }

            let hasFittingLength = false;
            for (const length of this._lengthIndex.keys())
            {
                if (length >= minLen && length <= maxDepth)
                {
                    hasFittingLength = true;
                    break;
                }
            }
            if (!hasFittingLength)
            {
                return null;
            }

            const letters = [];
            const seenLetters = new Set();

            for (const rawLetter of inputLetters)
            {
                const normalized = norm(rawLetter);
                if (!normalized)
                {
                    continue;
                }

                const letter = normalized.charAt(0);
                if (seenLetters.has(letter))
                {
                    continue;
                }

                const letterMin = this._letterMinLen.get(letter);
                const letterMax = this._letterMaxLen.get(letter);

                if (letterMin === undefined ||
                    letterMin > maxDepth ||
                    letterMax < minLen)
                {
                    continue;
                }

                seenLetters.add(letter);
                letters.push(letter);
            }

            if (letters.length === 0)
            {
                return null;
            }

            const originR = minR - 1;
            const originC = minC - 1;
            const rows = maxR - originR + 2;
            const cols = maxC - originC + 2;

            if (rows <= 0 || cols <= 0 || rows * cols > MAX_GRID_CELLS)
            {
                console.warn('ComputerBrain: board is too large');
                return null;
            }

            const cellCount = rows * cols;
            const lettersAt = new Array(cellCount).fill('');
            const occupiedGrid = new Uint8Array(cellCount);
            const candidateMask = new Uint8Array(cellCount);
            const visited = new Uint8Array(cellCount);
            const candidates = [];
            const occupiedIndices = [];

            for (const cell of occupied)
            {
                const index = (cell.r - originR) * cols + (cell.c - originC);
                lettersAt[index] = cell.letter;
                occupiedGrid[index] = 1;
                occupiedIndices.push(index);
            }

            // Необязательный размер N×N-поля: не позволяет ставить букву
            // за границей, когда занятые клетки уже дошли до края.
            const size = Number(params.size);
            const limit = (Number.isFinite(size) && size > 0)
                ? Math.floor(size)
                : Infinity;

            for (const cell of occupied)
            {
                for (let d = 0; d < DIRS.length; d++)
                {
                    const r = cell.r + DIRS[d][0];
                    const c = cell.c + DIRS[d][1];

                    if (r < 0 || c < 0 || r >= limit || c >= limit)
                    {
                        continue;
                    }

                    if (r < originR || c < originC)
                    {
                        continue;
                    }

                    const index = (r - originR) * cols + (c - originC);

                    if (index < 0 || index >= cellCount ||
                        occupiedGrid[index] || candidateMask[index])
                    {
                        continue;
                    }

                    candidateMask[index] = 1;
                    candidates.push({ r, c, index });
                }
            }

            if (candidates.length === 0)
            {
                return null;
            }

            occupiedIndices.sort((a, b) => a - b);
            candidates.sort((a, b) => a.index - b.index);

            const startIndices = occupiedIndices.slice();
            for (const candidate of candidates)
            {
                startIndices.push(candidate.index);
            }
            startIndices.sort((a, b) => a - b);

            const path = [];
            const root = this._root;
            let maxLength = maxDepth;
            let currentLetter = '';
            let bestWord = null;
            let bestScore = 0;
            let bestPath = null;

            /**
             * DFS одновременно по полю и по trie.
             * @param {number} index
             * @param {Object} node
             * @param {number} depth
             * @param {boolean} hasNew
             */
            const dfs = (index, node, depth, hasNew) =>
            {
                if (node.isWord && depth >= minLen && hasNew)
                {
                    const word = node.word;

                    if (!usedWords.has(word) &&
                        word.indexOf(currentLetter) !== -1 &&
                        (bestWord === null ||
                            depth > bestScore ||
                            (depth === bestScore && word < bestWord)))
                    {
                        bestWord = word;
                        bestScore = depth;
                        bestPath = path.slice();
                    }
                }

                if (depth >= maxLength || node.children.size === 0)
                {
                    return;
                }

                visited[index] = 1;

                const row = (index / cols) | 0;
                const col = index - row * cols;

                for (let d = 0; d < DIRS.length; d++)
                {
                    const r = row + DIRS[d][0];
                    const c = col + DIRS[d][1];

                    if (r < 0 || r >= rows || c < 0 || c >= cols)
                    {
                        continue;
                    }

                    const nextIndex = r * cols + c;

                    if (visited[nextIndex])
                    {
                        continue;
                    }

                    const letter = lettersAt[nextIndex];
                    if (!letter)
                    {
                        continue;
                    }

                    const nextNode = node.children.get(letter);
                    if (!nextNode)
                    {
                        continue;
                    }

                    const isNew = candidateMask[nextIndex] === 1;
                    if (isNew && hasNew)
                    {
                        continue;
                    }

                    path.push(nextIndex);
                    dfs(nextIndex, nextNode, depth + 1, hasNew || isNew);
                    path.pop();
                }

                visited[index] = 0;
            };

            for (const letter of letters)
            {
                currentLetter = letter;

                // Все кандидатные клетки получают L сразу. Флаг hasNew в DFS
                // не даёт пройти больше чем через одну из них, поэтому результат
                // эквивалентен перебору клеток по одной, но без повторного DFS.
                for (const candidate of candidates)
                {
                    lettersAt[candidate.index] = letter;
                }

                const letterMax = this._letterMaxLen.get(letter);
                maxLength = Math.min(maxDepth, letterMax);

                for (let s = 0; s < startIndices.length; s++)
                {
                    const startIndex = startIndices[s];
                    const startLetter = lettersAt[startIndex];
                    const startNode = root.children.get(startLetter);

                    if (!startNode)
                    {
                        continue;
                    }

                    path.length = 0;
                    path.push(startIndex);
                    dfs(
                        startIndex,
                        startNode,
                        1,
                        candidateMask[startIndex] === 1
                    );
                }

                for (const candidate of candidates)
                {
                    lettersAt[candidate.index] = '';
                }
            }

            if (bestWord === null || bestPath === null)
            {
                return null;
            }

            const cells = new Array(bestPath.length);

            for (let i = 0; i < bestPath.length; i++)
            {
                const index = bestPath[i];
                const row = (index / cols) | 0;
                const col = index - row * cols;

                cells[i] = {
                    r: row + originR,
                    c: col + originC,
                };
            }

            return {
                word: bestWord,
                cells,
                score: bestScore,
            };
        }
    }

    global.ComputerBrain = ComputerBrain;

    if (typeof globalThis !== 'undefined')
    {
        globalThis.ComputerBrain = ComputerBrain;
    }

    if (global && typeof global === 'object' && global.__CB_TEST__)
    {
        /**
         * Мини-набор проверок. Запускается только при window.__CB_TEST__ === true.
         * @returns {{passed: number, failed: number}}
         */
        const runSelfTests = () =>
        {
            let passed = 0;
            let failed = 0;

            /**
             * @param {boolean} condition
             * @param {string} message
             */
            const check = (condition, message) =>
            {
                if (condition)
                {
                    passed++;
                }
                else
                {
                    failed++;
                    console.warn('ComputerBrain test failed: ' + message);
                }
            };

            const emptyBrain = new ComputerBrain(new Set());
            check(
                emptyBrain.findBestMove({
                    board: new Map([['5,5', 'к']]),
                    letters: ['о'],
                    usedWords: new Set(),
                    minLen: 2,
                }) === null,
                'empty dictionary must return null'
            );

            const words = new Set(['кот', 'код', 'корова']);
            const brain = new ComputerBrain(words);
            const board = new Map([
                ['5,5', 'к'],
                ['5,7', 'д'],
                ['4,6', 'т'],
            ]);
            const move = brain.findBestMove({
                board,
                letters: ['о'],
                usedWords: new Set(),
                minLen: 2,
            });

            check(move !== null && move.word === 'код', 'код must win lexicographically');
            check(move !== null && move.score === 3, 'score must equal word length');
            check(
                move !== null && move.cells.length === 3,
                'cells must contain the whole word'
            );

            const usedMove = brain.findBestMove({
                board,
                letters: ['о'],
                usedWords: new Set(['код']),
                minLen: 2,
            });

            check(
                usedMove !== null && usedMove.word === 'кот',
                'used word must not be returned'
            );

            const noLetterBrain = new ComputerBrain(new Set(['кот']));
            const noLetterMove = noLetterBrain.findBestMove({
                board: new Map([
                    ['5,5', 'к'],
                    ['5,6', 'о'],
                    ['5,7', 'т'],
                ]),
                letters: ['а'],
                usedWords: new Set(),
                minLen: 2,
            });

            check(
                noLetterMove === null,
                'word without the placed letter must not be returned'
            );

            const beforeBoard = JSON.stringify(Array.from(board.entries()));
            const usedSet = new Set(['код']);
            const lettersBefore = ['о'];
            brain.findBestMove({
                board,
                letters: lettersBefore,
                usedWords: usedSet,
                minLen: 2,
            });

            check(
                beforeBoard === JSON.stringify(Array.from(board.entries())),
                'board must not be mutated'
            );
            check(
                usedSet.size === 1 && usedSet.has('код'),
                'usedWords input must not be mutated'
            );
            check(
                JSON.stringify(lettersBefore) === JSON.stringify(['о']),
                'letters input must not be mutated'
            );

            if (failed === 0)
            {
                console.info('ComputerBrain self-tests passed: ' + passed);
            }

            return { passed, failed };
        };

        ComputerBrain.runSelfTests = runSelfTests;
        runSelfTests();
    }
    else
    {
        ComputerBrain.runSelfTests = null;
    }
})(typeof window !== 'undefined' ? window : globalThis);

// ---------------------------------------------------------------------------
//  Сложность:
//    построение trie — O(N * L), N — слов, L — средняя длина слова;
//    findBestMove    — O(S * 4^K) с отсечением по trie и длине,
//                      S — стартовые клетки, K <= 15.
//
//  Пример:
//    const brain = new ComputerBrain(window.WORDS);
//    const move = brain.findBestMove({
//        board: new Map([['5,5', 'к'], ['5,6', 'о']]),
//        letters: ['т'],
//        usedWords: new Set(),
//        minLen: 2,
//    });
//    // { word: 'кот', cells: [{r:5,c:5}, {r:5,c:6}, {r:5,c:7}], score: 3 }
//    // или null, если подходящего слова нет.
// ---------------------------------------------------------------------------
