/**
 * Renderer — Three.js сцена: InstancedMesh тайлов, юнитов, декора,
 * подсветка достижимости, камера с зумом/панорамированием, эффекты.
 * Логика игры не зависит от этого класса — он только визуализирует GameState.
 */

import * as THREE from 'three';
import { GameState, TerrainType, Unit, OwnerId } from './types';
import { ReachMap } from './board';

const TILE = 1;
const TILE_H: Record<TerrainType, number> = {
  water: 0.08,
  plain: 0.16,
  forest: 0.22,
  mountain: 0.5,
};

const COLORS = {
  water: 0x3f7d86,
  plain: 0x7a9e5f,
  forest: 0x4a7345,
  mountain: 0x8a8178,
  faction: [0xd33f49, 0x3e8e52], // 0 игрок — алый, 1 ИИ — зелёный
  neutral: 0xb8b2a7,
  selection: 0xffd700,
  reach: 0xffffff,
  attackMark: 0xff5533,
  cityStone: 0xd9d2c5,
};

interface MoveAnim {
  unitId: number;
  points: { x: number; y: number }[];
  seg: number;
  t: number;
  speed: number; // клеток в секунду
}

interface Burst {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  kind: 'hit' | 'capture' | 'death';
}

interface UnitVisual {
  x: number;
  y: number;
}

