/* -----------------------------------------------------------------------------
 * radar-holo.js
 * Голографический тактический радар (HUD-оверлей).
 *
 * Идея:
 *   - Радар — это 2D-оверлей поверх основной сцены (свой Scene + ортокамера).
 *   - НЕ привязан к игровой камере — всегда ровно по центру внизу экрана.
 *   - Внутри радара мир вращается относительно корабля, но сам радар неподвижен.
 *   - Враги — красные точки, станция — зелёная, планеты/звезда — жёлтые.
 *   - Сфера + плоское тактическое кольцо + сетка + "ножки" от точек к плоскости.
 *
 * Использование:
 *   const radar = new RadarHolo(renderer, { range: 2000, size: 220 });
 *   radar.setContacts([...]);
 *   radar.update(dt, shipPos, shipQuat);
 *   radar.render();   // ← ПОСЛЕ composer.render()
 *
 * Зависимости: THREE (глобальный).
 * ---------------------------------------------------------------------------*/

class RadarHolo
{
    #renderer;
    #scene;
    #camera;
    #group;

    #range;
    #size;
    #flattenY;
    #tiltX;

    #contactMeshes = new Map();
    #contactLines  = new Map();

    #shipPos  = new THREE.Vector3();
    #shipQuat = new THREE.Quaternion();

    constructor(renderer, opts = {})
    {
        if (!renderer) throw new Error("RadarHolo: renderer is required");

        this.#renderer = renderer;

        this.#range    = opts.range    ?? 2000;
        this.#size     = opts.size     ?? 220;   // радиус сферы в world units HUD-сцены
        this.#flattenY = opts.flattenY ?? 0.5;   // ★ 1 = сфера, 0.5 = сплюснута вдвое

        // ★ Наклон: 0 = строго горизонтально (вид сбоку),
        //   положительное значение — радар наклоняется «от игрока»,
        //   и мы смотрим на него сверху.
        //   ~0.35 рад ≈ 20° — мягкий наклон приборной панели.
        this.#tiltX = opts.tiltX ?? 0.35;

        // ------------------------------------------------------------
        //  Своя сцена и ортокамера — пиксель в пиксель с экраном.
        //  Так радар не зависит от игровой камеры и всегда внизу по центру.
        // ------------------------------------------------------------
        this.#scene  = new THREE.Scene();

        const w = window.innerWidth;
        const h = window.innerHeight;
        this.#camera = new THREE.OrthographicCamera(
            -w / 2, w / 2, h / 2, -h / 2, 0.1, 1000
        );
        this.#camera.position.z = 100;

        // ------------------------------------------------------------
        //  Группа радара — позиционируем её в мировых координатах HUD-сцены.
        //  (0, 0) — центр экрана. Опускаем вниз на ~28% высоты экрана.
        // ------------------------------------------------------------
        this.#group = new THREE.Group();
        this.#group.name = "RadarHolo";
        this.#group.position.set(0, -h * 0.35, -140);

        // ★ Наклон вокруг X — смотрим на радар сверху.
        this.#group.rotation.x = this.#tiltX;

        // ★ Сплющиваем всю группу по Y — сфера, плоскость, сетка,
        //   контакты и «ножки» остаются согласованными между собой.
        this.#group.scale.y = this.#flattenY;
        this.#scene.add(this.#group);

        this.#createRadarSphere();
        this.#createTacticalPlane();

