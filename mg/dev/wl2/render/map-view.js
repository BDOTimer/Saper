// render/map-view.js
import * as THREE from 'three';
import { Renderer, TILE } from './renderer.js';
import { hash2 } from '../core/rng.js';
import { CITY_TYPE } from '../core/world-map.js';

export class MapView {
  constructor(world, container, players = null) {
    this.world     = world;
    this.container = container;
    this.players   = players; 

    this.renderer = new Renderer(container);
    this.scene = this.renderer.scene;

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._onTileClick = null;
    this._keys = {};
    this._lastT = performance.now();

    this._raisedFlags = new Set();
    this._flagAnims = new Map();

    this._buildBoard();
    this._buildOverlays();
    this._buildCities();
    this._buildRings();
    this._bindEvents();
    this.renderer.onResize(this.world.w, this.world.h);

    requestAnimationFrame((t) => this._animate(t));
  }

  rebuild(world, players = this.players) {
    this.world   = world;
    this.players = players;
    this._disposeMesh('tileMesh');
    this._disposeMesh('pickMesh');
    this._disposeMesh('roadMesh');
    this._disposeMesh('riverMesh');
    if (this.cityGroup) {
      this.scene.remove(this.cityGroup);
      this.cityGroup.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      this.cityGroup.clear();
    }
    if (this.selRing) this.selRing.visible = false;
    if (this.hoverRing) this.hoverRing.visible = false;
    this.renderer._focusAnim = null;

    this._raisedFlags = new Set();
    this._flagAnims?.clear();

    this._buildBoard();
    this._buildOverlays();
    this._buildCities();
    this.renderer._fitTopCamera(world.w, world.h);

    const span = Math.max(world.w, world.h) * TILE;
    this.renderer._frameOrbit(span);
  }

  setCameraMode(mode) {
    this.renderer.setCameraMode(mode);
    if (mode === 'top') this.renderer._fitTopCamera(this.world.w, this.world.h);
  }

  _disposeMesh(name) {
    const m = this[name];
    if (!m) return;
    this.scene.remove(m);
    m.geometry?.dispose?.();
    m.material?.dispose?.();
    this[name] = null;
  }

  _worldX(x) { return (x - (this.world.w - 1) / 2) * TILE; }
  _worldZ(y) { return (y - (this.world.h - 1) / 2) * TILE; }
  _worldY(cell) {
    let h = 0;
    if      (cell.type === 'mount') h = 0.35 + cell.elevation * 0.4;
    else if (cell.type === 'hills') h = 0.15 + cell.elevation * 0.15;
    return h + 0.15;
  }

  // плавно фокусируемся на клетке
  _focusOnTile(tile, duration = 1500) {
    this.renderer.focusOnPoint(
      this._worldX(tile.x),
      this._worldY(tile) * 0.5, // чуть ниже верхушки — центр экрана «смотрит» в клетку
      this._worldZ(tile.y),
      duration,
    );
  }

  _buildBoard() {
    const world = this.world;
    const count = world.cells.length;
    if (count === 0) return;

    const geo = new THREE.BoxGeometry(TILE * 0.98, 0.3, TILE * 0.98);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const pickable = new THREE.InstancedMesh(
      geo, new THREE.MeshBasicMaterial({ visible: false }), count
    );

    world.cells.forEach((cell, i) => {
      if (!cell) return;
      const meta = cell.meta;
      dummy.position.set(this._worldX(cell.x), this._worldY(cell), this._worldZ(cell.y));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(meta.color);
      const tint = 0.9 + (hash2(cell.x, cell.y, world.seed) * 0.2);
      color.multiplyScalar(tint);
      inst.setColorAt(i, color);
      pickable.setMatrixAt(i, dummy.matrix);
      cell.meshId = i;
    });

    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.instanceMatrix.needsUpdate = true;
    pickable.instanceMatrix.needsUpdate = true;

    this.tileMesh = inst;
    this.pickMesh = pickable;
    this.scene.add(inst);
    this.scene.add(pickable);
  }

