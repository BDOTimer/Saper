// render/units-view.js
import * as THREE from 'three';
import { TILE } from './renderer.js';
import { UNIT_TYPES } from '../core/units.js';

/* =========================================================
   РЕЕСТР НАБОРОВ (скинов) для юнитов.
   Каждый скин — функция, возвращающая THREE.Group для типа юнита.
   По умолчанию используется 'default' для всех игроков.
   ========================================================= */
export const UNIT_SKINS = {
  default: {
    label: 'Базовый',
    // (typeKey, colorHex) -> THREE.Group
    build(typeKey, colorHex) {
      return buildGenericUnit(typeKey, colorHex);
    },
  },

  // --- заготовки на будущее ---
  // Игрок 1..8 могут получить собственные скины, например:
  // 'imperial', 'barbarian', 'undead', 'elven',
  // 'dwarven', 'orcish', 'draconic', 'shadow'.
  // Сейчас все ссылаются на default; позже заменятся реализациями.
  imperial:  { label: 'Империя',  build: (t,c) => buildGenericUnit(t,c) },
  barbarian: { label: 'Варвары',  build: (t,c) => buildGenericUnit(t,c) },
  undead:    { label: 'Нежить',   build: (t,c) => buildGenericUnit(t,c) },
  elven:     { label: 'Эльфы',    build: (t,c) => buildGenericUnit(t,c) },
  dwarven:   { label: 'Гномы',    build: (t,c) => buildGenericUnit(t,c) },
  orcish:    { label: 'Орки',     build: (t,c) => buildGenericUnit(t,c) },
  draconic:  { label: 'Драконы',  build: (t,c) => buildGenericUnit(t,c) },
  shadow:    { label: 'Тени',     build: (t,c) => buildGenericUnit(t,c) },
};

/**
 * Карта «игрок → скин». По умолчанию все на 'default'.
 * Чтобы дать игроку свой скин, просто допишите в этот объект:
 *   PLAYER_SKIN_MAP[0] = 'imperial';
 */
export const PLAYER_SKIN_MAP = {
  0: 'default', 1: 'default', 2: 'default', 3: 'default',
  4: 'default', 5: 'default', 6: 'default', 7: 'default',
};

export function skinForPlayer(idOwner) {
  const key = PLAYER_SKIN_MAP[idOwner] ?? 'default';
  return UNIT_SKINS[key] ?? UNIT_SKINS.default;
}

/* =========================================================
   Базовый «универсальный» юнит.
   Форма зависит от типа: пехота/стрелки/кавалерия/магия/осада/дракон/герой.
   ========================================================= */