        // Слушаем ресайз, чтобы пересобрать ортокамеру и позицию группы
        this._onResize = () => this.#resize();
        window.addEventListener("resize", this._onResize);
    }

    // -----------------------------------------------------------------
    //  Геометрия радара
    // -----------------------------------------------------------------
    #createRadarSphere()
    {
        const geo = new THREE.SphereGeometry(this.#size, 32, 24);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.08,
            wireframe: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        const sphere = new THREE.Mesh(geo, mat);
        this.#group.add(sphere);
    }

    #createTacticalPlane()
    {
        // Плоскость-диск (чтобы не торчали углы квадрата)
        const geo = new THREE.CircleGeometry(this.#size, 64);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x2255aa,
            transparent: true,
            opacity: 0.14,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        const plane = new THREE.Mesh(geo, mat);
        plane.rotation.x = -Math.PI / 2;
        this.#group.add(plane);

        // Полярная сетка — красивее обычного GridHelper
        const gridMat = new THREE.LineBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        // Концентрические окружности
        for (let i = 1; i <= 4; i++) {
            const r = (this.#size / 4) * i;
            const pts = [];
            for (let a = 0; a <= 64; a++) {
                const t = (a / 64) * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r));
            }
            const g = new THREE.BufferGeometry().setFromPoints(pts);
            this.#group.add(new THREE.Line(g, gridMat));
        }

        // Радиальные лучи
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * Math.PI * 2;
            const g = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(
                    Math.cos(t) * this.#size, 0, Math.sin(t) * this.#size
                ),
            ]);
            this.#group.add(new THREE.Line(g, gridMat));
        }

        // Экваториальное кольцо сферы — «горизонт»
        const ringPts = [];
        for (let a = 0; a <= 96; a++) {
            const t = (a / 96) * Math.PI * 2;
            ringPts.push(new THREE.Vector3(
                Math.cos(t) * this.#size, 0, Math.sin(t) * this.#size
            ));
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
        const ringMat = new THREE.LineBasicMaterial({
            color: 0x66ccff,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.#group.add(new THREE.Line(ringGeo, ringMat));
    }

    // -----------------------------------------------------------------
    //  Контакты
    // -----------------------------------------------------------------
    setContacts(contacts)
    {
        const seen = new Set();

        for (const c of contacts) {
            seen.add(c.id);

            let mesh = this.#contactMeshes.get(c.id);
            let line = this.#contactLines.get(c.id);

            const color   = this.#getContactColor(c);
            const r       = this.#getContactSize(c);
            const opacity = this.#getContactOpacity(c);

            if (!mesh) {
                const geo = new THREE.SphereGeometry(r, 8, 8);
                const mat = new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false,
                });
                mesh = new THREE.Mesh(geo, mat);

                this.#group.add(mesh);
                this.#contactMeshes.set(c.id, mesh);

                const lineGeo = new THREE.BufferGeometry();
                lineGeo.setAttribute("position",
                    new THREE.BufferAttribute(new Float32Array(6), 3));
                const lineMat = new THREE.LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity: opacity * 0.6,   // ★ ножка наследует прозрачность
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });
                line = new THREE.Line(lineGeo, lineMat);
                this.#group.add(line);
                this.#contactLines.set(c.id, line);
            }

            // Позиция относительно корабля
            const rel = c.pos.clone().sub(this.#shipPos);

            // ★ Компенсируем поворот корабля: радар всегда «смотрит вперёд»
            rel.applyQuaternion(this.#shipQuat.clone().invert());

            // Масштабируем в координаты сферы радара
            rel.multiplyScalar(this.#size / this.#range);

            // Зажимаем внутрь сферы
            if (rel.length() > this.#size) rel.setLength(this.#size);

            // Ось Y радара (THREE) = ось Z в плоскости XZ плоскости радара
            // Проще: раскладываем rel по (x, y, z) как есть.
            mesh.position.copy(rel);

            // Линия-«ножка» от плоскости y=0 до контакта
            const arr = line.geometry.attributes.position.array;
            arr[0] = rel.x; arr[1] = 0;     arr[2] = rel.z;
            arr[3] = rel.x; arr[4] = rel.y; arr[5] = rel.z;
            line.geometry.attributes.position.needsUpdate = true;
            line.geometry.computeBoundingSphere();
        }

        // Убираем контакты, которых больше нет
        for (const [id, mesh] of this.#contactMeshes) {
            if (seen.has(id)) continue;

            this.#group.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.#contactMeshes.delete(id);

            const line = this.#contactLines.get(id);
            if (line) {
                this.#group.remove(line);
                line.geometry.dispose();
                line.material.dispose();
                this.#contactLines.delete(id);
            }
        }
    }

    #getContactColor(c)
    {
        if (c.kind === "enemy")   return 0xff3333;   // враг — красный
        if (c.kind === "station") return 0x33ff55;   // станция — зелёный
        if (c.kind === "star")    return 0xffee66;   // ★ звезда — ярко-жёлтый
        if (c.kind === "planet")  return 0xaa7777;   // ★ планета — тускло-оранжевый
        return 0xffffff;
    }

    // ★ Радиус точки и её прозрачность — по типу контакта
    #getContactSize(c)
    {
        if (c.kind === "enemy")   return 5;
        if (c.kind === "station") return 4;
        if (c.kind === "star")    return 5;   // звезда покрупнее
        if (c.kind === "planet")  return 4;   // планеты — мелкие
        return 3;
    }

    #getContactOpacity(c)
    {
        if (c.kind === "star")   return 1.0;   // ★ звезда — непрозрачная, яркая
        if (c.kind === "planet") return 0.9;   // ★ планеты — притушены
        return 0.9;
    }

    // -----------------------------------------------------------------
    //  Обновление / рендер
    // -----------------------------------------------------------------
    update(dt, shipPos, shipQuat)
    {
        if (shipPos)  this.#shipPos.copy(shipPos);
        if (shipQuat) this.#shipQuat.copy(shipQuat);

        // Легкое вращение сферы для «жизни»
        this.#group.rotation.y += dt * 0.15;
    }

    render()
    {
        // ★ Рисуем ПОВЕРХ основной сцены, очищая только depth,
        //   чтобы HUD-сцена не затирала основную картинку.
        const r = this.#renderer;
        r.autoClear = false;
        r.clearDepth();
        r.render(this.#scene, this.#camera);
        r.autoClear = true;
    }

    #resize()
    {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.#camera.left   = -w / 2;
        this.#camera.right  =  w / 2;
        this.#camera.top    =  h / 2;
        this.#camera.bottom = -h / 2;
        this.#camera.updateProjectionMatrix();

        // Опускаем радар вниз по центру экрана
        this.#group.position.set(0, -h * 0.28, 0);
    }
}

window.RadarHolo = RadarHolo;