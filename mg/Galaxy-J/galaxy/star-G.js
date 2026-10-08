// star-G.js
// Процедурная звезда с анимированной поверхностью, короной и светом.
// API:
//   const sun = new StarG(scene, camera, options);
//   sun.setPosition(x, y, z);   // или setPositionV3(vec)
//   sun.setSize(radius);
//   sun.setColor(hex);
//   sun.update(dt, elapsed);    // dt и elapsed в СЕКУНДАХ
//   sun.dispose();
//
// Опции:
//   size            — радиус сферы (по умолчанию 50)
//   color           — цвет ядра (hex, по умолчанию 0xfcc200)
//   haloColor       — цвет короны/гало (hex, по умолчанию 0xffaa00)
//   haloScale       — множитель размера гало относительно size (по умолчанию 20)
//   pulseSpeed      — скорость пульсации (по умолчанию 0.3)
//   rotationSpeed   — скорость вращения поверхности (по умолчанию 0.05)
//   lightIntensity  — базовая интенсивность света (по умолчанию 3.0)
//   lightDistance   — дальность света (по умолчанию 5000)
//   position        — {x,y,z} или THREE.Vector3 (по умолчанию 500,500,500)
//
//  Звезда всегда находиться в позици {0,0,0}
//  Корабль спавниться не менее 5000 м от звезды
//  Планеты имееют орбиты от 1000м до 3000м

