Ниже — минимальный, но рабочий пример ECS на C++17, который демонстрирует три главных принципа: **Entity — это просто ID**, **Component — это чистые данные**, **System — это логика, которая обрабатывает сущности с нужным набором компонентов**.

Код компилируется одним файлом, без внешних зависимостей. Я намеренно упростил его (без архетипов и SoA-раскладки, как в энтерпрайз-движках), чтобы были видны сами принципы.

### 📄 Полный код (`ecs_demo.cpp`)

```cpp
#include <iostream>
#include <vector>
#include <unordered_map>
#include <bitset>
#include <cstdint>
#include <algorithm>
#include <cmath>

// ============================================================
// 1. ENTITY — это просто числовой идентификатор. Не класс, не объект.
//    У неё нет ни данных, ни методов.
// ============================================================
using Entity = std::uint32_t;
constexpr Entity NULL_ENTITY = 0;

// ============================================================
// 2. COMPONENT — это "тег" типа + чистые данные.
//    Каждый компонент получает уникальный бит в маске.
//    Здесь мы вручную назначаем ID типам для простоты.
// ============================================================
constexpr std::size_t MAX_COMPONENTS = 8;

// Битовая маска: какие компоненты есть у сущности
using ComponentMask = std::bitset<MAX_COMPONENTS>;

// ID типов компонентов (в реальном движке генерируются автоматически)
constexpr std::size_t POSITION_ID = 0;
constexpr std::size_t VELOCITY_ID = 1;
constexpr std::size_t HEALTH_ID   = 2;

// Сами данные — простые структуры без логики
struct Position { float x, y; };
struct Velocity { float dx, dy; };
struct Health   { int hp; };

// ============================================================
// 3. WORLD — хранилище сущностей и их компонентов.
//    Компоненты лежат в отдельных массивах (по типу),
//    а не внутри "объекта сущности". Это ключевое отличие от ООП.
// ============================================================
class World {
public:
    // Создать новую сущность
    Entity CreateEntity() {
        Entity e = nextEntity_++;
        masks_[e] = ComponentMask{};
        return e;
    }

    // Уничтожить сущность (просто убираем из всех хранилищ)
    void DestroyEntity(Entity e) {
        masks_.erase(e);
        positions_.erase(e);
        velocities_.erase(e);
        healths_.erase(e);
    }

    // --- Добавление компонентов ---
    void AddComponent(Entity e, Position p) {
        positions_[e] = p;
        masks_[e].set(POSITION_ID);
    }
    void AddComponent(Entity e, Velocity v) {
        velocities_[e] = v;
        masks_[e].set(VELOCITY_ID);
    }
    void AddComponent(Entity e, Health h) {
        healths_[e] = h;
        masks_[e].set(HEALTH_ID);
    }

    // --- Получение компонентов ---
    Position* GetPosition(Entity e) {
        auto it = positions_.find(e);
        return it != positions_.end() ? &it->second : nullptr;
    }
    Velocity* GetVelocity(Entity e) {
        auto it = velocities_.find(e);
        return it != velocities_.end() ? &it->second : nullptr;
    }
    Health* GetHealth(Entity e) {
        auto it = healths_.find(e);
        return it != healths_.end() ? &it->second : nullptr;
    }

    // --- Проверка маски (нужна системам) ---
    bool HasComponents(Entity e, ComponentMask required) const {
        auto it = masks_.find(e);
        if (it == masks_.end()) return false;
        // Все требуемые биты должны быть установлены
        return (it->second & required) == required;
    }

    // --- Итерация по всем живым сущностям ---
    template <typename Func>
    void ForEachEntity(Func&& func) {
        for (auto& [entity, mask] : masks_) {
            func(entity);
        }
    }

private:
    Entity nextEntity_ = 1;
    std::unordered_map<Entity, ComponentMask> masks_;

    // Компоненты хранятся раздельно по типам (данные отделены от сущности)
    std::unordered_map<Entity, Position> positions_;
    std::unordered_map<Entity, Velocity> velocities_;
    std::unordered_map<Entity, Health>   healths_;
};

// ============================================================
// 4. SYSTEMS — это чистая логика. Система сама находит сущности
//    с нужным набором компонентов и что-то с ними делает.
//    Сущности ничего не "знают" о системах.
// ============================================================

// Система движения: обрабатывает сущности с Position + Velocity
void MovementSystem(World& world, float dt) {
    // Маска: какие компоненты обязаны быть у сущности
    ComponentMask required;
    required.set(POSITION_ID);
    required.set(VELOCITY_ID);

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, required)) return;

        auto* pos = world.GetPosition(e);
        auto* vel = world.GetVelocity(e);
        pos->x += vel->dx * dt;
        pos->y += vel->dy * dt;
    });
}

// Система здоровья: уменьшает HP и удаляет мёртвых
void HealthSystem(World& world, float dt) {
    ComponentMask required;
    required.set(HEALTH_ID);

    std::vector<Entity> toDestroy;

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, required)) return;

        auto* hp = world.GetHealth(e);
        hp->hp -= static_cast<int>(dt * 10.0f); // теряем 10 HP в секунду

        if (hp->hp <= 0) {
            toDestroy.push_back(e);
        }
    });

    for (Entity e : toDestroy) {
        world.DestroyEntity(e);
    }
}

// Система логирования: выводит состояние сущностей с Position + Health
void LogSystem(World& world) {
    ComponentMask required;
    required.set(POSITION_ID);
    required.set(HEALTH_ID);

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, required)) return;

        auto* pos = world.GetPosition(e);
        auto* hp  = world.GetHealth(e);
        std::cout << "Entity " << e
                  << " | pos=(" << pos->x << ", " << pos->y << ")"
                  << " | hp=" << hp->hp << "\n";
    });
}

// ============================================================
// 5. СБОРКА СЦЕНЫ
// ============================================================
int main() {
    World world;

    // Сущность 1: движется и имеет здоровье
    Entity player = world.CreateEntity();
    world.AddComponent(player, Position{0.0f, 0.0f});
    world.AddComponent(player, Velocity{1.0f, 0.5f});
    world.AddComponent(player, Health{50});

    // Сущность 2: только движется (без здоровья)
    Entity bullet = world.CreateEntity();
    world.AddComponent(bullet, Position{5.0f, 5.0f});
    world.AddComponent(bullet, Velocity{-2.0f, 0.0f});

    // Сущность 3: только здоровье (статичный объект)
    Entity rock = world.CreateEntity();
    world.AddComponent(rock, Position{10.0f, 10.0f});
    world.AddComponent(rock, Health{10});

    std::cout << "=== Initial state ===\n";
    LogSystem(world);

    // Симулируем 3 кадра по 1 секунде
    const float dt = 1.0f;
    for (int frame = 1; frame <= 3; ++frame) {
        std::cout << "\n=== Frame " << frame << " ===\n";

        MovementSystem(world, dt); // двигаем всё, у чего есть Position+Velocity
        HealthSystem(world, dt);   // уменьшаем HP, удаляем мёртвых
        LogSystem(world);          // смотрим результат
    }

    return 0;
}
```

