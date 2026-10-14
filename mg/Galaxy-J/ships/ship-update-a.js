// TODO: ...
// ship-update-a.js
// 
// Дизайн такой:
//  - Оверлей-плашка по клавише 'P'
//  - Список имеющихся систем, который уже можно апгрейдить.
//  - name, upgradeLevel

const DataShipUpgrades = [
  {
    name: "Термозащита Mk.I",
    description: "Повышает устойчивость обшивки к нагреву при входе в атмосферу, снижает риск повреждений.",
    basePrice:  1200,
    upgradeLevel : 1,
    totalUpgrades: 5,
    value        : 12,
    upgradeValue: "+12% к сопротивлению термическим повреждениям"
  },
  {
    name: "Топливные баки Mk.I",
    description: "Увеличивает запас топлива, позволяя дольше оставаться в полёте и совершать более дальние прыжки.",
    basePrice:  2500,
    upgradeLevel : 1,
    totalUpgrades: 6,
    value        : 15,
    upgradeValue: "+15% к объёму топлива"
  },
  {
    name: "Ионный ускоритель Mk.I",
    description: "Добавляет дополнительный импульс за счёт ионной тяги, повышая максимальную скорость челнока.",
    basePrice:  3000,
    upgradeLevel : 1,
    totalUpgrades: 4,
    value        : 8,
    upgradeValue: "+8% к максимальной скорости"
  },
  {
    name: "Автопилот-маневр Mk.I",
    description: "Улучшает точность поворотов и снижает инерцию, делая челнок более отзывчивым в бою и при стыковке.",
    basePrice:  1800,
    upgradeLevel : 1,
    totalUpgrades: 5,
    value        : -12,
    upgradeValue: "-12% к времени поворота на 90°"
  },
  {
    name: "Энергощит Mk.I",
    description: "Генерирует защитный барьер, поглощающий урон; щит постепенно восстанавливается вне боя.",
    basePrice:  4500,
    upgradeLevel : 1,
    totalUpgrades: 5,
    value        :  20,
    upgradeValue: "+20% к прочности щита и +5% к скорости регенерации"
  },
  {
    name: "Сканер дальнего радиуса Mk.I",
    description: "Расширяет радиус сканирования, позволяя раньше обнаруживать астероиды, врагов и точки интереса.",
    basePrice:  2000,
    upgradeLevel : 1,
    totalUpgrades: 4,
    value        :  25,
    upgradeValue: "+25% к радиусу сканирования"
  },
  {
    name: "Носовая броня Mk.I",
    description: "Усиливает переднюю часть челнока, снижая урон от лобовых столкновений и атак.",
    basePrice:  2200,
    upgradeLevel:  1,
    totalUpgrades: 5,
    value        : -15,
    upgradeValue: "-15% к урону, получаемому в носовую часть"
  },
  {
    name: "Гиперпрыжковый модуль Mk.I",
    description: "Позволяет совершать короткие гиперпрыжки для быстрого перемещения между системами.",
    basePrice:  6000,
    upgradeLevel : 1,
    totalUpgrades: 3,
    value        :  30,
    upgradeValue: "+30% к дальности гиперпрыжка, −10% к времени подготовки прыжка"
  },
  {
    name: "Жизнеобеспечение Mk.I",
    description: "Делает системы жизнеобеспечения более устойчивыми к повреждениям и продлевает автономность экипажа.",
    basePrice:  1500,
    upgradeLevel : 1,
    totalUpgrades: 4,
    value        :  20,
    upgradeValue: "+20% к автономности, +10% к устойчивости систем"
  },
  {
    name: "Турель автонаведения Mk.I",
    description: "Автоматическая турель отслеживает и атакует ближайшие угрозы, снижая нагрузку на пилота.",
    basePrice:  3500,
    upgradeLevel : 1,
    totalUpgrades: 4,
    value        :  15,
    upgradeValue: "+15% к точности стрельбы, +10% к скорострельности"
  },
  {
    name: "Энергомодуль Mk.I",
    description: "Увеличивает общую мощность энергосистемы, позволяя одновременно использовать больше модулей и ускоряя перезарядку щитов.",
    basePrice:  5000,
    upgradeLevel : 1,
    totalUpgrades: 4,
    value        :  25,
    upgradeValue: "+25% к выходной мощности реактора"
  },
  {
    name: "Аварийный модуль Mk.I",
    description: "Обеспечивает безопасный выход экипажа при критическом повреждении челнока; повышает шансы на выживание.",
    basePrice:  2800,
    upgradeLevel : 1,
    totalUpgrades: 3,
    value        :  30,
    upgradeValue: "+30% к шансу успешного катапультирования, −5 сек к времени активации"
  }
];


class ShipUpdateA
{

}

window.ShipUpdateA = ShipUpdateA;