  _buildOverlays() {
    const world = this.world;
    const roadCells  = world.cells.filter(c => c?.hasRoad);
    const riverCells = world.cells.filter(c => c?.hasRiver);

    if (roadCells.length) {
      const g = new THREE.BoxGeometry(TILE * 0.6, 0.06, TILE * 0.6);
      const m = new THREE.MeshStandardMaterial({ color: 0xc8a86b, roughness: 0.9 });
      const inst = new THREE.InstancedMesh(g, m, roadCells.length);
      const d = new THREE.Object3D();
      roadCells.forEach((c, i) => {
        d.position.set(this._worldX(c.x), this._worldY(c) + 0.20, this._worldZ(c.y));
        d.rotation.y = Math.PI / 4;
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.roadMesh = inst;
      this.scene.add(inst);
    }

    if (riverCells.length) {
      const g = new THREE.BoxGeometry(TILE * 0.55, 0.05, TILE * 0.55);
      const m = new THREE.MeshStandardMaterial({
        color: 0x2f7fbf, emissive: 0x103050, emissiveIntensity: 0.4, roughness: 0.3,
      });
      const inst = new THREE.InstancedMesh(g, m, riverCells.length);
      const d = new THREE.Object3D();
      riverCells.forEach((c, i) => {
        d.position.set(this._worldX(c.x), this._worldY(c) + 0.16, this._worldZ(c.y));
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.riverMesh = inst;
      this.scene.add(inst);
    }
  }

  _buildCities() {
    if (this.cityGroup) {
      this.scene.remove(this.cityGroup);
      this.cityGroup.clear();
    }
    this.cityGroup = new THREE.Group();
    this.scene.add(this.cityGroup);

    this.world.cities.forEach((city, cityIndex) => {
      const g = new THREE.Group();
      const cell = this.world.get(city.x, city.y);
      const baseY = cell ? this._worldY(cell) : 0.15;

      const raisedY   = baseY + 1.40; // Флаг поднят
      const loweredY  = baseY + 0.55;

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(TILE * 0.32, TILE * 0.38, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: 0x8f6d4a, roughness: 0.8 })
      );
      base.position.y = baseY + 0.30;
      g.add(base);

      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.35, TILE * 0.5, TILE * 0.35),
        new THREE.MeshStandardMaterial({ color: 0xe6dbb8, roughness: 0.9 })
      );
      tower.position.y = baseY + 0.75;
      g.add(tower);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(TILE * 0.28, TILE * 0.35, 4),
        new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.6 })
      );
      roof.position.y = baseY + 1.20;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);

      const flagColor = this._ownerColor(city.ownerId);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(TILE * 0.3, TILE * 0.18),
        new THREE.MeshBasicMaterial({ color: flagColor, side: THREE.DoubleSide })
      );
      flag.position.set(TILE * 0.25, raisedY, 0);
      flag.userData = { raisedY, loweredY, cityIndex, raised: true };
      g.add(flag);

      g.position.set(this._worldX(city.x), 0, this._worldZ(city.y));
      flag.userData = {
        raisedY, loweredY, cityIndex, raised: true,
        // сохраняем «текущий» ownerId, чтобы уметь детектить изменения
        ownerId: city.ownerId ?? null,
      };

      g.userData = { type: 'city', city, flag, cityIndex };
      this.cityGroup.add(g);

      this._raisedFlags.add(cityIndex);
    });
  }

  _buildRings() {
    const geo = new THREE.RingGeometry(TILE * 0.44, TILE * 0.5, 24);
    geo.rotateX(-Math.PI / 2);
    this.hoverRing = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    this.hoverRing.visible = false;
    this.hoverRing.position.y = 0.5;
    this.scene.add(this.hoverRing);

    this.selRing = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: 0x2e8bff, transparent: true, opacity: 0.9 }));
    this.selRing.visible = false;
    this.selRing.position.y = 0.52;
    this.scene.add(this.selRing);
  }

  _bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('contextmenu', e => e.preventDefault());
    dom.addEventListener('pointermove', (e) => this._onPointerMove(e));
    dom.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('resize', () => this.renderer.onResize(this.world.w, this.world.h));

    window.addEventListener('wheel', (e) => {
      if (this.renderer.mode !== 'top') return;
      e.preventDefault();

      const cam = this.renderer.cameraTop;

      // базовый «полный» размер фрустума — по всей карте (эталон)
      const baseW = this.world.w * TILE * 1.1;
      const baseH = this.world.h * TILE * 1.1;

      // текущий размер фрустума
      const curW = cam.right - cam.left;
      const curH = cam.top - cam.bottom;

      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const nextW = curW * factor;
      const nextH = curH * factor;

      // границы зума: от 14% обзора (макс. приближение) до 210% обзора (макс. отдаление)
      const minW = baseW * 0.04;
      const maxW = baseW * 2.1;
      const minH = baseH * 0.04;
      const maxH = baseH * 2.1;

      const finalW = Math.max(minW, Math.min(maxW, nextW));
      const finalH = Math.max(minH, Math.min(maxH, nextH));

      cam.left   = -finalW / 2;
      cam.right  =  finalW / 2;
      cam.top    =  finalH / 2;
      cam.bottom = -finalH / 2;
      cam.updateProjectionMatrix();

      // после зума нужно и позицию clamp'нуть — фрустум изменился
      const cl = this._clampTopXZ(cam.position.x, cam.position.z);
      cam.position.x = cl.x;
      cam.position.z = cl.z;
      cam.lookAt(cam.position.x, 0, cam.position.z);
    }, { passive: false });

    window.addEventListener('keydown', (e) => { this._keys[e.code] = true; });
    window.addEventListener('keyup',   (e) => { this._keys[e.code] = false; });
  }

  _updateMouse(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this._mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  _pickTile() {
    const cam = this.renderer.mode === 'top' ? this.renderer.cameraTop : this.renderer.cameraOrbit;
    this._raycaster.setFromCamera(this._mouse, cam);
    const hits = this._raycaster.intersectObject(this.pickMesh);
    if (!hits.length) return null;
    return this.world.cells[hits[0].instanceId];
  }

  _onPointerMove(e) {
    this._updateMouse(e);
    const tile = this._pickTile();
    if (tile) {
      this.hoverRing.visible = true;
      this.hoverRing.position.x = this._worldX(tile.x);
      this.hoverRing.position.z = this._worldZ(tile.y);
      this.hoverRing.position.y = this._worldY(tile) + 0.2;
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hoverRing.visible = false;
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  _onPointerDown(e) {
    if (e.button !== 0) return;
    this._updateMouse(e);
    const tile = this._pickTile();
    if (!tile) return;

    // кольцо выбора
    this.selRing.visible = true;
    this.selRing.position.x = this._worldX(tile.x);
    this.selRing.position.z = this._worldZ(tile.y);
    this.selRing.position.y = this._worldY(tile) + 0.22;

    // плавно центрируем на клетке (в орбите это ещё и смена pivot)
    this._focusOnTile(tile);

    // внешний обработчик
    this._onTileClick?.(tile);
  }

  _animate(t) {
    requestAnimationFrame((tt) => this._animate(tt));
    const dt = Math.max(0, t - this._lastT);
    this._lastT = t;

    if (this.renderer.mode === 'top') {
      const cam = this.renderer.cameraTop;
      // если идёт анимация фокуса — WASD не мешаем ей
      if (!this.renderer._focusAnim) {
        const speed = 0.6 * (cam.right - cam.left) * 0.02;
        let dx = 0, dz = 0;

        const a = this._mapBounds();

        if (this._keys['KeyW'] && cam.position.z > a.minZ) dz -= speed;
        if (this._keys['KeyS'] && cam.position.z < a.maxZ) dz += speed;
        if (this._keys['KeyA'] && cam.position.x > a.minX) dx -= speed;
        if (this._keys['KeyD'] && cam.position.x < a.maxX) dx += speed;
        if (dx || dz) {
          cam.position.x += dx;
          cam.position.z += dz;
          cam.lookAt(cam.position.x, 0, cam.position.z);
        }
      }
    } else {
      this.renderer.controls.update();
    }

    this._stepFlagAnims (dt);
    this.renderer.render(dt);
  }

  // границы карты в мировых координатах (карта центрирована в нуле)
  _mapBounds() {
    const w = (this.world.w * TILE) / 2;
    const h = (this.world.h * TILE) / 2;
    return {
      minX: -w, maxX: w,
      minZ: -h, maxZ: h,
    };
  }

  // клампит точку-центр так, чтобы обзор не выходил за карту
  _clampTopXZ(x, z) {
    const cam = this.renderer.cameraTop;
    const halfW = (cam.right - cam.left) / 2;
    const halfH = (cam.top - cam.bottom) / 2;
    const b = this._mapBounds();
    const cx = (b.maxX - b.minX) <= halfW * 2
      ? (b.minX + b.maxX) / 2                       // обзор шире карты — центрируем
      : THREE.MathUtils.clamp(x, b.minX + halfW, b.maxX - halfW);
    const cz = (b.maxZ - b.minZ) <= halfH * 2
      ? (b.minZ + b.maxZ) / 2
      : THREE.MathUtils.clamp(z, b.minZ + halfH, b.maxZ - halfH);
    return { x: cx, z: cz };
  }

  _clampTopCamera() {
    const cam = this.renderer.cameraTop;
    const p = this._clampTopXZ(cam.position.x, cam.position.z);
    cam.position.x = p.x; cam.position.z = p.z;
    cam.lookAt(p.x, 0, p.z);
  }

  destroy() {
    this.renderer?.controls?.dispose?.();
    this.renderer?.renderer?.dispose?.();
    this.renderer?.domElement?.remove?.();
    this.scene?.clear?.();
    // вешатели на window остаются — если хочешь чисто, вынеси их в _unbind
  }

  setCityFlag(cityOrIndex, raised = true, duration = 600) {
    const idx = this._resolveCityIndex(cityOrIndex);
    if (idx < 0) return false;

    const group = this.cityGroup?.children[idx];
    const flag = group?.userData?.flag;
    if (!flag) return false;

    // ⬅️ столицу опускать нельзя
    const type = group.userData?.city?.type;
    if (!raised && type === CITY_TYPE.CAPITAL) return false;

    if (flag.userData.raised === raised) return true;

    const targetY = raised ? flag.userData.raisedY : flag.userData.loweredY;
    flag.userData.raised = raised;
    raised ? this._raisedFlags.add(idx) : this._raisedFlags.delete(idx);

    if (raised) flag.visible = true;

    if (duration <= 0) {
      this._flagAnims.delete(flag);
      flag.position.y = targetY;
      flag.visible = raised;
      return true;
    }

    this._flagAnims.set(flag, {
      fromY: flag.position.y,
      toY: targetY,
      t: 0,
      dur: duration,
      hideAtEnd: !raised,
    });
    return true;
  }

    _resolveCityIndex(v) {
      const cities = this.world.cities;
      if (typeof v === 'number') return (v >= 0 && v < cities.length) ? v : -1;
      if (!v || typeof v !== 'object') return -1;
      const byRef = cities.indexOf(v);
      if (byRef >= 0) return byRef;
      return cities.findIndex(c => c.x === v.x && c.y === v.y);
    }

    _stepFlagAnims(dt) {
      if (!this._flagAnims || this._flagAnims.size === 0) return;
      for (const [flag, a] of this._flagAnims) {
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        const e = 1 - Math.pow(1 - k, 3);
        flag.position.y = a.fromY + (a.toY - a.fromY) * e;
        if (k >= 1) {
          if (a.hideAtEnd) flag.visible = false;   // ⬅️ спрятать в конце опускания
          this._flagAnims.delete(flag);
        }
      }
    }

  /**
   * Опустить флаги у всех городов.
   * @param {number} duration — длительность анимации в мс (0 = мгновенно)
   * @returns {number} количество флагов, у которых состояние реально изменилось
   */
  lowerAllFlags(duration = 600) {
    if (!this.cityGroup) return 0;
    let changed = 0;

    this.cityGroup.children.forEach((g, idx) => {
      const flag = g?.userData?.flag;
      if (!flag || flag.userData.raised === false) return;      // уже опущен
      if (g.userData?.city?.type === CITY_TYPE.CAPITAL) return; // ⬅️ столицу не трогаем

      const targetY = flag.userData.loweredY;
      flag.userData.raised = false;
      this._raisedFlags.delete(idx);
      changed++;

      if (duration <= 0) {
        this._flagAnims.delete(flag);
        flag.position.y = targetY;
        flag.visible = false;
        return;
      }
      this._flagAnims.set(flag, {
        fromY: flag.position.y,
        toY: targetY,
        t: 0,
        dur: duration,
        hideAtEnd: true,
      });
    });

    return changed;
  }

  /** Палитра-фолбэк, если players не передан или у игрока нет color. */
  static DEFAULT_OWNER_PALETTE = [
    0x2e8bff, 0xd64545, 0x5bbf6a, 0xf0c040,
    0xa46bff, 0x22b8cf, 0xff8c42, 0xb0b8c0,
  ];

  /** Цвет флага для ownerId (null → нейтральный). */
  _ownerColor(ownerId) {
    if (ownerId === null || ownerId === undefined) {
      return 0; // 0xd9c9a3; // нейтральный (тёплый песочный)
    }
    // 1) взять из Players по index
    const pl = this.players?.get?.(ownerId)
            ?? this.players?.list?.[ownerId]
            ?? null;
    if (pl && typeof pl.color === 'number') return pl.color;

    // 2) фолбэк по палитре
    // const P = MapView.DEFAULT_OWNER_PALETTE;
    // return P[ownerId % P.length];
    return 0;
  }
}