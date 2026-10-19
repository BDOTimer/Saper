// glb-factor.js
// ./glb-models/glb-factor.js

// Описание:
//  -   ModelFactory грузит модели *.glb в браузер в 1 экземлпляре
//  -   UnitsManager создает клон модели по id
//  -   UnitsManager после использования клона - он удаляется из scene по id
//  -   Желательно иметь Pool.
//  -   ...

// import * as THREE from "three";
// import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";


class ModelFactory
{   // Кэш: путь → gltf (уже загруженный) ИЛИ Promise (в процессе загрузки)
    static _cache = new Map();
    static loader = null;

    static setup()
    {   ModelFactory.loader = new GLTFLoader();
    }

    static MODELS = [
{ id: 0, path: "./glb-models/shuttle-g1.glb",  poolSize: 30, scale: 0.5 },
{ id: 1, path: "./glb-models/station-g1.glb",  poolSize:  2, scale: 100 },
{ id: 2, path: "./glb-models/ss-1.glb"      ,  poolSize:  2, scale: 100 },
    ];

    /**
     * Прелоад моделей (вызывать явно при старте игры, не в static {})
     */
    /** Прелоад всех моделей из MODELS */
    static async preloadAll()
    {
        const promises = this.MODELS.map(m =>
            this.loadGLB(m.path).catch(err =>
            {
                console.error(`Ошибка прелоада модели ${m.path}:`, err);
                return null;
            })
        );
        await Promise.all(promises);
    }

    static loadGLB(path)
    {   if (this._cache.has(path))
        {   const cached = this._cache.get(path);
            // Если уже загружено — возвращаем gltf, если в процессе — возвращаем Promise
            return cached instanceof Promise ? cached : Promise.resolve(cached);
        }

        const promise = new Promise((resolve, reject) =>
        {   this.loader.load(
                path,
                gltf =>
            {   // Сначала сохраняем gltf в кэш
                this._cache.set(path, gltf);
                resolve(gltf);
            },
            xhr =>
            {   
    //console.log(`$ {path}: $ {(xhr.loaded / xhr.total * 100).toFixed(1)}%`);
            },
            err =>
            {   this._cache.delete(path); // при ошибке убираем из кэша
                reject(err);
            }
            );
        });

        // Сохраняем Promise, чтобы параллельные запросы ждали один и тот же
        this._cache.set(path, promise);
        return promise;
    }

    static async createShip(path, scale = 1)
    {
        const gltf  = await this.loadGLB(path);
        const model = SkeletonUtils.clone(gltf.scene);

        // Явный сброс трансформаций, чтобы бокс считался корректно
        model.position.set  (0, 0, 0);
        model.rotation.set  (0, 0, 0);
        model.scale.setScalar (scale);
        model.updateMatrixWorld(true);

        // Центрируем: помещаем геометрический центр в origin wrapper'а
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.userData.animations = gltf.animations;

        return { model: wrapper, animations: gltf.animations };
    }

    static async getModel(id, scale = -1)
    {
        if (id < 0 || id >= this.MODELS.length)
        {
            throw new Error(`Неверный id модели: ${id}`);
        }

        const SCL = scale === -1 ? this.MODELS[id].scale : scale;

        const { model } = await this.createShip(this.MODELS[id].path, SCL);
        return model;
    }
}

// ---------------------------------------------------------
// UnitsManager с Pool и корректным удалением
// ---------------------------------------------------------
class UnitsManager
{   static scene = null;
    static pools = new Map(); // id → { pool: [], max: number }
    static activeUnits = new Map(); // unitId → { model, mixer, etc }

    static SHUTTLE = 0;
    static STATION = 1;
    static SS1     = 2;

    static unitCounter = 0;

    static init(scene)
    {   UnitsManager.scene = scene;
        ModelFactory.setup();
    }

    static update(dt) {
        for (const unit of UnitsManager.activeUnits.values())
            unit.mixer?.update(dt);
    }

    /**
     * Создать пул для модели id (один раз при старте)
     */
    static createPool(id, max = 20)
    {   if (!UnitsManager.pools.has(id))
        {   UnitsManager.pools.set(id, { pool: [], max });
        }
    }

    /**
     * Получить юнит из пула или создать новый
     */
    static async borrowUnit(id, scale = -1)
    {
        const poolData = UnitsManager.pools.get(id);
        if (!poolData)
        {
            throw new Error(`Пул для модели ${id} не создан. Вызовите createPool.`);
        }

        let model;
        let mixer = null;

        if (poolData.pool.length > 0)
        {
            const unit = poolData.pool.pop();
            model = unit.model;
            mixer = unit.mixer;
            model.position.set(0, 0, 0);
            model.rotation.set(0, 0, 0);
        }
        else
        {
            model = await ModelFactory.getModel(id, scale);   // <-- scale
            if (model.userData.animations?.length > 0)
            {
                mixer = new THREE.AnimationMixer(model);
                mixer.clipAction(model.userData.animations[0]).play();
            }
        }

        const unitId = UnitsManager.unitCounter++;
        UnitsManager.activeUnits.set(unitId, { id, model, mixer });

        return { unitId, model, mixer };
    }

    /**
     * Добавить юнит на сцену в позицию
     */
    static add2Scene(unitId, position)
    {   const unit = UnitsManager.activeUnits.get(unitId);
        if (!unit) throw new Error(`unitId $ {unitId} не найден`);

        unit.model.position.copy(position);
        UnitsManager.scene.add(unit.model);
    }