class StarG
{
    constructor(scene, camera, options = {})
    {
        this.scene  = scene;
        this.camera = camera;

        const s = {
            size:           50,
            color:          0xc04050,//0xfcc200,
            haloColor:      0xc0a050,//0xffaa00,
            haloScale:      20,
            pulseSpeed:     0.3,
            rotationSpeed:  0.05,
            lightIntensity: 3.0,
            lightDistance:  5000,
            position:       { x: 0, y: 0, z: 0 },
            ...options,
        };
        this.settings = s;

        // --- Группа ---
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // --- Позиция сразу ---
        const p = s.position;
        if (p && p.isVector3) this.group.position.copy(p);
        else if (p) this.group.position.set(p.x || 0, p.y || 0, p.z || 0);

        // --- Текстура поверхности ---
        const surfaceTex = new THREE.CanvasTexture(this._createSurfaceTexture(512, 512, s.color));

        // --- Ядро ---
        const coreGeo = new THREE.SphereGeometry(s.size, 64, 64);
        const coreMat = new THREE.MeshBasicMaterial({
            map: surfaceTex,
            color: 0xffffff,
            toneMapped: false,
        });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.group.add(this.core);

        // --- Корона ---
        const coronaGeo = new THREE.SphereGeometry(s.size * 1.35, 48, 48);
        const coronaMat = new THREE.MeshBasicMaterial({
            color: s.haloColor,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
            toneMapped: false,
        });
        this.corona = new THREE.Mesh(coronaGeo, coronaMat);
        this.group.add(this.corona);

        // --- Гало ---
        const haloTex = new THREE.CanvasTexture(this._createHaloTexture(256, s.haloColor));
        const haloGeo = new THREE.PlaneGeometry(1, 1);
        const haloMat = new THREE.MeshBasicMaterial({
            map: haloTex,
            color: s.haloColor,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        this.halo = new THREE.Mesh(haloGeo, haloMat);
        this.halo.scale.setScalar(s.haloScale * s.size);
        this.group.add(this.halo);

        // --- Свет ---
        this.light = new THREE.PointLight(s.color, s.lightIntensity, s.lightDistance, 2);
        this.light.position.set(0, 0, 0);
        this.group.add(this.light);

        // --- Анимация ---
        this._time = 0;
        this._pulsePhase = Math.random() * Math.PI * 2;
    }

    // --------------------------------------------------------------
    //  Перестройка звезды по star-данным из GALAXY
    //  star: { id, name, x, y, r, color, tech, danger, hue? }
    // --------------------------------------------------------------
    rebuild(star) {
        if (!star) {
            console.warn("StarG.rebuild: star is required");
            return this;
        }

        // --- Сид: id + хэш имени, чтобы имена тоже влияли ---
        const seed = ((star.id | 0) * 2654435761) ^ StarG._strHash(star.name || "");
        const rng  = StarG._mulberry32(seed >>> 0);

        // --- hue: если в star есть — используем, иначе выводим из id ---
        const baseHue = (typeof star.hue === "number")
            ? star.hue
            : ((star.id * 0.137) % 1 + 1) % 1;

        // --- Класс светила по hue ---
        //   hue < 0.15  -> красный карлик
        //   hue < 0.35  -> оранжевый
        //   hue < 0.65  -> жёлто-белый (как Солнце)
        //   hue < 0.85  -> бело-голубой
        //   иначе       -> голубой гигант
        let klass;
        if (baseHue < 0.15)      klass = "red-dwarf";
        else if (baseHue < 0.35) klass = "orange";
        else if (baseHue < 0.65) klass = "yellow";
        else if (baseHue < 0.85) klass = "white-blue";
        else                     klass = "blue-giant";

        // --- tech и danger ---
        const tech   = Math.max(1, Math.min(15, star.tech | 0));
        const danger = (typeof star.danger === "number") ? star.danger : 0;

        // --- Радиус по классу + шум ---
        const radiusBase = {
            "red-dwarf":  60,
            "orange":     90,
            "yellow":    120,
            "white-blue":140,
            "blue-giant":180,
        }[klass];

        const radius = radiusBase + rng() * 40;

        // --- Цвета (HSL -> hex) ---
        const coreSat = (klass === "white-blue" || klass === "blue-giant") ? 0.9 : 0.8;
        const coreLum = klass === "blue-giant" ? 0.85
                    : klass === "red-dwarf"  ? 0.55
                    : 0.7;

        const coronaHue = (baseHue + 0.03) % 1;
        const coronaSat = coreSat * 0.9;
        const coronaLum = Math.min(0.95, coreLum + 0.15);

        const coreColor   = new THREE.Color().setHSL(baseHue,  coreSat,  coreLum);
        const coronaColor = new THREE.Color().setHSL(coronaHue, coronaSat, coronaLum);

        // --- Пульсация: у красных карликов чаще и заметнее ---
        const pulseSpeed = klass === "red-dwarf"
            ? 3.0 + rng() * 2.0
            : 0.8 + rng() * 1.2;
        const pulseAmp = klass === "red-dwarf"
            ? 0.08 + rng() * 0.06
            : 0.03 + rng() * 0.03;

        // --- Корона и гало ---
        const coronaIntensity = 0.6 + danger * 1.8;
        const haloScale       = 20 + danger * 10 + rng() * 5;

        // --- Свет ---
        const lightIntensity = 1.2 + tech * 0.05 + danger * 0.5;
        const lightDistance  = radius * 20;

        // --- Применяем всё к текущей звезде ---

        // 1. Размер
        this.setSize(radius);

        // 2. Цвета
        this.core.material.color.copy(coreColor);
        this.corona.material.color.copy(coronaColor);
        this.halo.material.color.copy(coronaColor);
        this.light.color.copy(coreColor);

        // 3. Корона: масштаб и прозрачность
        this.corona.scale.setScalar(1.35);
        this.corona.material.opacity = Math.min(0.5, 0.18 * coronaIntensity);

        // 4. Гало
        this.settings.haloScale = haloScale;
        this.halo.material.color.copy(coronaColor);
        this.halo.scale.setScalar(haloScale * radius);

        // 5. Свет
        this.light.intensity = lightIntensity;
        this.light.distance  = lightDistance;

        // 6. Скорости
        this.settings.pulseSpeed      = pulseSpeed;
        this.settings.pulseAmp        = pulseAmp;   // пригодится, если позже заведёте амплитуду
        this.settings.rotationSpeed   = klass === "blue-giant" ? 0.08 : 0.04;

        // 7. Сохраняем служебные данные
        this.settings.size            = radius;
        this.settings.color           = coreColor.getHex();
        this.settings.haloColor       = coronaColor.getHex();
        this.settings.lightIntensity  = lightIntensity;
        this.settings.lightDistance   = lightDistance;
        this.settings.klass           = klass;
        this.settings.coronaIntensity = coronaIntensity;

        // 8. Сброс фазы пульсации — звезда «оживает» заново
        this._pulsePhase = rng() * Math.PI * 2;
        this._time = 0;

        return this;
    }

    // алиас для совместимости со старым именем
    reBuid(star) { return this.rebuild(star); }

    // --------------------------------------------------------------
    //  Утилиты (статические — чтобы можно было звать из rebuild)
    // --------------------------------------------------------------
    static _mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    static _strHash(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    // --------------------------------------------------------------
    //  Позиция
    // --------------------------------------------------------------
    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
        return this;
    }
    setPositionV3(v) {
        this.group.position.copy(v);
        return this;
    }
    getPosition(out = new THREE.Vector3()) {
        return out.copy(this.group.position);
    }

    // --------------------------------------------------------------
    //  Размер
    // --------------------------------------------------------------
    setSize(radius) {
        if (!(radius > 0)) return this;
        const k = radius / this.settings.size;

        // Ядро
        this.core.geometry.dispose();
        this.core.geometry = new THREE.SphereGeometry(radius, 64, 64);

        // Корона
        this.corona.geometry.dispose();
        this.corona.geometry = new THREE.SphereGeometry(radius * 1.35, 48, 48);

        // Гало
        this.halo.scale.setScalar(this.settings.haloScale * radius);

        // Свет
        this.light.distance = this.settings.lightDistance * k;

        this.settings.size = radius;
        return this;
    }

    getSize() {
        return this.settings.size;
    }

    // --------------------------------------------------------------
    //  Цвет
    // --------------------------------------------------------------
    // hex — либо число (0xffcc00), либо THREE.Color
    setColor(color) {
        const c = (color && color.isColor) ? color : new THREE.Color(color);

        // Ядро: саму текстуру не трогаем (её пересоздавать дорого),
        // а подкрашиваем материал — он умножается на текстуру.
        this.core.material.color.copy(c);

        // Корона — тот же цвет, чуть светлее
        this.corona.material.color.copy(c);

        // Гало — тоже
        this.halo.material.color.copy(c);

        // Свет
        this.light.color.copy(c);

        this.settings.color = c.getHex();
        this.settings.haloColor = c.getHex();
        return this;
    }

    // Отдельно — цвет гало/короны, если хочется отличать
    setHaloColor(color) {
        const c = (color && color.isColor) ? color : new THREE.Color(color);
        this.corona.material.color.copy(c);
        this.halo.material.color.copy(c);
        this.settings.haloColor = c.getHex();
        return this;
    }

    // --------------------------------------------------------------
    //  Пульсация / вращение / свет (на лету)
    // --------------------------------------------------------------
    setPulseSpeed(v) {
        this.settings.pulseSpeed = v;
        return this;
    }
    setRotationSpeed(v) {
        this.settings.rotationSpeed = v;
        return this;
    }
    setLightIntensity(v) {
        this.settings.lightIntensity = v;
        return this;
    }
    setLightDistance(v) {
        this.settings.lightDistance = v;
        this.light.distance = v;
        return this;
    }
    setHaloScale(v) {
        this.settings.haloScale = v;
        this.halo.scale.setScalar(v * this.settings.size);
        return this;
    }

    // --------------------------------------------------------------
    //  Видимость
    // --------------------------------------------------------------
    setVisible(v) {
        this.group.visible = !!v;
        return this;
    }

    // --------------------------------------------------------------
    //  Публичные ссылки (совместимость)
    // --------------------------------------------------------------
    get starMesh() { return this.core; }
    get mesh()     { return this.core; }

    // --------------------------------------------------------------
    //  Текстуры
    // --------------------------------------------------------------
    _createSurfaceTexture(w, h, baseColor = 0xfcc200) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Приводим базовый цвет к hex-строке для градиента
        const base = new THREE.Color(baseColor);
        const dark = base.clone().multiplyScalar(0.55).getStyle();
        const mid  = base.clone().getStyle();
        const light = base.clone().lerp(new THREE.Color(0xffffff), 0.6).getStyle();

        // Базовый градиент — от светлого к тёмному
        const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
        baseGrad.addColorStop(0.0, light);
        baseGrad.addColorStop(0.5, mid);
        baseGrad.addColorStop(1.0, dark);
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, w, h);

        // Пятна
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 4 + Math.random() * 28;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const bright = Math.random() > 0.5;
            g.addColorStop(0, bright
                ? 'rgba(255,255,220,0.55)'
                : 'rgba(60,20,0,0.35)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Лёгкий шум
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 30;
            d[i]     = Math.min(255, Math.max(0, d[i]     + n));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
        }
        ctx.putImageData(img, 0, 0);

        return canvas;
    }

