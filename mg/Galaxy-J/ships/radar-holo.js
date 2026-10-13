/* ============================================================
 * radar-holo.js
 * Голографический тактический радар для космической игры.
 *
 * Идея:
 *   - Полусфера + плоское тактическое кольцо (вид сверху).
 *   - Отдельная THREE.Scene, рендерится поверх основной.
 *   - Класс не знает про игровую логику: принимает абстрактные
 *     "контакты" и состояние корабля (позиция + кватернион).
 *
 * Использование:
 *   const radar = new RadarHolo(renderer, {
 *       size: 320,                        // размер квадрата радара, px
 *       range: 20000,                     // дальность, мировые единицы
 *       anchor: "bottom-right",           // положение на экране
 *   });
 *
 *   // каждый кадр, ПОСЛЕ основного renderer.render(mainScene, camera):
 *   radar.setShip(ship.position, ship.quaternion);
 *   radar.setContacts([
 *       { id: 1, pos: new THREE.Vector3(...), kind: "enemy",  hostile: true,  locked: false },
 *       { id: 2, pos: new THREE.Vector3(...), kind: "ally",   hostile: false, locked: false },
 *       { id: 3, pos: new THREE.Vector3(...), kind: "station",hostile: false, locked: true  },
 *   ]);
 *   radar.update(dt);
 *   radar.render();                       // второй проход поверх основного
 *
 * Зависимости: THREE (глобальный).
 * ============================================================ */