### 🧠 Какие главные принципы ECS здесь видны

**1. Entity — это просто ID.**
`Entity` — это `uint32_t`. У неё нет полей `x`, `hp` или методов `Update()`. Это просто ключ, по которому в `World` лежат компоненты. В ООП-подходе вы бы написали `class Player { float x; int hp; void Update(); }`, и данные были бы жёстко привязаны к типу.

**2. Component — это только данные.**
`Position`, `Velocity`, `Health` — простые структуры без единого метода. Они не знают, как двигаться и как терять HP. Это позволяет хранить их раздельно и обрабатывать пачками.

**3. System — это только логика.**
`MovementSystem` не привязана к «игроку» или «пуле». Она говорит: «дай мне все сущности, у которых есть `Position` и `Velocity`, — и я их подвину». Именно поэтому сущность `bullet` (без `Health`) автоматически попадает в `MovementSystem`, но не в `HealthSystem`, а `rock` — наоборот. **Поведение определяется составом компонентов, а не типом класса.**

**4. Композиция вместо наследования.**
Чтобы сделать «пулю», не нужен класс `Bullet : public EntityBase`. Достаточно создать сущность и навесить на неё нужные компоненты. Хотите, чтобы пуля стала ядовитой? Добавьте ей компонент `Poison` — и новая система `PoisonSystem` её подхватит, не меняя ни одного существующего класса.