function buildGenericUnit(typeKey, colorHex) {
  const g = new THREE.Group();
  const color = new THREE.Color(colorHex);

  const matBody  = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const matDark  = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.9 });
  const matLight = new THREE.MeshStandardMaterial({ color: 0xe6dbb8, roughness: 0.85 });
  const matGold  = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4, emissive: 0x3a2a10, emissiveIntensity: 0.25 });

  const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  switch (typeKey) {
    /* --- Пехота --- */
    case 'LIGHT_INF':
    case 'MEDIUM_INF':
    case 'HEAVY_INF': {
      const h = typeKey === 'HEAVY_INF' ? 0.7 : typeKey === 'MEDIUM_INF' ? 0.6 : 0.5;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 8), matBody);
      put(body, 0, 0.15 + h / 2, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), matLight);
      put(head, 0, 0.15 + h + 0.12, 0);
      // копьё
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), matDark);
      put(spear, 0.18, 0.55, 0);
      break;
    }

    /* --- Стрелки --- */
    case 'ARCHERS':
    case 'CROSSBOW': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.55, 8), matBody);
      put(body, 0, 0.4, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), matLight);
      put(head, 0, 0.75, 0);
      // лук — тор
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 14, Math.PI), matGold);
      bow.rotation.z = -Math.PI / 2;
      put(bow, 0.22, 0.55, 0);
      break;
    }

    /* --- Кавалерия --- */
    case 'LIGHT_CAV':
    case 'HEAVY_CAV': {
      const horse = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.22), matBody);
      put(horse, 0, 0.32, 0);
      const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.45, 8), matDark);
      put(rider, 0, 0.68, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), matLight);
      put(head, 0, 0.95, 0);
      break;
    }

    /* --- Магия --- */
    case 'MAGE': {
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), matBody);
      put(robe, 0, 0.5, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), matLight);
      put(head, 0, 0.92, 0);
      // посох
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), matDark);
      put(staff, 0.2, 0.55, 0);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), matGold);
      put(orb, 0.2, 1.05, 0);
      break;
    }

    /* --- Осадные --- */
    case 'CATAPULT': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.35), matDark);
      put(base, 0, 0.22, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), matBody);
      arm.rotation.z = -0.5;
      put(arm, 0, 0.5, 0);
      break;
    }

    /* --- Дракон --- */
    case 'DRAGON': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), matBody);
      put(body, 0, 0.45, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), matBody);
      put(head, 0.2, 0.65, 0);
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 4), matDark);
      wing.rotation.z = Math.PI / 2;
      put(wing, 0, 0.6, 0);
      break;
    }

    /* --- Герой --- */
    case 'HERO': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.6, 8), matBody);
      put(body, 0, 0.45, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), matLight);
      put(head, 0, 0.85, 0);
      // корона
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 5), matGold);
      put(crown, 0, 1.0, 0);
      break;
    }

    default: {
      // fallback — куб
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), matBody);
      put(cube, 0, 0.35, 0);
    }
  }

  return g;
}

/* =========================================================
   UnitsView — слой отрисовки армий поверх карты.
   Живёт внутри сцены MapView; карту не рисует, только армии.
   ========================================================= */
export class UnitsView {
  /**
   * @param {MapView} mapView    — для world, scene и координат (_worldX/_worldY/_worldZ)
   * @param {Object} [opts]
   * @param {Function} [opts.getArmies]    — () => Army[]  (если не указан, берём mapView.game.armies)
   * @param {Function} [opts.getPlayers]   — () => Players
   */
  constructor(mapView, opts = {}) {
    this.mapView = mapView;
    this.scene   = mapView.scene;

    this.getArmies  = opts.getArmies  ?? (() => this.mapView.armies ?? []);
    this.getPlayers = opts.getPlayers ?? (() => this.mapView.players ?? null);

    this.group = new THREE.Group();
    this.group.name = 'UnitsLayer';
    this.scene.add(this.group);

    // реестр бейджей (спрайты) — пересоздаются при rebuild
    this._armyNodes = [];     // { army, root, badge, hpBar? }
  }

  /* ---------- публичный API ---------- */
  rebuild() {
    this.clear();
    const armies = this.getArmies() || [];
    for (const army of armies) {
      if (!army.alive) continue;
      const node = this._buildArmyNode(army);
      if (!node) continue;
      this._armyNodes.push(node);
      this.group.add(node.root);
    }
  }

  /** Точечное обновление позиции без полного rebuild (на каждый шаг армии) */
  updateArmyPosition(army) {
    const node = this._armyNodes.find(n => n.army === army);
    if (!node) return;
    this._placeAt(node.root, army.x, army.y);
  }

  /** Пересобрать один узел (например, после боя — состав/сила поменялись) */
  updateArmy(army) {
    const idx = this._armyNodes.findIndex(n => n.army === army);
    if (idx === -1) {
      // появилась новая армия
      const node = this._buildArmyNode(army);
      if (!node) return;
      this._armyNodes.push(node);
      this.group.add(node.root);
      return;
    }
    // пересобрать существующую
    const old = this._armyNodes[idx];
    this.group.remove(old.root);
    disposeTree(old.root);
    const node = this._buildArmyNode(army);
    if (!node) {
      this._armyNodes.splice(idx, 1);
      return;
    }
    this._armyNodes[idx] = node;
    this.group.add(node.root);
  }

  removeArmy(army) {
    const idx = this._armyNodes.findIndex(n => n.army === army);
    if (idx === -1) return;
    const node = this._armyNodes[idx];
    this.group.remove(node.root);
    disposeTree(node.root);
    this._armyNodes.splice(idx, 1);
  }