(function (global) {
  "use strict";

  if (global.RadarHolo && global.RadarHolo.__ready) return;

  /* ---------- Палитра по типам целей ---------- */
  const COLORS = {
    enemy:   0xff3355, // красный
    ally:    0x33ccff, // голубой
    neutral: 0xffcc44, // янтарный
    station: 0x66ff99, // зелёный
    anomaly: 0xcc66ff, // пурпурный
    unknown: 0xffffff, // белый
  };

    /* ---------- Хелперы (ленивая инициализация — THREE появится позже) ---------- */
    let _v1 = null;
    let _v2 = null;
    let _q1 = null;

    function _ensureThreeHelpers() {
    if (_v1) return;
    _v1 = new THREE.Vector3();
    _v2 = new THREE.Vector3();
    _q1 = new THREE.Quaternion();
    }

  class RadarHolo {
    constructor(renderer, opts = {}) {
      if (!renderer) throw new Error("RadarHolo: renderer is required");

      _ensureThreeHelpers();  

      /* ---- Настройки ---- */
      this.size     = opts.size     ?? 320;               // сторона радара в CSS-пикселях
      this.range    = opts.range    ?? 20000;             // максимальная дальность
      this.anchor   = opts.anchor   ?? "bottom-right";    // угол экрана
      this.margin   = opts.margin   ?? 24;
      this.domeSeg  = opts.domeSeg  ?? 24;                // сегментов у полусферы
      this.sweepHz  = opts.sweepHz  ?? 0.35;              // период сканирования, Гц
      this.bloom    = opts.bloom    ?? true;              // пытаться подключить bloom (если доступен)
      this.onPing   = opts.onPing   ?? null;              // колбэк "пинг" при проходе сканера

      /* ---- Рендерер и размеры ---- */
      this.renderer = renderer;
      this.dpr      = Math.min(global.devicePixelRatio || 1, 2);

      /* ---- Отдельная сцена и камера ---- */
      this.scene  = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      this.camera.position.set(0, 0.55, 2.6);
      this.camera.lookAt(0, 0, 0);

      /* ---- Корневая группа радара ---- */
      this.root = new THREE.Group();
      this.scene.add(this.root);

      /* ---- Состояние корабля ---- */
      this.shipPos = new THREE.Vector3();
      this.shipQuat = new THREE.Quaternion();

      /* ---- Контакты ---- */
      this.contacts = [];               // последний переданный массив
      this._contactSprites = new Map(); // id -> { group, sprite, dot, tail, lock }

      /* ---- Время и сканер ---- */
      this._t = 0;
      this._sweepAngle = 0;
      this._pingedThisPass = new Set();

      /* ---- Стили / 2D-оверлей ---- */
      this._buildDomOverlay();

      /* ---- Построение 3D-содержимого ---- */
      this._buildGrid();
      this._buildDome();
      this._buildSweep();
      this._buildShipMarker();

      /* ---- Реакция на resize ---- */
      this._onResize = this._onResize.bind(this);
      global.addEventListener("resize", this._onResize);
      this._onResize();

      this.__ready = true;
      this._ready = true;
    }

    /* ============================================================
     *  Публичный API
     * ============================================================ */

    /** Позиция и кватернион корабля (обычно из вашей камеры/объекта). */
    setShip(position, quaternion) {
      if (position) this.shipPos.copy(position);
      if (quaternion) this.shipQuat.copy(quaternion);
    }

    /**
     * Контакты для отображения. Объекты вида:
     *   { id, pos: Vector3, kind: "enemy"|"ally"|"neutral"|"station"|"anomaly",
     *     hostile?: boolean, locked?: boolean, vpos?: Vector3 (необязательно — скорость) }
     */
    setContacts(list) {
      this.contacts = Array.isArray(list) ? list : [];
    }

    /** Обновление анимации. */
    update(dt) {
      this._t += dt;

      // угол сканера (один оборот за 1/sweepHz секунд)
      const prev = this._sweepAngle;
      this._sweepAngle = (this._sweepAngle + dt * Math.PI * 2 * this.sweepHz) % (Math.PI * 2);

      // детект "прохода" сканера через 0 — сбрасываем пул пингов
      if (prev > this._sweepAngle) this._pingedThisPass.clear();

      this._sweepPlane.rotation.y = -this._sweepAngle;

      // лёгкое дыхание сетки
      const breathe = 1 + Math.sin(this._t * 1.4) * 0.006;
      this.dome.scale.setScalar(breathe);

      this._syncContactSprites(dt);
      this._updateShipMarker();
      this._updateDomReadout();
    }

    /** Отрисовать радар поверх основного кадра. */
    render() {
      const r = this.renderer;
      const prevAutoClear = r.autoClear;
      r.autoClear = false;

      // ограничиваем область вывода радаром
      const { x, y, w, h } = this._viewportRect();
      r.setViewport(x, y, w, h);
      r.setScissor(x, y, w, h);
      r.setScissorTest(true);

      r.render(this.scene, this.camera);

      // сброс
      r.setScissorTest(false);
      r.setViewport(0, 0, r.domElement.width, r.domElement.height);
      r.autoClear = prevAutoClear;
    }

    /** Полное уничтожение: DOM, слушатели, GPU-ресурсы. */
    destroy() {
      global.removeEventListener("resize", this._onResize);
      if (this.dom && this.dom.root && this.dom.root.parentNode) {
        this.dom.root.parentNode.removeChild(this.dom.root);
      }
      // осторожно с dispose — здесь минимально
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
          else o.material.dispose?.();
        }
      });
    }

    /* ============================================================
     *  Построение 3D
     * ============================================================ */

    _buildGrid() {
      // Плоское тактическое кольцо (вид сверху) с делениями
      const g = new THREE.Group();
      g.rotation.x = -Math.PI / 2; // положим «плашмя»
      g.position.y = -0.9;
      this.root.add(g);

      // внешняя окружность
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.02, 96),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff, transparent: true, opacity: 0.35,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      g.add(ring);

      // внутренние кольца
      for (const r of [0.66, 0.33]) {
        const rr = new THREE.Mesh(
          new THREE.RingGeometry(r, r + 0.008, 96),
          new THREE.MeshBasicMaterial({
            color: 0x00ffff, transparent: true, opacity: 0.22,
            side: THREE.DoubleSide, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        g.add(rr);
      }

      // радиальные деления (12 часов)
      const ticks = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const len = (i % 3 === 0) ? 0.12 : 0.06;
        const tick = new THREE.Mesh(
          new THREE.PlaneGeometry(0.012, len),
          new THREE.MeshBasicMaterial({
            color: 0x00ffff, transparent: true, opacity: i % 3 === 0 ? 0.55 : 0.3,
            depthWrite: false, blending: THREE.AdditiveBlending,
          })
        );
        tick.position.set(Math.cos(a) * (1 - len / 2), Math.sin(a) * (1 - len / 2), 0);
        tick.rotation.z = a - Math.PI / 2;
        ticks.add(tick);
      }
      g.add(ticks);

      // носовой маркер (север)
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.14, 3),
        new THREE.MeshBasicMaterial({
          color: 0x66ffcc, transparent: true, opacity: 0.9,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      nose.position.set(0, 1.06, 0);
      nose.rotation.z = Math.PI; // вершиной вверх
      g.add(nose);

      this.gridGroup = g;
    }

    _buildDome() {
      // Полусфера-«купол» — направление на цели с учётом pitch.
      const geo = new THREE.SphereGeometry(
        1.0, this.domeSeg, this.domeSeg,
        0, Math.PI * 2,      // phi: полный круг
        0, Math.PI / 2       // theta: только верхняя половина
      );

      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff, transparent: true, opacity: 0.06,
        wireframe: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      this.dome = new THREE.Mesh(geo, mat);
      this.dome.position.y = -0.9; // чтобы купол рос «вверх» от кольца
      this.root.add(this.dome);

      // «горизонт» — плоскость на уровне кольца для визуальной привязки
      const horiz = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 64),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff, transparent: true, opacity: 0.05,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      horiz.rotation.x = -Math.PI / 2;
      horiz.position.y = -0.9;
      this.root.add(horiz);
    }

    _buildSweep() {
      // Полупрозрачная «плоскость-луч», вращающаяся вокруг вертикали.
      const geo = new THREE.PlaneGeometry(2.0, 1.0, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x66ffff, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.89;

      this._sweepPlane = plane;
      this.root.add(plane);
    }

    _buildShipMarker() {
      // Центр — маркер своего корабля (треугольник «вперёд»).
      const g = new THREE.Group();
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.14, 3),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 1.0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      tri.rotation.z = Math.PI;
      g.add(tri);
      this.shipMarker = g;
      this.root.add(g);
    }

    /* ============================================================
     *  Синхронизация контактов
     * ============================================================ */

    _syncContactSprites(dt) {
      const used = new Set();

      for (const c of this.contacts) {
        if (!c || c.id == null) continue;
        used.add(c.id);

        let entry = this._contactSprites.get(c.id);
        if (!entry) {
          entry = this._makeContactSprite(c);
          this._contactSprites.set(c.id, entry);
          this.root.add(entry.group);
        }
        this._updateContactSprite(entry, c, dt);
      }

      // удаляем исчезнувшие
      for (const [id, entry] of this._contactSprites) {
        if (!used.has(id)) {
          this.root.remove(entry.group);
          this._disposeGroup(entry.group);
          this._contactSprites.delete(id);
        }
      }
    }

    _makeContactSprite(c) {
      const group = new THREE.Group();

      const color = COLORS[c.kind] ?? COLORS.unknown;

      // точка-иконка
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.022, 12),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.95,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      dot.rotation.x = -Math.PI / 2;
      group.add(dot);

      // ореол
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.028, 0.038, 16),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.45,
          depthWrite: false, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        })
      );
      halo.rotation.x = -Math.PI / 2;
      group.add(halo);

      // «хвост» — вектор движения
      const tail = new THREE.Mesh(
        new THREE.PlaneGeometry(0.006, 0.10, 1, 1),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.5,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      tail.rotation.x = -Math.PI / 2;
      tail.position.y = 0.001; // чуть выше плоскости
      tail.visible = false;
      group.add(tail);

      // лок-он кольцо
      const lock = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.052, 4),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.9,
          depthWrite: false, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        })
      );
      lock.rotation.x = -Math.PI / 2;
      lock.visible = false;
      group.add(lock);

      return { group, dot, halo, tail, lock, color };
    }

    _updateContactSprite(entry, c, dt) {
      const { group, halo, tail, lock, dot } = entry;

      // 1. Локальная позиция цели относительно корабля, в системе корабля.
      _v1.copy(c.pos).sub(this.shipPos);
      _v2.copy(_v1).applyQuaternion(_q1.copy(this.shipQuat).invert());

      // 2. Ограничение дальностью
      const dist = _v2.length();
      if (dist > this.range) {
        group.visible = false;
        return;
      }
      group.visible = true;

      // 3. Проекция на «купол»: нормализуем по горизонтали и по вертикали.
      //    x — влево/вправо, z — вперёд/назад, y — вверх/вниз.
      const nx = THREE.MathUtils.clamp(_v2.x / this.range, -1, 1);
      const ny = THREE.MathUtils.clamp(_v2.y / this.range, -1, 1);
      const nz = THREE.MathUtils.clamp(_v2.z / this.range, -1, 1);

      // Горизонтальный радиус (в плоскости XZ в системе корабля)
      const horiz = Math.hypot(nx, nz);
      // высота по Y нормализуется отдельно — так удобнее читать сверху/снизу
      const y = ny;

      // Кладём точку на полусферу: горизонталь — по кольцу, вертикаль — по Y.
      const r = Math.min(1, horiz);
      const ang = Math.atan2(nx, nz); // 0 — вперёд, PI/2 — вправо, PI — назад
      const xOnRing = Math.sin(ang) * r;
      const zOnRing = Math.cos(ang) * r;

      // Итоговая позиция в локальных координатах радара:
      // кольцо лежит в плоскости XZ (плоскость радара), Y — вверх.
      group.position.set(
        xOnRing,
        -0.9 + THREE.MathUtils.clamp(y * 0.9, -0.85, 0.85),
        zOnRing
      );

      // 4. Яркость/размер зависят от дистанции: ближе — крупнее и ярче.
      const t = THREE.MathUtils.clamp(1 - dist / this.range, 0.15, 1);
      const scale = 0.6 + t * 1.4;
      group.scale.setScalar(scale);
      halo.material.opacity = 0.25 + t * 0.6;
      dot.material.opacity = 0.5 + t * 0.5;

      // 5. Пульс у враждебных
      if (c.hostile) {
        const pulse = 1 + Math.sin(this._t * 6 + (c.id % 7)) * 0.15;
        halo.scale.setScalar(pulse);
      } else {
        halo.scale.setScalar(1);
      }

      // 6. Вектор движения — если задан vpos.
      if (c.vpos) {
        const vLocal = _v1.copy(c.vpos).applyQuaternion(_q1.copy(this.shipQuat).invert());
        const mag = vLocal.length();
        if (mag > 1e-3) {
          const ang2 = Math.atan2(vLocal.x, vLocal.z);
          tail.visible = true;
          tail.rotation.z = -ang2;
        } else {
          tail.visible = false;
        }
      } else {
        tail.visible = false;
      }

      // 7. Лок-он: вращающееся кольцо
      if (c.locked) {
        lock.visible = true;
        lock.rotation.z = (this._t * 1.6) % (Math.PI * 2);
        const s = 1 + Math.sin(this._t * 8) * 0.05;
        lock.scale.setScalar(s);
      } else {
        lock.visible = false;
      }

      // 8. «Пинг» при проходе сканера: если сканер рядом с углом цели
      const targetAngle = (ang + Math.PI * 2) % (Math.PI * 2);
      const sweepAngle = this._sweepAngle;
      const diff = Math.abs(((targetAngle - sweepAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (diff < 0.06 && !this._pingedThisPass.has(c.id)) {
        this._pingedThisPass.add(c.id);
        if (this.onPing) this.onPing(c, dist);
      }

      // 9. Свечение точки прямо пропорционально близости и угрозе
      const glow = c.hostile ? 1.0 : 0.7;
      dot.material.opacity = Math.min(1, (0.35 + t * 0.7) * glow);
    }

    _updateShipMarker() {
      // маркер корабля — в центре кольца, «нос» разворачивается по курсу,
      // но т.к. система координат уже относительна курса, он всегда смотрит в +Z.
      this.shipMarker.position.set(0, -0.88, 0);
    }

    _disposeGroup(g) {
      g.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
          else o.material.dispose?.();
        }
      });
    }

    /* ============================================================
     *  DOM-оверлей (подписи, дистанции, статус)
     * ============================================================ */

    _buildDomOverlay() {
      const root = document.createElement("div");
      root.className = "radar-holo";
      root.style.cssText = `
        position: fixed;
        width: ${this.size}px;
        height: ${this.size + 56}px;
        pointer-events: none;
        z-index: 40;
        font-family: "Courier New", monospace;
        color: #7dfcff;
        text-shadow: 0 0 6px rgba(0,255,255,0.6);
      `;

      const label = document.createElement("div");
      label.className = "radar-holo-label";
      label.textContent = "TACTICAL // HOLO-SCAN";
      label.style.cssText = `
        font-size: 11px; letter-spacing: 3px;
        color: #66ffcc; opacity: .8;
        padding: 2px 4px;
      `;
      root.appendChild(label);

      const readout = document.createElement("div");
      readout.className = "radar-holo-readout";
      readout.style.cssText = `
        font-size: 10px; line-height: 1.4;
        opacity: .85;
        padding: 4px 2px 0;
        white-space: pre;
      `;
      root.appendChild(readout);

      document.body.appendChild(root);

      this.dom = { root, label, readout };
      this._applyAnchor();
    }

    _applyAnchor() {
      const root = this.dom.root;
      const m = this.margin + "px";
      root.style.left = root.style.right = root.style.top = root.style.bottom = "auto";

      switch (this.anchor) {
        case "top-left":     root.style.left = m; root.style.top = m; break;
        case "top-right":    root.style.right = m; root.style.top = m; break;
        case "bottom-left":  root.style.left = m; root.style.bottom = m; break;
        case "center":       root.style.left = "50%"; root.style.top = "50%";
                             root.style.transform = "translate(-50%,-50%)"; break;
        default:             root.style.right = m; root.style.bottom = m;
      }
    }

    _updateDomReadout() {
      // Топ-5 ближайших контактов, отсортированных по дистанции.
      const tmp = [];
      for (const c of this.contacts) {
        if (!c || !c.pos) continue;
        const d = c.pos.distanceTo(this.shipPos);
        if (d > this.range) continue;
        tmp.push({ c, d });
      }
      tmp.sort((a, b) => a.d - b.d);

      const lines = [];
      const top = tmp.slice(0, 5);
      for (const { c, d } of top) {
        const kind = (c.kind || "unknown").toUpperCase().padEnd(7, " ");
        const dist = formatDist(d);
        const mark = c.locked ? "◈" : (c.hostile ? "▲" : "•");
        lines.push(`${mark} ${kind} ${dist}`);
      }
      if (!lines.length) lines.push("-- НЕТ КОНТАКТОВ --");

      this.dom.readout.textContent = lines.join("\n");
    }

    /* ============================================================
     *  Реакция на resize
     * ============================================================ */

    _onResize() {
      // размер буфера рендерера в физических пикселях
      const wCss = this.size;
      const hCss = this.size;

      // Запоминаем CSS-область для scissor/viewport.
      const rect = this.dom.root.getBoundingClientRect();
      this._cssRect = {
        x: rect.left,
        y: rect.top,
        w: wCss,
        h: hCss,
      };

      // Внутренние пропорции камеры
      this.camera.aspect = wCss / hCss;
      this.camera.updateProjectionMatrix();
    }

    _viewportRect() {
      // Переводим CSS-координаты в пиксели буфера рендерера.
      // В THREE начало координат — левый нижний угол.
      const r = this.renderer;
      const rect = this._cssRect || { x: 0, y: 0, w: this.size, h: this.size };

      const canvas = r.domElement;
      const canvasRect = canvas.getBoundingClientRect();

      const scaleX = canvas.width  / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;

      const xPx = (rect.x - canvasRect.left) * scaleX;
      const yPxTop = (rect.y - canvasRect.top) * scaleY;

      const w = rect.w * scaleX;
      const h = rect.h * scaleY;

      // из верхнего-левого в нижний-левый
      const yPx = canvas.height - yPxTop - h;

      return {
        x: Math.round(xPx),
        y: Math.round(yPx),
        w: Math.round(w),
        h: Math.round(h),
      };
    }
  }

  /* ---------- Мелкие утилиты ---------- */

  function formatDist(d) {
    if (d >= 1000) return (d / 1000).toFixed(1) + "km";
    return Math.round(d) + "m";
  }

  /* ---------- Экспорт ---------- */
  global.RadarHolo = RadarHolo;
  global.RadarHolo.__ready = true;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = RadarHolo;
  }
})(typeof window !== "undefined" ? window : globalThis);