**5. Данные отделены от поведения.**
В `World` компоненты лежат в отдельных `unordered_map` по типам, а не внутри «объекта сущности». Это первый шаг к тому, что в промышленных ECS делается через архетипы и SoA-массивы для кэш-дружественности.

### ⚠️ Что здесь упрощено (и как это бывает «по-взрослому»)

Этот пример демонстрирует **принципы**, но не оптимизацию. В реальных ECS (EnTT, flecs, Unity DOTS):

- Вместо `unordered_map<Entity, Position>` используют **плотные массивы** (sparse set / archetype storage), чтобы компоненты лежали подряд в памяти.
- ID типов компонентов генерируются автоматически (через шаблоны и счётчики), а не задаются константами.
- Системы часто оформляются как отдельные классы с `Update()`, а запросы кэшируются.
- Появляются **архетипы**: сущности с одинаковым набором компонентов группируются вместе, что даёт огромный прирост производительности.

Но суть — **ID + чистые данные + отдельная логика, которая фильтрует по маске компонентов** — ровно та же, что и в этом 150-строчном примере.
  
---
  
Хотя ECS (Entity-Component-System) часто превозносят за производительность и гибкость, у него есть вполне конкретные недостатки и «боли», особенно если сравнивать с привычным ООП. Главный из них — **сложность и высокий порог входа**, а также **потеря инкапсуляции** и **усложнение отладки**.

Вот основные недостатки ECS по сравнению с ООП, о которых стоит знать, прежде чем переходить на эту архитектуру.

### 🧠 Сложность и порог входа

Это самый частый аргумент против ECS в командной разработке. ECS — это смена парадигмы. Если разработчики привыкли мыслить объектами («игрок», «враг», «пуля»), то ECS требует мыслить данными и системами.

*   **Сложнее в реализации**: Сама архитектура ECS сложнее в реализации, чем классические игровые объекты .
*   **Долгий онбординг**: Внедрение нового подхода для разработчиков, не знакомых с ECS, может занять много времени и требовать дополнительных ресурсов на обучение .
*   **Когнитивная нагрузка**: Большое количество мелких компонентов и систем создает дополнительную нагрузку на понимание того, как всё работает вместе .

### 🔗 Потеря инкапсуляции и рост связанности

В ООП объект сам управляет своими данными. В ECS данные «голые», и любая система может их изменить.

*   **Нет инкапсуляции**: В ECS инкапсуляция, по сути, отсутствует (и не должна присутствовать). Компоненты — это просто данные, и любая система может их прочитать или записать .
*   **Скрытые зависимости**: Системы сильно зависят от порядка выполнения. Вставка новой системы «между» существующими может быть сложной задачей .
*   **Хрупкость данных**: Поскольку одни и те же компоненты используются множеством систем, изменение структуры компонента может «сломать» сразу несколько систем, которые вы не трогали .

### 🐞 Сложность отладки

Отладить отдельную систему легко, но понять полную картину происходящего с сущностью — сложно.