  /** Подсветка выбранной армии (рамка вокруг стека) */
  setSelected(army) {
    for (const n of this._armyNodes) {
      n.selRing.visible = (n.army === army);
    }
  }

  /** Подсветка армий игрока, чей сейчас ход */
  setActiveOwner(idOwner) {
    for (const n of this._armyNodes) {
      const isActive = n.army.idOwner === idOwner;
      n.root.visible = true;   // всех рисуем; при желании можно приглушать
      n.root.traverse(o => {
        if (o.isMesh && o.material && o.material.emissive !== undefined) {
          // лёгкая подсветка активного игрока
          const base = o.userData._baseEmissive ?? 0x000000;
          if (!o.userData._baseEmissive) o.userData._baseEmissive = o.material.emissive.getHex();
          o.material.emissive.setHex(isActive ? 0x223344 : o.userData._baseEmissive);
        }
      });
    }
  }

  clear() {
    for (const n of this._armyNodes) {
      this.group.remove(n.root);
      disposeTree(n.root);
    }
    this._armyNodes.length = 0;
  }

  destroy() {
    this.clear();
    this.scene.remove(this.group);
  }

  /* ---------- построение одного узла армии ---------- */
  _buildArmyNode(army) {
    if (!army || !army.units?.length) return null;

    // 1) определяем скин по владельцу
    const players = this.getPlayers();
    const player  = players?.get?.(army.idOwner) ?? players?.list?.[army.idOwner];
    const colorHex = player?.color ?? 0x9aa4ad;
    const skin = skinForPlayer(army.idOwner);

    // 2) берём «лучшего» юнита стека для отображения
    const top = army.strongest;
    if (!top) return null;

    // 3) строим меш юнита
    const unitMesh = skin.build(top.typeKey, colorHex);
    unitMesh.userData = { type: 'army', army };

    // 4) бейдж с количеством юнитов в стеке
    const badge = this._makeBadge(army.count, army.totalStrength);

    // 5) кольцо выбора (скрыто по умолчанию)
    const ringGeo = new THREE.RingGeometry(TILE * 0.4, TILE * 0.46, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const selRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 })
    );
    selRing.visible = false;
    selRing.position.y = 0.05;

    // 6) контейнер
    const root = new THREE.Group();
    root.add(unitMesh);
    root.add(badge);
    root.add(selRing);
    root.userData = { type: 'army', army };

    this._placeAt(root, army.x, army.y);

    return { army, root, badge, selRing };
  }

  _placeAt(root, x, y) {
    const wx = this.mapView._worldX(x);
    const wz = this.mapView._worldZ(y);
    const cell = this.mapView.world.get(x, y);
    const wy = cell ? this.mapView._worldY(cell) : 0.15;
    root.position.set(wx, wy, wz);

    // бейдж чуть выше модели юнита
    const badge = root.children.find(c => c.isSprite);
    if (badge) badge.position.y = 1.35;
    // кольцо — на уровне земли
    const ring = root.children.find(c => c.isMesh && c.geometry?.type === 'RingGeometry');
    if (ring) ring.position.y = 0.05;
  }

  _makeBadge(count, strength) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 48;
    const ctx = canvas.getContext('2d');

    // фон
    ctx.fillStyle = 'rgba(10,14,18,0.85)';
    roundRect(ctx, 2, 2, 124, 44, 10); ctx.fill();
    // рамка
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    roundRect(ctx, 2, 2, 124, 44, 10); ctx.stroke();

    // текст: «×N» и сила
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${count}`, 12, 26);

    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${strength}`, 116, 26);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.0, 0.375, 1);
    spr.position.y = 1.35;
    return spr;
  }
}

/* =========================================================
   Утилиты
   ========================================================= */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function disposeTree(obj) {
  obj.traverse?.(o => {
    o.geometry?.dispose?.();
    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
    else o.material?.dispose?.();
    if (o.material?.map) o.material.map.dispose?.();
  });
}