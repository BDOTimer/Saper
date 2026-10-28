/**
 * Warlords II — MVP Prototype
 * Общие типы игрового домена. Чистая логика, без зависимости от Three.js/React.
 */

export type TerrainType = 'plain' | 'forest' | 'mountain' | 'water';

export type FactionId = 0 | 1; // 0 = игрок, 1 = ИИ

export const NEUTRAL = -1 as const;
export type OwnerId = FactionId | -1;

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
}

export interface Unit {
  id: number;
  owner: OwnerId;
  x: number;
  y: number;
  type: UnitType;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  /** Максимум очков движения за ход */
  moveRange: number;
  /** Остаток очков движения в текущем ходу */
  mpLeft: number;
  /** Уже атаковал в этом ходу */
  attacked: boolean;
  /** Количество побед (для ветерина) */
  kills: number;
}

export type UnitType = 'infantry';

export interface UnitTypeSpec {
  name: string;
  hp: number;
  attack: number;
  defense: number;
  moveRange: number;
  attackRange: number;
  hireCostTurns: number;
}

export const UNIT_SPECS: Record<UnitType, UnitTypeSpec> = {
  infantry: {
    name: 'Пехота',
    hp: 20,
    attack: 6,
    defense: 4,
    moveRange: 3,
    attackRange: 1,
    hireCostTurns: 2,
  },
};

export interface City {
  id: number;
  name: string;
  x: number;
  y: number;
  owner: OwnerId; // NEUTRAL для нейтральных
  /** Прогресс найма (ходы) */
  hireProgress: number;
  /** Ходов до возможности найма */
  hireCooldown: number;
}

export interface LogEntry {
  turn: number;
  text: string;
  kind: 'info' | 'combat' | 'city' | 'system';
}

export interface GameState {
  seed: number;
  mapW: number;
  mapH: number;
  turn: number;
  current: FactionId;
  tiles: TerrainType[][]; // [y][x]
  units: Unit[];
  cities: City[];
  log: LogEntry[];
  /** id победителя, null — игра идёт */
  winner: OwnerId | null;
  nextEntityId: number;
  /** Кто стартует первым */
  firstPlayer: FactionId;
}

/** Стоимость входа на клетку по типу местности (для пехоты). Infinity = непроходимо */
export const TERRAIN_MOVE_COST: Record<TerrainType, number> = {
  plain: 1,
  forest: 2,
  mountain: 3,
  water: Infinity,
};

/** Бонус защиты местности (доля) */
export const TERRAIN_DEFENSE_BONUS: Record<TerrainType, number> = {
  plain: 0,
  forest: 0.25,
  mountain: 0.5,
  water: 0,
};

/** Городской бонус защиты */
export const CITY_DEFENSE_BONUS = 0.25;

export const RU = {
  player: 'Игрок',
  ai: 'Кровавый Легион',
  faction: ['Алый Рассвет', 'Кровавый Легион'] as string[],
};

export const CITY_NAMES = [
  'Штормград', 'Кельн', 'Аргхейм', 'Мидгард', 'Вальдхайм',
  'Равенхолл', 'Драконий Утёс', 'Сильваност', 'Кхарн', 'Элдмар',
  'Торвин', 'Гриммхольд',
];
