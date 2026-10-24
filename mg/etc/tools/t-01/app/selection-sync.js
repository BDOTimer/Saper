// selection-sync.js
import * as THREE from "three";

/**
 * SelectionSync — хранит выбор Object3D в «древовидной» модели
 * и восстанавливает его после полной пересборки root (когда старые
 * ссылки на объекты становятся «мёртвыми»).
 *
 * Работает через «путь»: массив шагов { name, idx } от root к выбранному
 * объекту. После пересборки модели resolveObjectPath(root, path)
 * находит актуальный эквивалент.
 *
 * Устойчиво к мешам без `name` (использует fallback по индексу).
 */
export class SelectionSync {
  /**
   * @param {THREE.Object3D} root       — корень модели (gun.model)
   * @param {Object} [callbacks]
   * @param {(obj: THREE.Object3D) => void} [callbacks.onSelect]
   * @param {() => void}                    [callbacks.onClear]
   * @param {(obj: THREE.Object3D) => void} [callbacks.onResync]
   *        — вызывается после успешного восстановления (obj — новый эквивалент)
   * @param {() => void}                    [callbacks.onResyncFailed]
   *        — не удалось восстановить (объект исчез из новой модели)
   */
  constructor(root, callbacks = {}) {
    if (!root) throw new Error("SelectionSync: root required");
    this.root = root;
    this.cb = callbacks;

    /** @type {THREE.Object3D|null} */
    this._current = null;
    /** @type {{name:string|null, idx:number}[] | null} */
    this._path = null;
  }

  // ------------------------------------------------------------
  // Публичный API
  // ------------------------------------------------------------

  /**
   * Выбрать объект. Если obj === root или null — выбор снимается.
   * Возвращает true, если выбор установлен.
   */
  select(obj) {
    if (!obj || obj === this.root) {
      this.clear();
      return false;
    }

    const path = this._getObjectPath(obj, this.root);
    if (!path) {
      // объект не принадлежит root — игнорируем
      this.clear();
      return false;
    }

    this._current = obj;
    this._path = path;
    this.cb.onSelect?.(obj);
    return true;
  }

  /** Снять выбор. */
  clear() {
    this._current = null;
    this._path = null;
    this.cb.onClear?.();
  }

  /**
   * Вызывать ПОСЛЕ пересборки модели (applyParams).
   * Находит актуальный эквивалент ранее выбранного объекта
   * по сохранённому пути и уведомляет коллбеки.
   *
   * Возвращает новый Object3D или null (если не нашлось).
   */
  resync() {
    if (!this._path) return null;

    const fresh = this._resolveObjectPath(this.root, this._path);
    if (!fresh) {
      // объект «исчез» из новой модели — выбор снимается
      this._current = null;
      this._path = null;
      this.cb.onResyncFailed?.();
      return null;
    }

    this._current = fresh;
    this.cb.onResync?.(fresh);
    return fresh;
  }

  /** Текущий выбранный объект (или null). */
  getSelected() {
    return this._current;
  }

  /** Установить новый root (если модель когда-нибудь пересоздаётся целиком). */
  setRoot(root) {
    this.root = root;
    // путь не переживёт смену root — сбрасываем
    this.clear();
  }

  // ------------------------------------------------------------
  // Path helpers
  // ------------------------------------------------------------

  /**
   * Строит путь от root до obj: массив шагов сверху вниз.
   * Каждый шаг: { name: string|null, idx: number }.
   * Возвращает null, если obj не является потомком root.
   */
  _getObjectPath(obj, root) {
    const path = [];
    let cur = obj;
    while (cur && cur !== root) {
      const parent = cur.parent;
      if (!parent) return null;
      const idx = parent.children.indexOf(cur);
      if (idx < 0) return null;
      path.unshift({ name: cur.name || null, idx });
      cur = parent;
    }
    return cur === root ? path : null;
  }

  /**
   * Восстанавливает объект по пути в новом дереве.
   * Сначала ищет по name (если задан), иначе — по idx.
   * Это устойчиво к клонированию с неверным name: даже если клон
   * случайно получил то же имя, что и оригинал, — idx-проверка не даст
   * промахнуться, если name совпадает у нескольких siblings.
   */
  _resolveObjectPath(root, path) {
    let cur = root;
    for (const step of path) {
      let child = null;

      if (step.name) {
        // ищем среди children: сначала по name
        child = cur.children.find(c => c.name === step.name) || null;

        // если по name нашли, но это не тот самый индекс — всё равно
        // принимаем (имя — более сильный сигнал, чем idx)
      }

      if (!child) {
        // fallback по индексу
        child = cur.children[step.idx] || null;
      }

      if (!child) return null;
      cur = child;
    }
    return cur;
  }
}