    _createHaloTexture(size, baseColor = 0xffaa00) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        const base = new THREE.Color(baseColor);
        const white = base.clone().lerp(new THREE.Color(0xffffff), 0.7).getStyle();
        const mid   = base.clone().lerp(new THREE.Color(0xffffff), 0.2).getStyle();
        const outer = base.clone().multiplyScalar(0.7).getStyle();

        const g = ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2
        );
        g.addColorStop(0.00, 'rgba(255,255,255,1.0)');
        g.addColorStop(0.15, white);
        g.addColorStop(0.35, mid);
        g.addColorStop(0.65, outer);
        g.addColorStop(1.00, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        return canvas;
    }

    // --------------------------------------------------------------
    //  Анимация
    // --------------------------------------------------------------
    update(dt, elapsed) {
        this._time += dt;

        // 1. Вращение ядра
        this.core.rotation.y += this.settings.rotationSpeed * dt;
        this.core.rotation.x += this.settings.rotationSpeed * 0.3 * dt;

        // 2. Пульсация
        const pulse = 0.5 + 0.5 * Math.sin(
            this._time * this.settings.pulseSpeed * 2 * Math.PI + this._pulsePhase
        );

        this.light.intensity = this.settings.lightIntensity * (0.85 + pulse * 0.35);
        this.corona.material.opacity = 0.28 + pulse * 0.15;

        const cs = 1.35 + pulse * 0.05;
        this.corona.scale.setScalar(cs);

        // 3. Гало
        if (this.camera) {
            this.halo.quaternion.copy(this.camera.quaternion);
        }
        const haloPulse = 1.0 + pulse * 0.06;
        this.halo.scale.setScalar(
            this.settings.haloScale * this.settings.size * haloPulse
        );
    }

    // --------------------------------------------------------------
    //  Dispose
    // --------------------------------------------------------------
    dispose() {
        this.scene.remove(this.group);

        this.core.geometry.dispose();
        this.core.material.map?.dispose();
        this.core.material.dispose();

        this.corona.geometry.dispose();
        this.corona.material.dispose();

        this.halo.geometry.dispose();
        this.halo.material.map?.dispose();
        this.halo.material.dispose();

        // Свет не имеет собственных GPU-ресурсов, просто уйдёт с группой
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = StarG;
} else {
    window.StarG = StarG;
    window.Star  = StarG;
}