*   **Нет «глобального взгляда»**: Вы не можете просто открыть объект и посмотреть всё, что с ним происходит. Приходится отслеживать, какие системы и в каком порядке изменяют компоненты этой сущности .
*   **Сложнее отследить изменения**: Отладка изменения одного компонента может быть затруднена, так как нет единого места, где была бы видна вся история изменений сущности .

### 🎯 Ограничения в конкретных движках (например, Unity)

Если говорить о Unity, то там ECS (DOTS) имеет свои специфические ограничения на текущем этапе.

*   **Ограниченная переиспользуемость**: Компоненты в Unity ECS сильно завязаны на классы и жизненный цикл Unity. Их сложнее переиспользовать в другом C#-коде или на других платформах по сравнению с хорошо спроектированными ООП-классами .
*   **Проблемы с интерфейсами**: Использование интерфейсов с компонентами может быть затруднено из-за ограничений сериализации в инспекторе (ситуация улучшается в новых версиях, но всё ещё не идеальна) .

### ⚡ Когда производительность не главное

Преимущества ECS в скорости раскрываются на большом количестве сущностей. Если у вас их мало, разница может быть незаметна.

*   **Нет выигрыша на малых масштабах**: Исследования показывают, что при количестве сущностей до 50 000 разница в производительности между ECS и ООП может быть незначительной. Преимущество ECS начинает проявляться на больших масштабах (например, от 120 000 сущностей) .

### 💎 Итог

ECS — это мощный инструмент, но не серебряная пуля. Его стоит выбирать, когда у вас есть **очень много однотипных сущностей**, и вы готовы **инвестировать время в обучение команды** и проектирование архитектуры. Если же проект небольшой, команда незнакома с ECS, а логика сложна и завязана на взаимодействии объектов, классическое ООП может оказаться более простым и предсказуемым выбором.
  
---
  
## Пули наносят урон игроку)

Чтобы добавить новое поведение (пули наносят урон игроку), **не нужно менять ни один существующий класс**. Достаточно добавить пару компонентов и одну новую систему.

Ниже — обновлённый пример. Я добавил:
- компонент `Collider` (радиус) — чтобы понимать, с чем сталкиваемся;
- компонент `IsPlayer` — тег-компонент (данных нет, важен сам факт наличия);
- компонент `IsBullet` — тег-компонент;
- компонент `Damage` — сколько урона наносит пуля;
- `DamageSystem` — находит пули, которые пересеклись с игроком, и снимает HP.

### 📄 Обновлённый код (`ecs_demo_damage.cpp`)