const worldX = (gx: number) => (gx - 7) * TILE;
const worldZ = (gy: number) => (gy - 7) * TILE;

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private tileMesh!: THREE.InstancedMesh;
  private treeMesh!: THREE.InstancedMesh;
  private rockMesh!: THREE.InstancedMesh;
  private cityGroups = new Map<number, THREE.Group>();
  private cityFlags = new Map<number, THREE.Mesh>();
  private unitMesh!: THREE.InstancedMesh;
  private reachMesh!: THREE.InstancedMesh;
  private attackMesh!: THREE.InstancedMesh;
  private selectionRing!: THREE.Mesh;
  private hoverRing!: THREE.Mesh;

  private visuals = new Map<number, UnitVisual>();
  private moveAnims: MoveAnim[] = [];
  private bursts: Burst[] = [];

  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private camTarget = new THREE.Vector3(0, 0, 0);
  private camDist = 17;
  private camAngle = Math.PI * 0.27; // угол наклона (~48°)
  private camYaw = 0;

  private pointerDown = false;
  private dragMode: 'none' | 'pan' = 'none';
  private dragStart = { x: 0, y: 0 };
  private camTargetStart = new THREE.Vector3();
  private movedDuringDrag = false;
  private hoverTile: { x: number; y: number } | null = null;

  private state: GameState | null = null;
  private reach: ReachMap | null = null;
  private reachUnitId: number | null = null;
  private attackableIds = new Set<number>();

  /** Колбэк клика по клетке (только если это был клик, а не drag) */
  onClickTile: ((x: number, y: number) => void) | null = null;
  onStepSound: (() => void) | null = null;

  private lastTime = 0;
  private elapsed = 0;
  private lastCamPos = new THREE.Vector3();
  private lastCamQuat = new THREE.Quaternion();
  private rafId = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x191410);
    this.scene.fog = new THREE.Fog(0x191410, 26, 52);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // тени обновляем только при изменениях
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.cursor = 'pointer';

    this.setupLights();
    this.setupMeshes();
    this.bindEvents();
    this.resize();

    this.animate();
  }

  // ---------- Настройка сцены ----------

  private setupLights(): void {
    const amb = new THREE.AmbientLight(0xfff3e0, 0.75);
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffe0b0, 1.4);
    dir.position.set(10, 18, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -14;
    dir.shadow.camera.right = 14;
    dir.shadow.camera.top = 14;
    dir.shadow.camera.bottom = -14;
    dir.shadow.camera.far = 60;
    this.scene.add(dir);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a3b2a, 0.35);
    this.scene.add(hemi);
  }

  private setupMeshes(): void {
    const maxTiles = 15 * 15;
    // Тайлы — боксы, высота через scale
    const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 1, TILE * 0.98);
    const tileMat = new THREE.MeshLambertMaterial({ vertexColors: false });
    this.tileMesh = new THREE.InstancedMesh(tileGeo, tileMat, maxTiles);
    this.tileMesh.receiveShadow = true;
    this.tileMesh.castShadow = false;
    this.tileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.tileMesh);

    // Деревья для леса
    const treeGeo = new THREE.ConeGeometry(0.28, 0.75, 6);
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x2f5d33 });
    this.treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, maxTiles * 3);
    this.treeMesh.castShadow = true;
    this.treeMesh.count = 0;
    this.scene.add(this.treeMesh);

    // Скалы для гор
    const rockGeo = new THREE.ConeGeometry(0.42, 0.9, 5);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6e675e });
    this.rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, maxTiles);
    this.rockMesh.castShadow = true;
    this.rockMesh.count = 0;
    this.scene.add(this.rockMesh);

    // Юниты — капсулы
    const unitGeo = new THREE.CapsuleGeometry(0.22, 0.3, 4, 10);
    const unitMat = new THREE.MeshLambertMaterial();
    this.unitMesh = new THREE.InstancedMesh(unitGeo, unitMat, 64);
    this.unitMesh.castShadow = true;
    this.unitMesh.count = 0;
    this.unitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.unitMesh);

    // Подсветка достижимости — плоскости
    const reachGeo = new THREE.PlaneGeometry(TILE * 0.86, TILE * 0.86);
    reachGeo.rotateX(-Math.PI / 2);
    const reachMat = new THREE.MeshBasicMaterial({
      color: COLORS.reach,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.reachMesh = new THREE.InstancedMesh(reachGeo, reachMat, maxTiles);
    this.reachMesh.count = 0;
    this.scene.add(this.reachMesh);

    // Подсветка атакуемых — плоскости красные
    const attackGeo = new THREE.RingGeometry(0.28, 0.44, 4);
    attackGeo.rotateX(-Math.PI / 2);
    attackGeo.rotateY(Math.PI / 4);
    const attackMat = new THREE.MeshBasicMaterial({
      color: COLORS.attackMark,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.attackMesh = new THREE.InstancedMesh(attackGeo, attackMat, 32);
    this.attackMesh.count = 0;
    this.scene.add(this.attackMesh);

    // Кольцо выделения
    const selGeo = new THREE.TorusGeometry(0.42, 0.045, 8, 32);
    selGeo.rotateX(-Math.PI / 2);
    const selMat = new THREE.MeshBasicMaterial({ color: COLORS.selection });
    this.selectionRing = new THREE.Mesh(selGeo, selMat);
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    // Кольцо наведения
    const hovGeo = new THREE.TorusGeometry(0.42, 0.03, 8, 32);
    hovGeo.rotateX(-Math.PI / 2);
    const hovMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    this.hoverRing = new THREE.Mesh(hovGeo, hovMat);
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);
  }

  // ---------- Синхронизация с состоянием ----------

  sync(state: GameState): void {
    this.state = state;
    this.syncTiles(state);
    this.syncCities(state);
    this.syncUnits(state);
    this.syncHighlights(state);
    this.updateCameraPosition();
    // Сцена изменилась — обновляем тени в следующем кадре
    this.renderer.shadowMap.needsUpdate = true;
  }

  private syncTiles(state: GameState): void {
    let n = 0;
    let treeN = 0;
    let rockN = 0;
    for (let y = 0; y < state.mapH; y++) {
      for (let x = 0; x < state.mapW; x++) {
        const t = state.tiles[y][x];
        const h = TILE_H[t];
        this.dummy.position.set(worldX(x), h / 2, worldZ(y));
        this.dummy.scale.set(1, h, 1);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.tileMesh.setMatrixAt(n, this.dummy.matrix);
        this.color.setHex(COLORS[t]);
        this.tileMesh.setColorAt(n, this.color);
        n++;

        if (t === 'forest') {
          const cnt = 3;
          for (let i = 0; i < cnt && treeN < this.treeMesh.instanceMatrix.count; i++) {
            const ox = ((x * 7 + i * 13 + y * 3) % 10) / 10 - 0.5;
            const oz = ((y * 11 + i * 5 + x * 7) % 10) / 10 - 0.5;
            this.dummy.position.set(
              worldX(x) + ox * 0.6,
              TILE_H.forest + 0.34,
              worldZ(y) + oz * 0.6,
            );
            const s = 0.8 + ((x + y + i) % 4) * 0.12;
            this.dummy.scale.set(s, s, s);
            this.dummy.rotation.set(0, (x * 31 + y * 17 + i) % 6, 0);
            this.dummy.updateMatrix();
            this.treeMesh.setMatrixAt(treeN++, this.dummy.matrix);
          }
        } else if (t === 'mountain' && rockN < this.rockMesh.instanceMatrix.count) {
          this.dummy.position.set(worldX(x), TILE_H.mountain + 0.4, worldZ(y));
          const s = 0.9 + ((x * 3 + y * 5) % 3) * 0.15;
          this.dummy.scale.set(s, s, s);
          this.dummy.rotation.set(0, (x * 13 + y * 29) % 6, 0);
          this.dummy.updateMatrix();
          this.rockMesh.setMatrixAt(rockN++, this.dummy.matrix);
        }
      }
    }
    this.tileMesh.count = n;
    this.tileMesh.instanceMatrix.needsUpdate = true;
    if (this.tileMesh.instanceColor) this.tileMesh.instanceColor.needsUpdate = true;
    this.treeMesh.count = treeN;
    this.treeMesh.instanceMatrix.needsUpdate = true;
    this.rockMesh.count = rockN;
    this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  private syncCities(state: GameState): void {
    const seen = new Set<number>();
    for (const city of state.cities) {
      seen.add(city.id);
      let group = this.cityGroups.get(city.id);
      if (!group) {
        group = new THREE.Group();
        // Стены города
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.5, 0.3, 8),
          new THREE.MeshLambertMaterial({ color: COLORS.cityStone }),
        );
        base.position.y = 0.32;
        base.castShadow = true;
        group.add(base);
        // Башня
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.26, 0.75, 8),
          new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }),
        );
        tower.position.y = 0.75;
        tower.castShadow = true;
        group.add(tower);
        // Крыша-флагшток
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.26, 0.3, 8),
          new THREE.MeshLambertMaterial({ color: 0x8a5a3a }),
        );
        roof.position.y = 1.25;
        roof.castShadow = true;
        group.add(roof);
        // Флаг (цвет владельца)
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.2),
          new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
        );
        flag.position.set(0.16, 1.5, 0);
        group.add(flag);
        this.cityFlags.set(city.id, flag);

        group.position.set(worldX(city.x), 0, worldZ(city.y));
        this.scene.add(group);
        this.cityGroups.set(city.id, group);
      }
      const flag = this.cityFlags.get(city.id);
      if (flag) {
        const c = city.owner >= 0 ? COLORS.faction[city.owner] : COLORS.neutral;
        (flag.material as THREE.MeshLambertMaterial).color.setHex(c);
      }
    }
    // Удаление исчезнувших (при новой игре)
    for (const [id, group] of this.cityGroups) {
      if (!seen.has(id)) {
        this.scene.remove(group);
        this.cityGroups.delete(id);
        this.cityFlags.delete(id);
      }
    }
  }

  private syncUnits(state: GameState): void {
    const alive = state.units;
    const seen = new Set<number>();

    // Удаляем визуалы мёртвых
    for (const id of [...this.visuals.keys()]) {
      if (!alive.some((u) => u.id === id)) this.visuals.delete(id);
    }

    let n = 0;
    for (const u of alive) {
      seen.add(u.id);
      if (!this.visuals.has(u.id)) {
        this.visuals.set(u.id, { x: u.x, y: u.y });
      }
      const v = this.visuals.get(u.id)!;
      // Если анимации нет — прыгаем к целевой позиции (sync после боя/загрузки)
      const animating = this.moveAnims.some((a) => a.unitId === u.id);
      if (!animating) {
        v.x = u.x;
        v.y = u.y;
      }
      this.dummy.position.set(worldX(v.x), 0.55, worldZ(v.y));
      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.unitMesh.setMatrixAt(n, this.dummy.matrix);
      const c = u.owner >= 0 ? COLORS.faction[u.owner] : COLORS.neutral;
      this.color.setHex(c);
      this.unitMesh.setColorAt(n, this.color);
      n++;
    }
    this.unitMesh.count = n;
    this.unitMesh.instanceMatrix.needsUpdate = true;
    if (this.unitMesh.instanceColor) this.unitMesh.instanceColor.needsUpdate = true;
  }

  private syncHighlights(state: GameState): void {
    // Достижимость
    let n = 0;
    if (this.reach && this.reachUnitId !== null) {
      const unit = state.units.find((u) => u.id === this.reachUnitId);
      for (const [k, left] of this.reach.cost) {
        const [x, y] = k.split(',').map(Number);
        if (unit && x === unit.x && y === unit.y) continue;
        if (n >= this.reachMesh.instanceMatrix.count) break;
        this.dummy.position.set(worldX(x), TILE_H[state.tiles[y]?.[x] ?? 'plain'] + 0.02, worldZ(y));
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.reachMesh.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.reachMesh.count = n;
    this.reachMesh.instanceMatrix.needsUpdate = true;

    // Атакуемые враги
    let m = 0;
    for (const id of this.attackableIds) {
      const u = state.units.find((x) => x.id === id);
      if (!u || m >= this.attackMesh.instanceMatrix.count) continue;
      this.dummy.position.set(worldX(u.x), TILE_H[state.tiles[u.y]?.[u.x] ?? 'plain'] + 0.04, worldZ(u.y));
      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.attackMesh.setMatrixAt(m++, this.dummy.matrix);
    }
    this.attackMesh.count = m;
    this.attackMesh.instanceMatrix.needsUpdate = true;
  }

  /** Показать зону достижимости юнита + список атакуемых */
  showReach(state: GameState, reach: ReachMap | null, unitId: number | null, attackable: Unit[]): void {
    this.reach = reach;
    this.reachUnitId = unitId;
    this.attackableIds = new Set(attackable.map((u) => u.id));
    this.syncHighlights(state);
  }

  setSelected(unit: Unit | null): void {
    if (!unit) {
      this.selectionRing.visible = false;
      return;
    }
    this.selectionRing.visible = true;
    this.selectionRing.position.set(worldX(unit.x), 0.75, worldZ(unit.y));
  }

  // ---------- Эффекты ----------

  playMovePath(unitId: number, path: { x: number; y: number }[]): void {
    if (!path.length) return;
    const v = this.visuals.get(unitId);
    if (!v) return;
    const points = [{ x: v.x, y: v.y }, ...path];
    this.moveAnims.push({ unitId, points, seg: 0, t: 0, speed: 6 });
  }

  playHit(x: number, y: number): void {
    this.spawnBurst(x, y, 'hit');
  }

  playCapture(x: number, y: number): void {
    this.spawnBurst(x, y, 'capture');
  }

  playDeath(x: number, y: number): void {
    this.spawnBurst(x, y, 'death');
  }

  private spawnBurst(x: number, y: number, kind: Burst['kind']): void {
    const geo =
      kind === 'capture'
        ? new THREE.RingGeometry(0.2, 0.5, 24)
        : kind === 'death'
          ? new THREE.RingGeometry(0.1, 0.42, 16)
          : new THREE.RingGeometry(0.12, 0.3, 12);
    geo.rotateX(-Math.PI / 2);
    const col = kind === 'capture' ? 0xffd700 : kind === 'death' ? 0x999999 : 0xff5533;
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(worldX(x), 0.7, worldZ(y));
    this.scene.add(mesh);
    this.bursts.push({ mesh, t: 0, dur: kind === 'capture' ? 1.1 : 0.5, kind });
  }

  // ---------- Камера ----------

  private updateCameraPosition(): void {
    const d = this.camDist;
    const pitch = this.camAngle;
    const yaw = this.camYaw;
    this.camera.position.set(
      this.camTarget.x + d * Math.cos(pitch) * Math.sin(yaw),
      this.camTarget.y + d * Math.sin(pitch),
      this.camTarget.z + d * Math.cos(pitch) * Math.cos(yaw),
    );
    this.camera.lookAt(this.camTarget);
  }

  /** Двигалась ли камера с прошлой проверки */
  cameraMoved(): boolean {
    const moved =
      !this.camera.position.equals(this.lastCamPos) ||
      !this.camera.quaternion.equals(this.lastCamQuat);
    this.lastCamPos.copy(this.camera.position);
    this.lastCamQuat.copy(this.camera.quaternion);
    return moved;
  }

  zoomBy(delta: number): void {
    this.camDist = THREE.MathUtils.clamp(this.camDist + delta, 8, 30);
    this.updateCameraPosition();
  }

  panBy(dx: number, dy: number): void {
    // Двигаем цель камеры в плоскости XZ с учётом поворота
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    const scale = this.camDist / 400;
    this.camTarget.x += (-dx * cos + dy * sin) * scale;
    this.camTarget.z += (-dx * sin - dy * cos) * scale;
    this.camTarget.x = THREE.MathUtils.clamp(this.camTarget.x, -10, 10);
    this.camTarget.z = THREE.MathUtils.clamp(this.camTarget.z, -10, 10);
    this.updateCameraPosition();
  }

  private resize(): void {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------- События ----------

  private bindEvents(): void {
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      this.movedDuringDrag = false;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.camTargetStart.copy(this.camTarget);
      this.dragMode = e.button === 0 ? 'none' : 'pan'; // ЛКМ — клик, ПКМ/СКМ — пан
      if (this.dragMode === 'pan') el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.pointerDown && this.dragMode === 'pan') {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.movedDuringDrag = true;
        this.panBy(dx * 1.4, dy * 1.4);
        return;
      }

      // Наведение
      const tile = this.pickTile(mx, my);
      this.setHover(tile);
    });

    el.addEventListener('pointerup', (e) => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      const wasPan = this.dragMode === 'pan';
      this.dragMode = 'none';
      if (wasPan) {
        el.releasePointerCapture?.(e.pointerId);
        return;
      }
      if (this.movedDuringDrag) return;
      if (e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const tile = this.pickTile(e.clientX - rect.left, e.clientY - rect.top);
      if (tile && this.onClickTile) this.onClickTile(tile.x, tile.y);
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY * 0.012);
    }, { passive: false });

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.resize();

  /** Луч -> клетка карты */
  private pickTile(mx: number, my: number): { x: number; y: number } | null {
    const ndc = new THREE.Vector2(
      (mx / this.renderer.domElement.clientWidth) * 2 - 1,
      -(my / this.renderer.domElement.clientHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    const gx = Math.round(p.x / TILE) + 7;
    const gy = Math.round(p.z / TILE) + 7;
    if (!this.state) return null;
    if (gx < 0 || gy < 0 || gx >= this.state.mapW || gy >= this.state.mapH) return null;
    return { x: gx, y: gy };
  }

  private setHover(tile: { x: number; y: number } | null): void {
    this.hoverTile = tile;
    if (!tile) {
      this.hoverRing.visible = false;
      return;
    }
    const h = TILE_H[this.state?.tiles[tile.y]?.[tile.x] ?? 'plain'];
    this.hoverRing.visible = true;
    this.hoverRing.position.set(worldX(tile.x), h + 0.03, worldZ(tile.y));
  }

  /** Экранные координаты клетки — для HTML-оверлея (HP-бары) */
  projectTile(x: number, y: number, heightOffset = 1.1): { left: number; top: number; visible: boolean } {
    const v = new THREE.Vector3(worldX(x), heightOffset, worldZ(y)).project(this.camera);
    return {
      left: (v.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth,
      top: (-v.y * 0.5 + 0.5) * this.renderer.domElement.clientHeight,
      visible: v.z < 1,
    };
  }

  /** Центрировать камеру на клетке */
  focusOn(x: number, y: number): void {
    this.camTarget.x = worldX(x);
    this.camTarget.z = worldZ(y);
    this.updateCameraPosition();
  }

  // ---------- Цикл ----------

  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const now = performance.now() / 1000;
    const dt = Math.min(now - (this.lastTime || now), 0.05);
    this.lastTime = now;
    this.elapsed += dt;
    const time = this.elapsed;

    // Анимации перемещения
    for (let i = this.moveAnims.length - 1; i >= 0; i--) {
      const a = this.moveAnims[i];
      const v = this.visuals.get(a.unitId);
      if (!v) { this.moveAnims.splice(i, 1); continue; }
      const from = a.points[a.seg];
      const to = a.points[a.seg + 1];
      if (!to) { this.moveAnims.splice(i, 1); continue; }
      const segLen = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) || 1;
      a.t += dt * a.speed / segLen;
      if (a.t >= 1) {
        v.x = to.x;
        v.y = to.y;
        a.seg++;
        a.t = 0;
        this.onStepSound?.();
        if (a.seg >= a.points.length - 1) this.moveAnims.splice(i, 1);
      } else {
        v.x = from.x + (to.x - from.x) * a.t;
        v.y = from.y + (to.y - from.y) * a.t;
      }
    }

    // Обновляем матрицы юнитов (только позиция визуальная)
    if (this.state) {
      let n = 0;
      for (const u of this.state.units) {
        const v = this.visuals.get(u.id);
        if (!v) continue;
        const bob = this.moveAnims.some((a) => a.unitId === u.id)
          ? Math.abs(Math.sin(time * 14)) * 0.12
          : 0;
        this.dummy.position.set(worldX(v.x), 0.55 + bob, worldZ(v.y));
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.unitMesh.setMatrixAt(n, this.dummy.matrix);
        n++;
      }
      this.unitMesh.instanceMatrix.needsUpdate = true;
    }

    // Пульсация кольца выделения
    if (this.selectionRing.visible) {
      const s = 1 + Math.sin(time * 4) * 0.08;
      this.selectionRing.scale.set(s, 1, s);
      this.selectionRing.rotation.y = time * 1.2;
    }

    // Вспышки
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      const k = b.t / b.dur;
      if (k >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const s = 1 + k * (b.kind === 'capture' ? 3.2 : 1.6);
      b.mesh.scale.set(s, 1, s);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }

    // Плавное покачивание флагов
    for (const flag of this.cityFlags.values()) {
      flag.rotation.y = Math.sin(time * 2 + flag.position.x) * 0.25;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
