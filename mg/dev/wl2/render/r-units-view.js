// render/units-view.js
import * as THREE      from 'three';
import { TILE        } from './renderer.js';
import { UNIT_TYPES  } from '../core/units.js';

/**
 * Углы квадрата ячейки (смещения по X/Z в долях TILE) для армий,
 * стоящих в городе. В городе может стоять до 4 армий — каждая на своём углу.
 * Первый угол (юго-восточный) совпадает с прежним одиночным смещением,
 * поэтому одна армия выглядит как раньше.
 */
const CITY_CORNERS = [
  { x:  1, z:  1 },   // юго-восток
  { x: -1, z:  1 },   // юго-запад
  { x:  1, z: -1 },   // северо-восток
  { x: -1, z: -1 },   // северо-запад
];

/** Отступ угла от центра клетки (в долях TILE). */
const CITY_CORNER_OFFSET = 0.32;

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
  const accentHex = color.clone().lerp(new THREE.Color(0xffffff), 0.35).getHex();

  const std = (opts) => new THREE.MeshStandardMaterial(opts);
  const matBody   = std({ color, roughness: 0.75 });
  const matAccent = std({ color: accentHex, roughness: 0.65 });
  const matShade  = std({ color: color.clone().lerp(new THREE.Color(0x000000), 0.5), roughness: 0.9 });
  const matSkin   = std({ color: 0xe8b98f, roughness: 0.9 });
  const matDark   = std({ color: 0x23272e, roughness: 0.85, metalness: 0.2 });
  const matMetal  = std({ color: 0xb8c0c8, roughness: 0.35, metalness: 0.7 });
  const matGold   = std({ color: 0xffd166, roughness: 0.35, metalness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.3 });
  const matWood   = std({ color: 0x8a5a33, roughness: 0.9 });

  // мягкая тень-подложка «приземляет» фигурку
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(0.3, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.02;
  g.add(shadow);

  // add(geo, mat, x, y, z, rx, ry, rz)
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };

  // общий всадник (для кавалерии)
  const buildRider = (y) => {
    add(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), matShade, 0, y + 0.1, 0);      // ноги
    add(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 8), matAccent, 0, y + 0.34, 0);   // торс
    add(new THREE.TorusGeometry(0.115, 0.02, 6, 12), matGold, 0, y + 0.44, 0, Math.PI / 2); // поясная пряжка
    add(new THREE.SphereGeometry(0.085, 10, 10), matSkin, 0, y + 0.56, 0);            // голова
    add(new THREE.SphereGeometry(0.092, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2), matMetal, 0, y + 0.57, 0); // шлем
  };

  switch (typeKey) {
    /* --- Пехота --- */
    case 'LIGHT_INF':
    case 'MEDIUM_INF':
    case 'HEAVY_INF': {
      const heavy = typeKey === 'HEAVY_INF';
      const mid   = typeKey === 'MEDIUM_INF';

      // ноги
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 6), matShade, -0.07, 0.13, 0);
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 6), matShade,  0.07, 0.13, 0);
      // торс — трапецией (шире у плеч)
      add(new THREE.CylinderGeometry(0.14, 0.17 * (heavy ? 1.1 : 1), 0.34, 8), matBody, 0, 0.44, 0);
      // наплечники
      const padR = heavy ? 0.075 : 0.06;
      add(new THREE.SphereGeometry(padR, 8, 8), matMetal, -0.15, 0.56, 0);
      add(new THREE.SphereGeometry(padR, 8, 8), matMetal,  0.15, 0.56, 0);
      // золотой пояс
      add(new THREE.TorusGeometry(0.155, 0.018, 6, 12), matGold, 0, 0.35, 0, Math.PI / 2);
      // голова + шлем-купол с козырьком
      add(new THREE.SphereGeometry(0.095, 10, 10), matSkin, 0, 0.66, 0);
      add(new THREE.SphereGeometry(0.105, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2), matMetal, 0, 0.67, 0);
      if (mid || heavy) add(new THREE.TorusGeometry(0.1, 0.016, 6, 14), matMetal, 0, 0.645, 0, Math.PI / 2);
      if (heavy) add(new THREE.ConeGeometry(0.035, 0.14, 6), matAccent, 0, 0.85, 0); // плюмаж
      // щит в левой руке
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.028, 14), matAccent, -0.2, 0.42, 0.02, Math.PI / 2, 0, 0.3);
      add(new THREE.SphereGeometry(0.035, 8, 8), matGold, -0.235, 0.42, 0.02);      // умбон
      // копьё
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6), matWood, 0.19, 0.48, 0);
      add(new THREE.ConeGeometry(0.035, 0.12, 6), matMetal, 0.19, 1.0, 0);
      break;
    }

    /* --- Стрелки --- */
    case 'ARCHERS':
    case 'CROSSBOW': {
      // ноги
      add(new THREE.CylinderGeometry(0.04, 0.048, 0.24, 6), matShade, -0.065, 0.12, 0);
      add(new THREE.CylinderGeometry(0.04, 0.048, 0.24, 6), matShade,  0.065, 0.12, 0);
      // торс в тунике
      add(new THREE.CylinderGeometry(0.125, 0.15, 0.32, 8), matAccent, 0, 0.41, 0);
      add(new THREE.TorusGeometry(0.13, 0.02, 6, 12), matWood, 0, 0.3, 0, Math.PI / 2); // ремень
      // капюшон вместо шлема
      add(new THREE.SphereGeometry(0.095, 10, 10), matSkin, 0, 0.65, 0);
      add(new THREE.SphereGeometry(0.105, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), matBody, 0, 0.64, 0);
      // колчан за спиной
      add(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 6), matWood, -0.12, 0.52, -0.09, -0.25);
      add(new THREE.ConeGeometry(0.012, 0.16, 5), matDark, -0.1, 0.7, -0.11, -0.25);
      add(new THREE.ConeGeometry(0.012, 0.16, 5), matDark, -0.13, 0.7, -0.09, -0.25);
      // лук — дуга + тетива
      const bow = add(new THREE.TorusGeometry(0.19, 0.018, 6, 16, Math.PI), matWood, 0.21, 0.5, 0.02, 0, 0, -Math.PI / 2);
      bow.rotation.y = 0.2;
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.38, 4), matDark, 0.21, 0.5, 0.05);
      break;
    }

    /* --- Кавалерия --- */
    case 'LIGHT_CAV':
    case 'HEAVY_CAV': {
      const heavy = typeKey === 'HEAVY_CAV';
      // корпус коня — капсула из сферы с масштабом
      const horseBody = add(new THREE.SphereGeometry(0.19, 12, 10), heavy ? matAccent : matBody, 0, 0.38, 0);
      horseBody.scale.set(1.05, 0.75, 2.1);
      // шея и голова
      add(new THREE.CylinderGeometry(0.07, 0.12, 0.3, 8), heavy ? matShade : matShade, 0, 0.52, 0.28, -0.6);
      add(new THREE.SphereGeometry(0.085, 8, 8), heavy ? matShade : matShade, 0, 0.63, 0.4);
      add(new THREE.BoxGeometry(0.07, 0.06, 0.14), heavy ? matShade : matShade, 0, 0.6, 0.5);
      // уши
      add(new THREE.ConeGeometry(0.025, 0.07, 5), heavy ? matShade : matShade, -0.04, 0.71, 0.4);
      add(new THREE.ConeGeometry(0.025, 0.07, 5), heavy ? matShade : matShade,  0.04, 0.71, 0.4);
      // грива
      add(new THREE.BoxGeometry(0.05, 0.24, 0.2), matDark, 0, 0.6, 0.24, -0.5);
      // хвост
      add(new THREE.ConeGeometry(0.045, 0.28, 6), matDark, 0, 0.34, -0.42, 0.5);
      // ноги (4)
      const hx = 0.09, hz = 0.17;
      add(new THREE.CylinderGeometry(0.032, 0.028, 0.28, 6), matShade, -hx, 0.14,  hz);
      add(new THREE.CylinderGeometry(0.032, 0.028, 0.28, 6), matShade,  hx, 0.14,  hz);
      add(new THREE.CylinderGeometry(0.032, 0.028, 0.28, 6), matShade, -hx, 0.14, -hz);
      add(new THREE.CylinderGeometry(0.032, 0.028, 0.28, 6), matShade,  hx, 0.14, -hz);
      // чепрак (седло)
      add(new THREE.BoxGeometry(0.18, 0.05, 0.26), heavy ? matGold : matAccent, 0, 0.56, -0.03);
      // всадник
      buildRider(0.55);
      // пика с вымпелом
      add(new THREE.CylinderGeometry(0.016, 0.016, 1.0, 6), matWood, 0.16, 0.85, 0.12, 0, 0, -0.15);
      add(new THREE.ConeGeometry(0.03, 0.1, 6), matMetal, 0.085, 1.32, 0.12);
      // попона-флаг на пике
      add(new THREE.BoxGeometry(0.005, 0.16, 0.12), heavy ? matGold : matAccent, 0.13, 1.0, 0.06);
      break;
    }

    /* --- Магия --- */
    case 'MAGE': {
      // мантия — конус с аметистовым поясом
      add(new THREE.ConeGeometry(0.23, 0.78, 10), matBody, 0, 0.5, 0);
      add(new THREE.TorusGeometry(0.12, 0.02, 6, 12), matGold, 0, 0.38, 0, Math.PI / 2); // пояс на талии конуса
      // воротник-мех
      add(new THREE.TorusGeometry(0.09, 0.03, 6, 12), matAccent, 0, 0.78, 0, Math.PI / 2);
      add(new THREE.SphereGeometry(0.09, 10, 10), matSkin, 0, 0.9, 0);
      // колпак-конус с золотой звездой
      add(new THREE.ConeGeometry(0.16, 0.34, 10), matAccent, 0, 1.0, 0);
      add(new THREE.TorusGeometry(0.17, 0.018, 6, 14), matGold, 0, 0.86, 0, Math.PI / 2); // поля
      // посох
      add(new THREE.CylinderGeometry(0.02, 0.025, 1.0, 6), matWood, 0.21, 0.6, 0, 0, 0, 0.08);
      add(new THREE.TorusGeometry(0.055, 0.014, 6, 12), matGold, 0.225, 1.13, -0.02);
      add(new THREE.SphereGeometry(0.055, 10, 10),
        std({ color: 0x9ad8ff, roughness: 0.2, emissive: 0x3366aa, emissiveIntensity: 0.9 }),
        0.225, 1.13, -0.02);
      break;
    }

    /* --- Осадные --- */
    case 'CATAPULT': {
      // деревянная площадка
      add(new THREE.BoxGeometry(0.55, 0.08, 0.4), matWood, 0, 0.12, 0);
      // колёса (4) — оси вдоль X
      const wy = 0.1;
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 10), matDark, -0.28, wy, -0.19, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 10), matDark,  0.28, wy, -0.19, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 10), matDark, -0.28, wy,  0.19, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 10), matDark,  0.28, wy,  0.19, 0, 0, Math.PI / 2);
      // боковые стойки A-образные
      add(new THREE.BoxGeometry(0.06, 0.5, 0.06), matWood,  0.12, 0.38, -0.12, 0, 0, 0.2);
      add(new THREE.BoxGeometry(0.06, 0.5, 0.06), matWood,  0.12, 0.38,  0.12, 0, 0, 0.2);
      // метательная балка: длинное плечо задрано, короткое с противовесом
      add(new THREE.BoxGeometry(0.07, 0.09, 0.95), matWood, 0.12, 0.62, -0.18, 0, 0, -0.55);
      // противовес
      add(new THREE.BoxGeometry(0.16, 0.16, 0.16), matDark, 0.12, 0.35, -0.48);
      // крюк и камень на снарядной стороне
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 6), matMetal, 0.12, 0.98, 0.32, 0, 0, 2.6);
      add(new THREE.SphereGeometry(0.09, 10, 10), matShade, 0.12, 1.05, 0.34); // булыжник
      break;
    }

    /* --- Дракон --- */
    case 'DRAGON': {
      // Классический дракон: вытянутое тело, S-образная шея, рогатая
      // голова с пастью и клыками, широкие перепончатые крылья,
      // четыре лапы с когтями, длинный хвост со спинными шипами
      // и наконечником-острием.

      const matBelly = std({ color: accentHex, roughness: 0.82 });
      const matBone  = std({ color: 0xe9dcc2, roughness: 0.55 });
      const matClaw  = std({ color: 0x2c2c30, roughness: 0.45, metalness: 0.15 });
      const matEye   = std({
        color: 0xffd24a, emissive: 0xff5a00,
        emissiveIntensity: 1.4, roughness: 0.25,
      });
      const matWing = std({
        color: color.clone().lerp(new THREE.Color(0x120a14), 0.35),
        roughness: 0.62, metalness: 0.05,
        side: THREE.DoubleSide, transparent: true, opacity: 0.92,
        emissive: color.clone().multiplyScalar(0.18),
        emissiveIntensity: 0.35,
      });

      const UP = new THREE.Vector3(0, 1, 0);
      const V = (x, y, z) => new THREE.Vector3(x, y, z);

      // Сегмент-конус между двумя точками (шея, хвост, лапы, кости крыльев).
      const segment = (parent, a, b, r1, r2, mat, seg = 6) => {
        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length();
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(r2, r1, len, seg, 1), mat);
        m.position.copy(a).addScaledVector(dir, 0.5);
        m.quaternion.setFromUnitVectors(UP, dir.normalize());
        parent.add(m);
        return m;
      };

      // Эллипсоид — тело, суставы, голова.
      const blob = (x, y, z, sx, sy, sz, mat, seg = 10) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(1, seg, Math.max(6, seg - 2)), mat);
        m.position.set(x, y, z);
        m.scale.set(sx, sy, sz);
        g.add(m);
        return m;
      };

      // ── тело ──────────────────────────────────────────────
      blob(0, 0.44, 0.04, 0.27, 0.23, 0.40, matBody, 12);
      blob(0, 0.49, 0.25, 0.24, 0.21, 0.20, matBody, 10);   // грудь
      blob(0, 0.42, -0.23, 0.23, 0.20, 0.24, matBody, 10);  // таз
      blob(0, 0.31, 0.02, 0.19, 0.09, 0.33, matBelly, 10);  // брюхо

      // ── шея ──────────────────────────────────────────────
      const neck = [
        [V(0, 0.56, 0.28), V(0, 0.68, 0.36), 0.115, 0.095],
        [V(0, 0.68, 0.36), V(0, 0.80, 0.43), 0.095, 0.080],
        [V(0, 0.80, 0.43), V(0, 0.88, 0.51), 0.080, 0.068],
      ];
      for (const [a, b, r1, r2] of neck) segment(g, a, b, r1, r2, matBody, 8);
      blob(0, 0.68, 0.36, 0.095, 0.095, 0.095, matBody, 8);
      blob(0, 0.80, 0.43, 0.080, 0.080, 0.080, matBody, 8);

      // ── голова ────────────────────────────────────────────
      blob(0, 0.90, 0.58, 0.115, 0.100, 0.135, matBody, 12); // череп
      add(new THREE.BoxGeometry(0.145, 0.075, 0.19), matBody, 0, 0.865, 0.70, 0.06, 0, 0);
      add(new THREE.BoxGeometry(0.120, 0.045, 0.16), matShade, 0, 0.795, 0.69, -0.05, 0, 0);
      blob(0, 0.88, 0.80, 0.055, 0.035, 0.035, matBody, 8);  // кончик носа
      // хищные надбровья
      add(new THREE.BoxGeometry(0.075, 0.026, 0.11), matShade, -0.075, 0.965, 0.63, -0.2,  0.15, 0);
      add(new THREE.BoxGeometry(0.075, 0.026, 0.11), matShade,  0.075, 0.965, 0.63, -0.2, -0.15, 0);
      // светящиеся глаза
      blob(-0.095, 0.935, 0.645, 0.030, 0.022, 0.018, matEye, 8);
      blob( 0.095, 0.935, 0.645, 0.030, 0.022, 0.018, matEye, 8);
      // ноздри
      blob(-0.032, 0.895, 0.805, 0.012, 0.010, 0.010, matClaw, 6);
      blob( 0.032, 0.895, 0.805, 0.012, 0.010, 0.010, matClaw, 6);
      // клыки верхней челюсти
      for (let i = 0; i < 3; i++) {
        for (const s of [-1, 1]) {
          add(new THREE.ConeGeometry(0.012, 0.045, 4), matBone,
              s * 0.052, 0.833, 0.655 + i * 0.045, Math.PI, 0, 0);
        }
      }
      // рога: основная пара назад и вверх + вторая пара и щёчные шипы
      for (const s of [-1, 1]) {
        segment(g, V(s * 0.055, 0.96, 0.56), V(s * 0.130, 1.09, 0.40), 0.035, 0.003, matBone, 6);
        segment(g, V(s * 0.090, 0.915, 0.55), V(s * 0.190, 0.96, 0.43), 0.022, 0.002, matBone, 5);
        segment(g, V(s * 0.100, 0.860, 0.58), V(s * 0.190, 0.81, 0.49), 0.018, 0.002, matBone, 5);
      }

      // ── шипы на хребте ────────────────────────────────────
      const backSpikes = [
        [0.66, 0.30, 0.075], [0.67, 0.20, 0.090], [0.68, 0.10, 0.100],
        [0.675, 0.00, 0.105], [0.66, -0.10, 0.100], [0.635, -0.20, 0.090],
        [0.605, -0.30, 0.080], [0.565, -0.40, 0.070], [0.52, -0.50, 0.055],
      ];
      for (const [y, z, h] of backSpikes) {
        add(new THREE.ConeGeometry(h * 0.42, h, 4), matBone,
            0, y, z, -0.35, Math.PI / 4, 0);
      }

      // ── крылья ────────────────────────────────────────────
      const buildWing = (sign) => {
        const wing = new THREE.Group();
        wing.position.set(sign * 0.17, 0.60, 0.04);
        wing.rotation.y = -sign * 0.15;  // чуть вперёд, чтобы крыло было видно сбоку

        // Контур перепонки в плоскости XZ, с подъёмом к концам.
        const pts = [
          [0.00, 0.00, 0.00],
          [0.10, 0.03, 0.16],
          [0.30, 0.09, 0.24],
          [0.52, 0.17, 0.26],   // первый палец
          [0.42, 0.13, 0.10],
          [0.56, 0.19, 0.02],   // второй палец
          [0.44, 0.12, -0.10],
          [0.50, 0.17, -0.22],  // третий палец
          [0.36, 0.10, -0.16],
          [0.30, 0.07, -0.30],  // четвёртый палец
          [0.18, 0.03, -0.20],
          [0.05, 0.00, -0.10],
        ].map(([x, y, z]) => V(sign * x, y + 0.90 * Math.abs(x), z));

        const pos = [];
        const root = pts[0];
        for (let i = 1; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          pos.push(root.x, root.y, root.z, a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        wing.add(new THREE.Mesh(geo, matWing));

        // Костяные «пальцы» поверх перепонки.
        for (const idx of [3, 5, 7, 9]) {
          segment(wing, root, pts[idx], 0.012, 0.004, matBone, 5);
        }
        // коготь на запястье
        segment(wing, pts[3], pts[3].clone().add(V(sign * 0.03, 0.03, 0.10)),
                0.018, 0.002, matClaw, 5);

        g.add(wing);
      };
      buildWing(1);
      buildWing(-1);

      // ── хвост ─────────────────────────────────────────────
      const tailPts = [
        V(0, 0.42, -0.30),
        V(0, 0.38, -0.44),
        V(0, 0.33, -0.57),
        V(0, 0.27, -0.69),
        V(0, 0.21, -0.79),
        V(0, 0.16, -0.87),
      ];
      const tailR = [0.105, 0.085, 0.065, 0.048, 0.032, 0.018];
      for (let i = 0; i < tailPts.length - 1; i++) {
        segment(g, tailPts[i], tailPts[i + 1], tailR[i], tailR[i + 1], matBody, 8);
      }
      for (let i = 1; i < tailPts.length - 1; i++) {
        const p = tailPts[i], r = tailR[i];
        blob(p.x, p.y, p.z, r, r, r, matBody, 8);
      }
      // наконечник-острие
      const tailEnd = tailPts[tailPts.length - 1];
      const spade = new THREE.Mesh(
        new THREE.ConeGeometry(0.085, 0.20, 4), matWing);
      spade.position.copy(tailEnd).add(V(0, -0.02, -0.10));
      spade.quaternion.setFromUnitVectors(UP, V(0, -0.15, -1).normalize());
      spade.scale.set(1, 1, 0.35);
      g.add(spade);

      // ── четыре лапы с когтями ─────────────────────────────
      const buildLeg = (sign, front) => {
        const hip   = V(sign * (front ? 0.16 : 0.17), 0.42, front ? 0.22 : -0.18);
        const knee  = V(sign * (front ? 0.21 : 0.22), 0.25, front ? 0.27 : -0.10);
        const ankle = V(sign * 0.20, 0.10, front ? 0.33 : -0.19);
        const toe   = V(sign * 0.20, 0.035, front ? 0.41 : -0.10);

        segment(g, hip, knee, 0.070, 0.052, matBody, 7);
        segment(g, knee, ankle, 0.052, 0.038, matShade, 7);
        segment(g, ankle, toe, 0.040, 0.028, matBody, 7);
        blob(knee.x, knee.y, knee.z, 0.055, 0.055, 0.055, matBody, 8);
        blob(ankle.x, ankle.y, ankle.z, 0.040, 0.040, 0.040, matShade, 8);

        for (const dx of [-0.045, 0, 0.045]) {
          const a = V(toe.x + dx * 0.4, 0.035, toe.z);
          const b = V(toe.x + dx, 0.012, toe.z + (front ? 0.07 : 0.06));
          segment(g, a, b, 0.016, 0.002, matClaw, 4);
        }
      };
      buildLeg(-1, true);
      buildLeg(1, true);
      buildLeg(-1, false);
      buildLeg(1, false);

      // Дракон крупнее прочих — увеличиваем тень под ним.
      // Общий масштаб чуть уменьшаем, чтобы размах крыльев не выходил
      // далеко за клетку карты.
      shadow.scale.setScalar(2.6);
      g.scale.setScalar(0.85);
      break;
    }

    /* --- Герой --- */
    case 'HERO': {
      // плащ сзади со сборкой
      const cape = add(new THREE.PlaneGeometry(0.34, 0.5), matShade, 0, 0.42, -0.11, -0.12);
      cape.material = std({ color: color.clone().lerp(new THREE.Color(0x000000), 0.2), roughness: 0.6, side: THREE.DoubleSide });
      cape.rotation.y = -Math.PI / 2;
      // ноги в сапогах и торс
      add(new THREE.CylinderGeometry(0.05, 0.055, 0.28, 6), matDark, -0.075, 0.14, 0);
      add(new THREE.CylinderGeometry(0.05, 0.055, 0.28, 6), matDark,  0.075, 0.14, 0);
      add(new THREE.CylinderGeometry(0.14, 0.16, 0.34, 8), matBody, 0, 0.46, 0);
      // золотая кираса-накладка и наплечники
      add(new THREE.CylinderGeometry(0.148, 0.15, 0.14, 8, 1, true), matGold, 0, 0.5, 0);
      add(new THREE.SphereGeometry(0.08, 8, 8), matGold, -0.16, 0.58, 0);
      add(new THREE.SphereGeometry(0.08, 8, 8), matGold,  0.16, 0.58, 0);
      // голова
      add(new THREE.SphereGeometry(0.1, 10, 10), matSkin, 0, 0.72, 0);
      // корона — обод с четырьмя «шильцами»
      add(new THREE.TorusGeometry(0.095, 0.02, 6, 14), matGold, 0, 0.79, 0, Math.PI / 2);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        add(new THREE.ConeGeometry(0.022, 0.09, 5), matGold, Math.cos(a) * 0.095, 0.85, Math.sin(a) * 0.095);
      }
      // меч в правой руке
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), matDark, 0.22, 0.38, 0.02, 0, 0, 0.15); // рукоять
      add(new THREE.BoxGeometry(0.02, 0.055, 0.035), matGold, 0.235, 0.46, 0.02);                  // гарда
      add(new THREE.BoxGeometry(0.02, 0.42, 0.012), matMetal, 0.24, 0.7, 0.02, 0, 0, 0.15);        // клинок
      break;
    }

    default: {
      // fallback — двухцветный опознавательный столбик
      add(new THREE.CylinderGeometry(0.14, 0.17, 0.36, 8), matBody, 0, 0.3, 0);
      add(new THREE.SphereGeometry(0.11, 10, 10), matAccent, 0, 0.58, 0);
      add(new THREE.TorusGeometry(0.16, 0.02, 6, 12), matGold, 0, 0.14, 0, Math.PI / 2);
      break;
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
    this._placeAt(node.root, army.x, army.y, army);
  }

  /**
   * Переставить все армии клетки по углам.
   * Нужно после входа/выхода армии: при 1 армии она занимает первый угол,
   * при 2 — два первых и т.д. (до 4 армий в городе).
   */
  relayoutCell(x, y) {
    for (const n of this._armyNodes) {
      const a = n.army;
      if (a.x === x && a.y === y) this._placeAt(n.root, x, y, a);
    }
  }

  /** Узел армии (для аниматоров: ArmyMover двигает node.root). */
  getArmyNode(army) {
    return this._armyNodes.find(n => n.army === army) ?? null;
  }

  /**
   * Поставить узел армии в произвольную мировую точку сцены.
   * Используется для ПЛАВНОЙ интерполяции позиции между клетками
   * (каждый кадр из ArmyMover); по завершении шага зовётся
   * updateArmyPosition(), чтобы точно посадить армию в клетку.
   */
  placeArmyAt(army, x, y, z) {
    const node = this.getArmyNode(army);
    if (!node) return;
    node.root.position.set(x, y, z);
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

    // 2) фигурка армии: герой (в любой позиции массива), иначе первый юнит
    const hero = army.units.find(u => u.isHero && u.alive);
    const top  = hero ?? army.units.find(u => u.alive) ?? army.units[0];
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

    this._placeAt(root, army.x, army.y, army);

    return { army, root, badge, selRing };
  }

  _placeAt(root, x, y, army = null) {
    const wx = this.mapView._worldX(x);
    const wz = this.mapView._worldZ(y);
    const cell = this.mapView.world.get(x, y);
    const wy = cell ? this.mapView._worldY(cell) : 0.15;

    // ---- сдвиг, если на клетке город ----
    let ox = 0, oz = 0;
    const city = this.mapView.world.getCityAt?.(x, y);
    if (city) {
      // В городе до 4 армий — каждая на своём углу квадрата ячейки.
      // Индекс армии в клетке задаёт угол; при >4 армиях углы повторяются.
      const idx = Array.isArray(cell?.army) && army
        ? cell.army.indexOf(army)
        : 0;
      const corner = CITY_CORNERS[(idx < 0 ? 0 : idx) % CITY_CORNERS.length];
      const d = TILE * CITY_CORNER_OFFSET;
      ox = corner.x * d;
      oz = corner.z * d;
    }

    root.position.set(wx + ox, wy, wz + oz);

    // бейдж — чуть выше модели юнита (без учёта сдвига, он локальный)
    const badge = root.children.find(c => c.isSprite);
    if (badge) badge.position.y = 1.35;

    // кольцо выбора — на уровне земли, но тоже под сдвиг (в локальных координатах 0)
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

  /* =========================================================
   Маркер клетки — красная 4-гранная пирамидка + основание.
   Всего 5 граней: 4 боковые (треугольники) + 1 днище (квадрат).
   ========================================================= */
  static createCellMarker(size = 0.28, colorHex = 0xff3333) {
    const group = new THREE.Group();

    // Материал общий, чтобы диспоуз был один
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.5,
      metalness: 0.1,
      emissive: 0x330000,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });

    const half = size;      // половина стороны основания
    const height = size * 1.4;

    // ── 4 боковые грани ────────────────────────────────────
    // Вершина (апекс)
    const apex = new THREE.Vector3(0, height, 0);

    // Углы основания (в XZ), порядок по часовой стрелке
    const c = [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3( half, 0, -half),
      new THREE.Vector3( half, 0,  half),
      new THREE.Vector3(-half, 0,  half),
    ];

    const sideGeo = new THREE.BufferGeometry();
    const verts = [];
    const normals = [];

    for (let i = 0; i < 4; i++) {
      const a = c[i];
      const b = c[(i + 1) % 4];

      // треугольник apex-a-b
      verts.push(apex.x, apex.y, apex.z);
      verts.push(a.x,    a.y,    a.z);
      verts.push(b.x,    b.y,    b.z);

      // нормаль грани
      const n = new THREE.Vector3()
        .subVectors(a, apex)
        .cross(new THREE.Vector3().subVectors(b, apex))
        .normalize();

      for (let k = 0; k < 3; k++) normals.push(n.x, n.y, n.z);
    }

    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    sideGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));

    const sides = new THREE.Mesh(sideGeo, mat);
    group.add(sides);

    // ── основание (днище) ──────────────────────────────────
    // Плоский квадрат из двух треугольников
    const baseGeo = new THREE.BufferGeometry();
    const bv = [];
    const bn = [];

    const baseTris = [
      [c[0], c[1], c[2]],
      [c[0], c[2], c[3]],
    ];
    for (const [p1, p2, p3] of baseTris) {
      bv.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      for (let k = 0; k < 3; k++) bn.push(0, -1, 0); // нормаль вниз
    }
    baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3));
    baseGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(bn, 3));

    const base = new THREE.Mesh(baseGeo, mat);
    group.add(base);

    group.userData = { type: 'cell-marker', size, colorHex };
    return group;
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

export function disposeTree(obj) {
  obj.traverse?.(o => {
    o.geometry?.dispose?.();
    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
    else o.material?.dispose?.();
    if (o.material?.map) o.material.map.dispose?.();
  });
}