```cpp
#include <iostream>
#include <vector>
#include <unordered_map>
#include <bitset>
#include <cstdint>
#include <algorithm>
#include <cmath>

// ============================================================
// 1. ENTITY — просто ID
// ============================================================
using Entity = std::uint32_t;
constexpr Entity NULL_ENTITY = 0;

// ============================================================
// 2. COMPONENT — чистые данные + теги
// ============================================================
constexpr std::size_t MAX_COMPONENTS = 12;
using ComponentMask = std::bitset<MAX_COMPONENTS>;

constexpr std::size_t POSITION_ID = 0;
constexpr std::size_t VELOCITY_ID = 1;
constexpr std::size_t HEALTH_ID   = 2;
constexpr std::size_t COLLIDER_ID = 3;
constexpr std::size_t IS_PLAYER_ID = 4; // тег
constexpr std::size_t IS_BULLET_ID = 5; // тег
constexpr std::size_t DAMAGE_ID    = 6;

struct Position { float x, y; };
struct Velocity { float dx, dy; };
struct Health   { int hp; };
struct Collider { float radius; };
struct Damage   { int amount; };

// Тег-компоненты: пустые структуры, важен сам факт наличия
struct IsPlayer {};
struct IsBullet {};

// ============================================================
// 3. WORLD
// ============================================================
class World {
public:
    Entity CreateEntity() {
        Entity e = nextEntity_++;
        masks_[e] = ComponentMask{};
        return e;
    }

    void DestroyEntity(Entity e) {
        masks_.erase(e);
        positions_.erase(e);
        velocities_.erase(e);
        healths_.erase(e);
        colliders_.erase(e);
        damages_.erase(e);
        // теги хранятся только в маске, отдельных хранилищ нет
    }

    // --- Данные ---
    void AddComponent(Entity e, Position p) { positions_[e] = p; masks_[e].set(POSITION_ID); }
    void AddComponent(Entity e, Velocity v) { velocities_[e] = v; masks_[e].set(VELOCITY_ID); }
    void AddComponent(Entity e, Health h)   { healths_[e] = h;   masks_[e].set(HEALTH_ID); }
    void AddComponent(Entity e, Collider c) { colliders_[e] = c; masks_[e].set(COLLIDER_ID); }
    void AddComponent(Entity e, Damage d)   { damages_[e] = d;   masks_[e].set(DAMAGE_ID); }

    // --- Теги ---
    void AddTag(Entity e, IsPlayer) { masks_[e].set(IS_PLAYER_ID); }
    void AddTag(Entity e, IsBullet) { masks_[e].set(IS_BULLET_ID); }

    // --- Геттеры ---
    Position* GetPosition(Entity e) {
        auto it = positions_.find(e); return it != positions_.end() ? &it->second : nullptr;
    }
    Velocity* GetVelocity(Entity e) {
        auto it = velocities_.find(e); return it != velocities_.end() ? &it->second : nullptr;
    }
    Health* GetHealth(Entity e) {
        auto it = healths_.find(e); return it != healths_.end() ? &it->second : nullptr;
    }
    Collider* GetCollider(Entity e) {
        auto it = colliders_.find(e); return it != colliders_.end() ? &it->second : nullptr;
    }
    Damage* GetDamage(Entity e) {
        auto it = damages_.find(e); return it != damages_.end() ? &it->second : nullptr;
    }

    bool HasComponents(Entity e, ComponentMask required) const {
        auto it = masks_.find(e);
        if (it == masks_.end()) return false;
        return (it->second & required) == required;
    }

    template <typename Func>
    void ForEachEntity(Func&& func) {
        // Копируем ключи: func может удалять сущности
        std::vector<Entity> entities;
        entities.reserve(masks_.size());
        for (auto& [e, _] : masks_) entities.push_back(e);
        for (Entity e : entities) {
            if (masks_.count(e)) func(e); // проверяем, что ещё жива
        }
    }

private:
    Entity nextEntity_ = 1;
    std::unordered_map<Entity, ComponentMask> masks_;
    std::unordered_map<Entity, Position> positions_;
    std::unordered_map<Entity, Velocity> velocities_;
    std::unordered_map<Entity, Health>   healths_;
    std::unordered_map<Entity, Collider> colliders_;
    std::unordered_map<Entity, Damage>   damages_;
};

// ============================================================
// 4. SYSTEMS
// ============================================================

void MovementSystem(World& world, float dt) {
    ComponentMask required;
    required.set(POSITION_ID);
    required.set(VELOCITY_ID);

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, required)) return;
        auto* pos = world.GetPosition(e);
        auto* vel = world.GetVelocity(e);
        pos->x += vel->dx * dt;
        pos->y += vel->dy * dt;
    });
}

void HealthSystem(World& world, float dt) {
    ComponentMask required;
    required.set(HEALTH_ID);
    std::vector<Entity> toDestroy;

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, required)) return;
        auto* hp = world.GetHealth(e);
        hp->hp -= static_cast<int>(dt * 10.0f);
        if (hp->hp <= 0) toDestroy.push_back(e);
    });

    for (Entity e : toDestroy) world.DestroyEntity(e);
}

// ------------------------------------------------------------
// НОВАЯ СИСТЕМА: пули наносят урон игроку при столкновении.
// Никакой существующий код менять не пришлось — это и есть
// главный плюс ECS: добавляем данные + систему, остальное
// подхватывается автоматически по маске компонентов.
// ------------------------------------------------------------
void DamageSystem(World& world, float /*dt*/) {
    // 1. Найдём всех игроков (пока предполагаем одного, но код общий)
    Entity playerEntity = NULL_ENTITY;
    ComponentMask playerMask;
    playerMask.set(POSITION_ID);
    playerMask.set(COLLIDER_ID);
    playerMask.set(IS_PLAYER_ID);

    world.ForEachEntity([&](Entity e) {
        if (world.HasComponents(e, playerMask)) playerEntity = e;
    });
    if (playerEntity == NULL_ENTITY) return;

    auto* playerPos = world.GetPosition(playerEntity);
    auto* playerCol = world.GetCollider(playerEntity);

    // 2. Пройдёмся по всем пулям, которые попали в игрока
    ComponentMask bulletMask;
    bulletMask.set(POSITION_ID);
    bulletMask.set(COLLIDER_ID);
    bulletMask.set(DAMAGE_ID);
    bulletMask.set(IS_BULLET_ID);

    std::vector<Entity> bulletsToDestroy;

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, bulletMask)) return;

        auto* bulletPos = world.GetPosition(e);
        auto* bulletCol = world.GetCollider(e);
        auto* dmg       = world.GetDamage(e);

        float dx = bulletPos->x - playerPos->x;
        float dy = bulletPos->y - playerPos->y;
        float distSq = dx * dx + dy * dy;
        float radiusSum = bulletCol->radius + playerCol->radius;

        if (distSq <= radiusSum * radiusSum) {
            // Попадание! Снимаем HP у игрока (если он ещё жив)
            if (auto* hp = world.GetHealth(playerEntity)) {
                hp->hp -= dmg->amount;
                std::cout << "  [Damage] Bullet " << e
                          << " hit player for " << dmg->amount
                          << " dmg (hp=" << hp->hp << ")\n";
            }
            bulletsToDestroy.push_back(e);
        }
    });

    for (Entity e : bulletsToDestroy) world.DestroyEntity(e);
}

void LogSystem(World& world) {
    ComponentMask posOnly;
    posOnly.set(POSITION_ID);

    world.ForEachEntity([&](Entity e) {
        if (!world.HasComponents(e, posOnly)) return;
        auto* pos = world.GetPosition(e);
        auto* hp  = world.GetHealth(e);
        std::cout << "Entity " << e
                  << " | pos=(" << pos->x << ", " << pos->y << ")";
        if (hp) std::cout << " | hp=" << hp->hp;
        if (world.HasComponents(e, ComponentMask{}.set(IS_PLAYER_ID))) std::cout << " [player]";
        if (world.HasComponents(e, ComponentMask{}.set(IS_BULLET_ID))) std::cout << " [bullet]";
        std::cout << "\n";
    });
}

// ============================================================
// 5. СБОРКА СЦЕНЫ
// ============================================================
int main() {
    World world;

    // Игрок: в центре, с коллайдером, здоровьем и тегом
    Entity player = world.CreateEntity();
    world.AddComponent(player, Position{0.0f, 0.0f});
    world.AddComponent(player, Health{100});
    world.AddComponent(player, Collider{0.5f});
    world.AddTag(player, IsPlayer{});

    // Три пули, летящие в игрока с разных сторон
    Entity bullet1 = world.CreateEntity();
    world.AddComponent(bullet1, Position{-2.0f, 0.0f});
    world.AddComponent(bullet1, Velocity{1.0f, 0.0f});
    world.AddComponent(bullet1, Collider{0.1f});
    world.AddComponent(bullet1, Damage{15});
    world.AddTag(bullet1, IsBullet{});

    Entity bullet2 = world.CreateEntity();
    world.AddComponent(bullet2, Position{2.0f, 0.0f});
    world.AddComponent(bullet2, Velocity{-1.0f, 0.0f});
    world.AddComponent(bullet2, Collider{0.1f});
    world.AddComponent(bullet2, Damage{20});
    world.AddTag(bullet2, IsBullet{});

    Entity bullet3 = world.CreateEntity();
    world.AddComponent(bullet3, Position{0.0f, 2.0f});
    world.AddComponent(bullet3, Velocity{0.0f, -1.0f});
    world.AddComponent(bullet3, Collider{0.1f});
    world.AddComponent(bullet3, Damage{10});
    world.AddTag(bullet3, IsBullet{});

    // Статичная скала: без Velocity, без Health — просто мебель
    Entity rock = world.CreateEntity();
    world.AddComponent(rock, Position{10.0f, 10.0f});
    world.AddComponent(rock, Collider{1.0f});

    std::cout << "=== Initial state ===\n";
    LogSystem(world);

    const float dt = 1.0f; // каждый кадр — 1 секунда симуляции
    for (int frame = 1; frame <= 5; ++frame) {
        std::cout << "\n=== Frame " << frame << " ===\n";

        MovementSystem(world, dt);
        DamageSystem(world, dt);   // <-- новая система
        HealthSystem(world, dt);
        LogSystem(world);
    }

    return 0;
}
```