    /**
     * Вернуть юнит в пул (не удалять из памяти)
     */
    static returnToPool(unitId)
    {   const unit = UnitsManager.activeUnits.get(unitId);
        if (!unit) return;

        UnitsManager.scene.remove(unit.model);

        // Останавливаем анимацию
        if (unit.mixer)
        {   unit.mixer.stopAll();
        }

        // Возвращаем в пул
        const poolData = UnitsManager.pools.get(unit.id);
        if (poolData && poolData.pool.length < poolData.max)
        {   poolData.pool.push({ model: unit.model, mixer: unit.mixer });
        }
        else
        {   // Пул переполнен — диспоузим, чтобы освободить память
            this.disposeUnit(unit);
        }

        UnitsManager.activeUnits.delete(unitId);
    }

    /**
     * Полностью удалить юнит и освободить память (если не в пуле)
     */
    static disposeUnit(unit)
    {   if (unit.mixer)
        {   unit.mixer.stopAll();
            unit.mixer = null;
        }
        if (unit.model)
        {   // Диспоузим геометрию и материалы
            unit.model.traverse(child =>
            {   if (child.isMesh)
                {   if (child.geometry) child.geometry.dispose();
                    if (child.material)
                    {   if (Array.isArray(child.material))
                        {   child.material.forEach(m => m.dispose());
                        }
                        else
                        {   child.material.dispose();
                        }
                    }
                }
            });
            unit.model = null;
        }
    }

    /**
     * Удалить юнит со сцены и из активных (для экстренных случаев)
     */
    static del2Scene(unitId)
    {   const unit = UnitsManager.activeUnits.get(unitId);
        if (!unit) return;

        UnitsManager.scene.remove(unit.model);
        // Не возвращаем в пул, а сразу диспоузим
        this.disposeUnit(unit);
        UnitsManager.activeUnits.delete(unitId);
    }

    /**
     * Очистить все пулы и активные юниты (например, при смене сектора)
     */
    static clearAll()
    {   for (const unit of UnitsManager.activeUnits.values())
        {   this.disposeUnit(unit);
        }
        UnitsManager.activeUnits.clear();

        for (const pool of UnitsManager.pools.values())
        {   for (const u of pool.pool)
            {   this.disposeUnit(u);
            }
            pool.pool = [];
        }
    }
}

if (!window.GLB)
{    window.GLB = {};
}

window.GLB.ModelFactory = ModelFactory;
window.GLB.UnitsManager = UnitsManager;


// Инициализация: обязательно вызывай с await снаружи
window.GLB.init = async function(scene)
{   UnitsManager.init  (scene);
    await ModelFactory.preloadAll();
    // Создаём пулы строго по MODELS
    for (const m of ModelFactory.MODELS)
        UnitsManager.createPool(m.id, m.poolSize);
}

// Спавн врага: возвращаем объект врага, чтобы управлять им
window.GLB.spawnEnemy = async function(id, position)
{   const { unitId, model, mixer } = await UnitsManager.borrowUnit(id);
    UnitsManager.add2Scene(unitId, position);

    // Создаём объект врага и сохраняем unitId/mixer внутри него
    const enemy =
    {   unitId,
        model ,
        mixer ,
        alive: true,
        hp   : 100,
        // сюда можно добавить логику врага: update(dt), hit(dmg) и т.п.
    };

    return enemy;
}

// Обработка смерти врага
window.GLB.onEnemyDeath = function(enemy)
{   if (!enemy || enemy.unitId === undefined) return;

    UnitsManager.returnToPool(enemy.unitId);
    enemy.unitId = undefined;
    enemy.alive = false;
    // обнуляем ссылки, чтобы GC мог собрать, если нужно
    enemy.model = null;
    enemy.mixer = null;
}

// При смене сектора (чтобы не было утечек)
window.GLB.changeSector = function() 
{   UnitsManager.clearAll(); // полностью очистит пулы и освободит память
    // дальше генерируй новые объекты
}

// Где-то в точке входа (main.js, index.js и т.д.)
window.GLB.test_1 = async function(scene, pos)
{   
    await GLB.init(scene);

    console.log('🔍 GLB cache size:', GLB.ModelFactory._cache.size);

    // for (const [path, val] of GLB.ModelFactory._cache) {
    //     console.log(path, val instanceof Promise ? 'PROMISE (ещё грузится)' : 'GLTF OK', val);
    // }

    // Пример спавна
    // const enemy1 = await GLB.spawnEnemy(new THREE.Vector3(pos.x, pos.y+50, pos.z));
    // const enemy2 = await GLB.spawnEnemy(new THREE.Vector3(pos.x, pos.y, pos.z+50));

    const enemy1  = await GLB.spawnEnemy(UnitsManager.SHUTTLE, new THREE.Vector3(0, 100, 1000));
    const station = await GLB.spawnEnemy(UnitsManager.STATION, new THREE.Vector3(0,   0, 1000));
    const ss1     = await GLB.spawnEnemy(UnitsManager.SS1    , new THREE.Vector3(0, 400, 1000));

    // Когда враг умер
    //GLB.onEnemyDeath(enemy1);

    return [enemy1, station, ss1];
}

