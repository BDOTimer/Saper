// ============================================================================
//  enemy-A.js — Враг: меш, спавн, логика, урон, утиль.
//  Классический скрипт: кладёт EnemyA в глобал (как StarA/PLANET).
// ============================================================================

class EnemyA
{
    //--------------------------------------------------------|
    // СТАТИКА — общее хранилище всех врагов                  |
    //--------------------------------------------------------:
    static list  = [];   // все живые враги
    static scene = null;

    /// Подключить к сцене (вызвать один раз после создания scene)
    static init(scene, camera) {
        EnemyA.scene  = scene;
        EnemyA.camera = camera;
    }

    /// Спавн врага (бывшая spawnEnemy)
    static spawn(camera)
    {   if (!Settings.isSpawnEnemies)  return null;
        if ( EnemyA.list.length >= 5 || Math.random() > this.RATE) return null;

        const c    = camera ? camera.position : { x: 0, y: 0, z: 0 }; // ★ вокруг игрока
        const ang  = Math.random() * Math.PI * 2;
        const dist = 400 + Math.random() * 600;

        const e = new EnemyA(new THREE.Vector3(
            c.x + Math.cos(ang) * dist,
            c.y + (Math.random() - 0.5) * 200,
            c.z + Math.sin(ang) * dist,
        ));
        EnemyA.list.push(e);
        return e;
    }

    /// Обновить всех врагов за кадр
    static updateAll(dt, playerPos) {
        for (const e of EnemyA.list) e.update(dt, playerPos);
    }

    /// Убрать всех врагов (бывшие циклы в completeHyperJump / resetGame)
    static clear() {
        for (const e of EnemyA.list) e.dispose();
        EnemyA.list.length = 0;

        // Совместимость со старым кодом, читавшим game.enemies
        if (window.GAME && GAME.enemies) GAME.enemies.length = 0;
    }

    /// Удалить одного врага (при убийстве)
    static remove(enemy) {
        const i = EnemyA.list.indexOf(enemy);
        if (i >= 0) EnemyA.list.splice(i, 1);
        enemy.dispose();
    }

    static get count() { return EnemyA.list.length; }
    get rotation() { return this.mesh.rotation; } 

    //--------------------------------------------------------|
    // ЭКЗЕМПЛЯР                                              |
    //--------------------------------------------------------:
    constructor(position)
    {   this.mesh = EnemyA.buildMesh();
        this.mesh.position.copy(position);

        // Данные в userData — как раньше, чтобы старый код
        // (проверки userData.enemy и т.п.) продолжал работать
        this.mesh.userData.enemy = true;
        this.mesh.userData.owner = this;   // ссылка на экземпляр
        this.mesh.userData.hp    = 3;
        this.mesh.userData.speed = 20 + Math.random() * 40;

        this.alive = true;
        EnemyA.scene.add(this.mesh);

        this.RATE = 0.005;
    }

    // Доступ к hp/speed и через класс, и через userData
    get hp      () { return this.mesh.userData.hp; }
    set hp     (v) { this.mesh.userData.hp = v; }
    get speed   () { return this.mesh.userData.speed; }
    set speed  (v) { this.mesh.userData.speed = v; }
    get position() { return this.mesh.position; }

    /// Визуал врага (бывшая makeEnemyShip)
    static buildMesh()
    {   const group = new THREE.Group();
        const mat   = new THREE.MeshStandardMaterial({
            color: 0xaa3333,
            metalness: 0.7,
            roughness: 0.5,
        });
        group.add(new THREE.Mesh(new THREE.OctahedronGeometry(8, 0), mat));

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(10, 1, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0xff4444, toneMapped: false }),
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        return group;
    }

    /// Логика врага за кадр — сюда переносится код движения/атаки
    /// из игрового цикла, работавший с массивом enemies
    update(dt, playerPos)
    {
        // Пример (подставь свою логику из обрезанной части):
        // const dir = tmpVec.copy(playerPos).sub(this.mesh.position);
        // if (dir.length() > 1) {
        //     this.mesh.position.addScaledVector(dir.normalize(), this.speed * dt);
        //     this.mesh.lookAt(playerPos);
        // }
    }

    /// Попадание по врагу. true — уничтожен
    hit(dmg = 1)
    {   if (!this.alive) return false;
        this.hp -= dmg;
        if (this.hp <= 0) { this.alive = false; return true; }
        return false;
    }

    /// Убрать со сцены
    remove()
    {   EnemyA.scene.remove(this.mesh);
    }

    /// Полная зачистка: сцена + dispose геометрии/материалов
    dispose()
    {   this.remove();
        this.mesh.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                Array.isArray(o.material)
                    ? o.material.forEach(m => m.dispose())
                    : o.material.dispose();
            }
        });
    }
}

window.EnemyA = EnemyA; // глобальный доступ