### 🧠 Что здесь важно с точки зрения ECS

**1. Мы не трогали `MovementSystem` и `HealthSystem`.**
Они продолжают работать как раньше. `DamageSystem` — это **отдельный кусок логики**, который сам находит нужные ему сущности по маске. В ООП-версии пришлось бы либо лезть в `class Player`, добавляя ему метод `TakeDamage()`, либо создавать жёсткую связь `Bullet → Player`, что нарушает инкапсуляцию и усложняет тестирование.

**2. Поведение задаётся составом компонентов, а не типом.**
Пуля — это не класс `Bullet : public GameObject`, а сущность с компонентами `Position + Velocity + Collider + Damage + IsBullet`. Хотите «лазерный луч», который пробивает насквозь? Добавьте компонент `Piercing` и научите `DamageSystem` его учитывать — снова без изменения существующих сущностей.

**3. Тег-компоненты — это тоже компоненты.**
`IsPlayer` и `IsBullet` не хранят данных. Они нужны только для того, чтобы системы могли фильтровать сущности по маске. Это классический приём в ECS: **наличие компонента = факт принадлежности к категории**.

**4. Урон применяется в одной системе, а не размазан по коду.**
Вся логика «пуля попала → снять HP → уничтожить пулю» сосредоточена в `DamageSystem`. Легко добавить сюда броню, криты, иммунитеты — не задевая остальные системы.

**5. Смерть игрока пока не обрабатывается специально.**
`HealthSystem` удалит игрока, когда HP ≤ 0. Если хотите — добавьте систему `GameOverSystem`, которая ищет сущности с `IsPlayer` и `Health.hp <= 0` и реагирует. Снова — просто новый кусок логики, а не правка классов.

### ⚠️ Что остаётся «упрощённым» по сравнению с промышленным ECS

- `DamageSystem` каждый кадр делает O(N×M) проверок (все пули × игрок). В реальном движке используют **spatial hash**, **broad phase** и кэширование запросов.
- Мы вручную назначаем `*_ID` для компонентов. В EnTT/flecs/Unity DOTS это делается автоматически через шаблоны, что исключает ошибки «забыл зарегистрировать компонент».
- Порядок систем задан явно в `main`. В реальном ECS-фреймворке есть планировщик, который строит граф зависимостей по читаемым/записываемым компонентам.

Но принцип — **данные отдельно, логика отдельно, фильтрация по маске** — ровно тот же, что и в 300-строчном примере. Именно поэтому добавление новой фичи заняло ~50 строк нового кода и **ноль правок в существующем**.