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