// render/map-view.js
import * as THREE from 'three';
import { Renderer, TILE } from './renderer.js';
import { hash2       } from '../core/rng.js';
import { CITY_TYPE   } from '../core/world.js';
import { UnitsView   } from './r-units-view.js';
import { disposeTree } from './r-units-view.js';
import { mulberry32  } from '../core/rng.js';
import { spawnRandomMountain } from './mesh.js';

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

    // инерционный зум (состояние пружины)
    this._topZoom   = null;   // { log, target, vel, ratio }
    this._orbitZoom = null;   // { log, target, vel }
    this._tmpDir    = new THREE.Vector3();

    this._raisedFlags = new Set();
    this._flagAnims = new Map();

    this.unitsView = new UnitsView(this, { /// +
      getArmies:  () => this._collectArmies(),
      getPlayers: () => this.players,
    });
    this.unitsView.rebuild();
    this.routeView = new RouteView(this, {
      onlyActiveOwner: false,   // true — только маршрут активного игрока
    });

    this._buildBoard();
    this._buildOverlays();
    this._buildMountains();
    this._buildCities();

    this._buildRings();
    this._bindEvents();
    this.renderer.onResize(this.world.w, this.world.h);
  }

  _collectArmies() {
    const out = [];
    const players = this.players;
    if (players?.list) {
      for (const p of players.list) {
        if (!p?.active) continue;
        for (const a of p.army ?? []) out.push(a);
      }
    }
    // если есть нейтральные армии — добавить сюда
    return out;
  }

  rebuild(world, players = this.players) {
    this.world   = world;
    this.players = players;
    this._disposeMesh('tileMesh');
    this._disposeMesh('pickMesh');
    this._disposeMesh('roadMesh');
    this._disposeMesh('riverMesh');

    if (this.mountainGroup) {
      this.scene.remove(this.mountainGroup);
      disposeTree(this.mountainGroup);
      this.mountainGroup = null;
    }

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
    this._buildMountains();
    this._buildCities();
    this.renderer._fitTopCamera(world.w, world.h);

    const span = Math.max(world.w, world.h) * TILE;
    this.renderer._frameOrbit(span);

    /// +
    this.unitsView?.destroy();
    this.unitsView = new UnitsView(this, {
      getArmies:  () => this._collectArmies(),
      getPlayers: () => this.players,
    });
    this.unitsView.rebuild();

    this.routeView?.destroy();
    this.routeView = new RouteView(this, {
      onlyActiveOwner: false,
    });
    // routeView.rebuild() вызовется ниже, после того как появятся армии
    this.routeView.rebuild();
  }

  setCameraMode(mode) {
    this.renderer.setCameraMode(mode);
    if (mode === 'top') this.renderer._fitTopCamera(this.world.w, this.world.h);
  }

  /**
   * Вступительная анимация камеры: карта сначала видна издалека,
   * затем камера подлетает так, что карта занимает весь экран.
   */
  playIntroCamera(opts = {}) {
    this.renderer.setCameraMode('orbit');
    this.renderer.flyInToMap(this.world.w, this.world.h, opts);
  }

  _disposeMesh(name) {
    const m = this[name];
    if (!m) return;
    this.scene.remove(m);
    m.geometry?.dispose?.();
    m.material?.dispose?.();
    m.dispose?.();   // InstancedMesh: освобождает instance-атрибуты
    this[name] = null;
  }

  _worldX(x) { return (x - (this.world.w - 1) / 2) * TILE; }
  _worldZ(y) { return (y - (this.world.h - 1) / 2) * TILE; }
  _worldY(cell) {
    let h = 0;
    // Горы стоят на общем уровне земли — без «подставки» под горой.
         if (cell.type === 'hills') h = 0.15 + cell.elevation * 0.15;
    else if (cell.type === 'mount') h = 0.15 + cell.elevation * 0.15;
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

    /**
   * Процедурные горы: по одной THREE.Group на каждую клетку типа 'mount'.
   * Форма выбирается детерминированно из (world.seed, x, y), поэтому
   * одна и та же карта при пересборке даёт те же горы.
   */
  _buildMountains() {
    const world = this.world;
    const mountCells = world.cells.filter(c => c?.type === 'mount');
    if (!mountCells.length) return;

    this.mountainGroup = new THREE.Group();
    this.mountainGroup.name = 'Mountains';
    this.scene.add(this.mountainGroup);

    for (const cell of mountCells) {
      // Отдельный RNG на каждую клетку — не зависим от порядка обхода
      const rng = mulberry32((world.seed ^ 0xCAFE) + cell.x * 73856093 + cell.y * 19349663);
      const g = spawnRandomMountain(rng, { tile: TILE });

      // Основание горы лежит на верхней поверхности клетки, а не в её центре:
      // это убирает выступающий «пьедестал» под горой.
      g.position.set(
        this._worldX(cell.x),
        this._worldY(cell) + 0.15,
        this._worldZ(cell.y),
      );
      // Лёгкая вариативность поворота, чтобы одинаковые силуэты не бросались в глаза
      g.rotation.y = rng() * Math.PI * 2;

      g.userData.cell = cell;
      this.mountainGroup.add(g);
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
    // сохраняем ссылки, чтобы снять слушатели в destroy() — иначе
    // обработчики с this/mapView остаются жить в window после смены экрана
    const dom = this.renderer.domElement;

    this._onContextMenu = (e) => e.preventDefault();
    this._onPointerMoveDom = (e) => this._onPointerMove(e);
    this._onPointerDownDom = (e) => this._onPointerDown(e);
    this._onWindowResize = () => this.renderer.onResize(this.world.w, this.world.h);
    this._onWindowWheel = (e) => {
      // не мешаем прокрутке панелей/списков в HUD
      if (e.target !== this.renderer.domElement) return;
      const mode = this.renderer.mode;
      if (mode !== 'top' && mode !== 'orbit') return;

      e.preventDefault();
      e.stopPropagation();

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;        // строки
      else if (e.deltaMode === 2) dy *= 100;  // страницы
      if (!dy) return;

      // один и тот же шаг зума в логарифмическом масштабе
      const factor = Math.exp(dy * 0.0012);

      if (mode === 'top') {
        const z = this._topZoom ?? this._initTopZoom();
        const lim = this._topZoomLimit(z);
        z.target = THREE.MathUtils.clamp(
          z.target + Math.log(factor),
          Math.log(lim.minW),
          Math.log(lim.maxW),
        );
      } else {
        // во время вступительного подлёта дистанцию задаёт анимация —
        // колесо просто масштабирует её траекторию.
        const fa = this.renderer._focusAnim;
        if (fa?.kind === 'fly') {
          fa.zoomFactor = THREE.MathUtils.clamp((fa.zoomFactor ?? 1) * factor, 0.1, 1.5);
          return;
        }
        const z = this._orbitZoom ?? this._initOrbitZoom();
        const c = this.renderer.controls;
        z.target = THREE.MathUtils.clamp(
          z.target + Math.log(factor),
          Math.log(c.minDistance),
          Math.log(c.maxDistance),
        );
      }
    };

    dom.addEventListener('contextmenu', this._onContextMenu);
    dom.addEventListener('pointermove', this._onPointerMoveDom);
    dom.addEventListener('pointerdown', this._onPointerDownDom);
    window.addEventListener('resize', this._onWindowResize);
    // capture: перехватываем wheel раньше OrbitControls, но не мешаем HUD
    window.addEventListener('wheel', this._onWindowWheel, { passive: false, capture: true });
    this._onWindowKeyDown = (e) => { this._keys[e.code] = true; };
    this._onWindowKeyUp   = (e) => { this._keys[e.code] = false; };
    window.addEventListener('keydown', this._onWindowKeyDown);
    window.addEventListener('keyup',   this._onWindowKeyUp);
  }

  _unbindEvents() {
    if (!this.renderer?.domElement) return;
    const dom = this.renderer.domElement;

    dom.removeEventListener('contextmenu', this._onContextMenu);
    dom.removeEventListener('pointermove', this._onPointerMoveDom);
    dom.removeEventListener('pointerdown', this._onPointerDownDom);
    window.removeEventListener('resize', this._onWindowResize);
    window.removeEventListener('wheel', this._onWindowWheel, true);
    window.removeEventListener('keydown', this._onWindowKeyDown);
    window.removeEventListener('keyup', this._onWindowKeyUp);
    this._onContextMenu = this._onPointerMoveDom = this._onPointerDownDom = null;
    this._onWindowResize = this._onWindowWheel = null;
    this._onWindowKeyDown = this._onWindowKeyUp = null;
  }

  // ---------- инерционный зум ----------

  _resetZoomState() {
    this._topZoom = null;
    this._orbitZoom = null;
  }

  _initTopZoom() {
    const cam = this.renderer.cameraTop;
    const w = cam.right - cam.left;
    const h = cam.top - cam.bottom;
    const log = Math.log(w);
    this._topZoom = { log, target: log, vel: 0, ratio: w / h };
    return this._topZoom;
  }

  _topZoomLimit(z) {
    const baseW = this.world.w * TILE * 1.1;
    const baseH = this.world.h * TILE * 1.1;
    // одинаковый относительный диапазон, но с учётом соотношения сторон
    const minW = Math.max(baseW * 0.04, baseH * 0.04 * z.ratio);
    const maxW = Math.min(baseW * 2.1, baseH * 2.1 * z.ratio);
    return { minW, maxW };
  }

  _initOrbitZoom() {
    const c = this.renderer.controls;
    const d = this.renderer.cameraOrbit.position.distanceTo(c.target);
    const log = Math.log(Math.max(d, 1e-4));
    this._orbitZoom = { log, target: log, vel: 0 };
    return this._orbitZoom;
  }

  // пружина с демпфером в лог-пространстве: даёт инерцию и «довыброс»
  _spring(log, vel, target, dtSec, omega = 14, zeta = 0.85) {
    if (dtSec <= 0) return { log, vel };
    const k = omega * omega;
    const c = 2 * zeta * omega;
    const x = log - target;
    vel += (-k * x - c * vel) * dtSec;
    log += vel * dtSec;
    return { log, vel };
  }

  _updateTopZoom(dt) {
    const z = this._topZoom;
    if (!z) return;

    const dtSec = Math.min(dt, 50) / 1000;
    ({ log: z.log, vel: z.vel } = this._spring(z.log, z.vel, z.target, dtSec));

    const lim = this._topZoomLimit(z);
    const minLog = Math.log(lim.minW);
    const maxLog = Math.log(lim.maxW);
    if (z.log <= minLog) { z.log = minLog; z.vel = 0; }
    else if (z.log >= maxLog) { z.log = maxLog; z.vel = 0; }

    const w = Math.exp(z.log);
    const h = w / z.ratio;

    const cam = this.renderer.cameraTop;
    cam.left   = -w / 2;
    cam.right  =  w / 2;
    cam.top    =  h / 2;
    cam.bottom = -h / 2;
    cam.updateProjectionMatrix();

    // после зума нужно пересчитать clamp позиции — фрустум изменился
    const cl = this._clampTopXZ(cam.position.x, cam.position.z);
    cam.position.x = cl.x;
    cam.position.z = cl.z;
    cam.lookAt(cam.position.x, 0, cam.position.z);
  }

  _updateOrbitZoom(dt) {
    const z = this._orbitZoom;
    if (!z) return;

    const c = this.renderer.controls;
    const dtSec = Math.min(dt, 50) / 1000;
    ({ log: z.log, vel: z.vel } = this._spring(z.log, z.vel, z.target, dtSec));

    const minLog = Math.log(c.minDistance);
    const maxLog = Math.log(c.maxDistance);
    if (z.log <= minLog) { z.log = minLog; z.vel = 0; }
    else if (z.log >= maxLog) { z.log = maxLog; z.vel = 0; }

    const dist = Math.exp(z.log);
    const cam = this.renderer.cameraOrbit;
    const dir = this._tmpDir.copy(cam.position).sub(c.target);
    if (dir.lengthSq() < 1e-9) return;
    dir.normalize().multiplyScalar(dist);
    cam.position.copy(c.target).add(dir);
  }

  _updateMouse(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this._mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  _pickTile() {
    const cam = this.renderer.mode === 'top' ? this.renderer.cameraTop : this.renderer.cameraOrbit;
    this._raycaster.setFromCamera(this._mouse, cam);

    // сначала — гора (если попали в неё, вернём её клетку)
    if (this.mountainGroup) {
      const mHits = this._raycaster.intersectObject(this.mountainGroup, true);
      if (mHits.length) {
        let obj = mHits[0].object;
        while (obj && !obj.userData?.cell) obj = obj.parent;
        if (obj?.userData?.cell) return obj.userData.cell;
      }
    }

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

  update(dt) {
    // сначала двигаем камеру анимацией фокуса/подлёта,
    // затем применяем зум — чтобы колесо работало и во время движения.
    this.renderer._stepFocusAnim(dt);

    if (this.renderer.mode === 'top') {
      this._updateTopZoom(dt);
      const cam = this.renderer.cameraTop;
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
      // во время подлёта дистанцией управляет сама анимация (zoomFactor),
      // поэтому пружину зума не трогаем — иначе она будет спорить с ней.
      if (this.renderer._focusAnim?.kind !== 'fly') {
        this._updateOrbitZoom(dt);
      }
    }

    this._stepFlagAnims(dt);

    // если армии двигаются — обновляем позиции узлов
    // (можно вызывать точечно из логики движения, см. ниже)

    // мягкая пульсация маркеров маршрутов
    if (this.routeView?._nodes) {
      const t = performance.now() * 0.003;
      for (const [, node] of this.routeView._nodes) {
        node.root.children.forEach((m, i) => {
          const k = 1 + 0.08 * Math.sin(t + i * 0.4);
          m.scale.setScalar(k);
        });
      }
    }
  }

  render(dt) {
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
    this._unbindEvents();

    this.routeView?.destroy();
    this.routeView = null;
    this.unitsView?.destroy();
    this.unitsView = null;

    if (this.mountainGroup) {
      this.scene.remove(this.mountainGroup);
      disposeTree(this.mountainGroup);
      this.mountainGroup = null;
    }

    this._disposeMesh('tileMesh');
    this._disposeMesh('pickMesh');
    this._disposeMesh('roadMesh');
    this._disposeMesh('riverMesh');

    if (this.cityGroup) {
      this.scene.remove(this.cityGroup);
      disposeTree(this.cityGroup);
      this.cityGroup = null;
    }

    for (const ring of [this.hoverRing, this.selRing]) {
      if (!ring) continue;
      this.scene.remove(ring);
      ring.geometry?.dispose?.();
      ring.material?.dispose?.();
    }
    this.hoverRing = this.selRing = null;

    if (this.renderer) {
      this.renderer.controls?.dispose?.();
      this.renderer.renderer?.dispose?.();
      this.renderer.domElement?.remove?.();
      this.renderer.scene?.clear?.();
    }
  }

  /**
   * Сменить владельца города и поднять флаг цвета нового владельца.
   * @param {object|number} cityOrIndex
   * @param {number|null} ownerId
   * @param {object} [opts]
   * @param {boolean} [opts.raised=true]  — поднять флаг
   * @param {number}  [opts.duration=600] — длительность анимации (мс)
   * @returns {boolean}
   */
  setCityOwner(cityOrIndex, ownerId, { raised = true, duration = 600 } = {}) {
    const idx = this._resolveCityIndex(cityOrIndex);
    if (idx < 0) return false;

    const group = this.cityGroup?.children[idx];
    const flag = group?.userData?.flag;
    const city = group?.userData?.city;
    if (!flag || !city) return false;

    city.ownerId = ownerId ?? null;
    flag.userData.ownerId = city.ownerId;

    flag.material.color.setHex(this._ownerColor(city.ownerId));
    flag.material.needsUpdate = true;

    return this.setCityFlag(idx, raised, duration);
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

/* =========================================================
   RouteView — визуализация маршрутов армий.
   Читает army.route (Cell[]) и рисует маркеры на клетках.
   ========================================================= */
export class RouteView {
  /**
   * @param {MapView} mapView
   * @param {object} [opts]
   * @param {number} [opts.markerSize=0.28]
   * @param {number} [opts.markerColor=0xff3333]
   * @param {boolean} [opts.onlyActiveOwner=true] — рисовать только маршрут активного игрока
   */
  constructor(mapView, opts = {}) {
    this.mapView = mapView;
    this.scene   = mapView.scene;

    this.markerSize  = opts.markerSize  ?? 0.28;
    this.markerColor = opts.markerColor ?? 0xff3333;
    this.onlyActiveOwner = opts.onlyActiveOwner !== false;

    this.group = new THREE.Group();
    this.group.name = 'RouteLayer';
    this.scene.add(this.group);

    /** Map<army, { root, cells }> — что нарисовано сейчас */
    this._nodes = new Map();
    /** Текущий активный ownerId (для фильтра) */
    this._activeOwner = null;
  }

  /** Установить активного игрока — рисовать будем только его маршруты */
  setActiveOwner(idOwner) {
    if (this._activeOwner === idOwner) return;
    this._activeOwner = idOwner;
    this.rebuild();
  }

  /** Полная перерисовка всех маршрутов */
  rebuild() {
    this.clear();

    const armies = this.mapView._collectArmies?.() ?? [];
    for (const army of armies) {
      if (!army.route?.length) continue;
      if (this.onlyActiveOwner
          && this._activeOwner !== null
          && army.idOwner !== this._activeOwner) continue;

      this._buildRoute(army);
    }
  }

  /** Обновить маршрут одной армии (после пересчёта) */
  updateArmy(army) {
    this._removeArmy(army);
    if (!army.route?.length) return;
    if (this.onlyActiveOwner
        && this._activeOwner !== null
        && army.idOwner !== this._activeOwner) return;
    this._buildRoute(army);
  }

  /** Убрать маршрут конкретной армии с карты */
  _removeArmy(army) {
    const node = this._nodes.get(army);
    if (!node) return;
    this.group.remove(node.root);
    disposeTree(node.root);
    this._nodes.delete(army);
  }

  clear() {
    for (const [, node] of this._nodes) {
      this.group.remove(node.root);
      disposeTree(node.root);
    }
    this._nodes.clear();
  }

  destroy() {
    this.clear();
    this.scene.remove(this.group);
  }

  /* ---------- построение ---------- */
  _buildRoute(army) {
    const root = new THREE.Group();
    root.name = `route-${army.id}`;

    const cells = [];

    for (const cell of army.route) {
      if (!cell) continue;

      const marker = UnitsView.createCellMarker(this.markerSize, this.markerColor);
      const wx = this.mapView._worldX(cell.x);
      const wz = this.mapView._worldZ(cell.y);
      const wy = this.mapView._worldY(cell) + 0.02;

      marker.position.set(wx, wy, wz);

      // Опционально: чем ближе к цели, тем ярче (можно играться)
      // marker.scale.setScalar(1 + 0.1 * i / army.route.length);

      root.add(marker);
      cells.push(cell);
    }

    this.group.add(root);
    this._nodes.set(army, { root, cells });
  }

  /* ---------- очистка пройденных клеток ---------- */
  /**
   * Убирает из армии пройденные клетки и перерисовывает её маршрут.
   * Вызывается после шага армии в игровой логике.
   *
   * @param {object} army
   * @param {number} [steps=1] — сколько шагов армия только что прошла
   */
  consumeSteps(army, steps = 1) {
    if (!army.route?.length) return;

    const n = Math.min(steps, army.route.length);
    army.route.splice(0, n);

    // Если маршрут закончился — снять маркеры
    if (army.route.length === 0) {
      army.cellGoal = null;
      this._removeArmy(army);
      return;
    }
    this.updateArmy(army);
  }

  /**
   * Синхронизирует маркеры с текущей клеткой армии:
   * удаляет из маршрута все клетки «позади» армии.
   * Полезно, если армия двигалась не через consumeSteps.
   */
  syncArmyPosition(army) {
    if (!army.route?.length) return;
    const { x, y } = army;
    const idx = army.route.findIndex(c => c && c.x === x && c.y === y);
    if (idx < 0) return;                // армия вне маршрута — не трогаем
    army.route.splice(0, idx + 1);      // всё до текущей (включая её) — пройдено
    if (army.route.length === 0) {
      army.cellGoal = null;
      this._removeArmy(army);
      return;
    }
    this.updateArmy(army);
  }
}