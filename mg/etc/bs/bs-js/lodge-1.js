// lodge-1.js


// --------------------------------------------------------
// CLASS: Домик лесника
// --------------------------------------------------------
class Lodge {
  constructor(scene, terrain,  x, z) {
    this.scene   = scene;
    this.terrain = terrain;
    this.x = x;
    this.z = z;
    this.group = new THREE.Group();
    this.smokeParticles = [];
    this.build();
  }

  build() {
    const yBase = this.terrain.getHeightAt(this.x, this.z);
    this.group.position.set(this.x, yBase, this.z);

    // ================================================
    // МАТЕРИАЛЫ
    // ================================================
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x6b4423, roughness: 0.85, metalness: 0.05
    });
    const logDarkMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f18, roughness: 0.9, metalness: 0.05
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x3a2518, roughness: 0.95, metalness: 0.02
    });
    const roofEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0e, roughness: 0.95
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x7a7a72, roughness: 0.95, metalness: 0.05
    });
    const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcc55 });
    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x3a2518, roughness: 0.9
    });
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5a3818, roughness: 0.85
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227, roughness: 0.4, metalness: 0.8
    });
    const woodPlankMat = new THREE.MeshStandardMaterial({
      color: 0x7a5a2a, roughness: 0.9
    });

    // ================================================
    // РАЗМЕРЫ ДОМИКА
    // ================================================
    const W = 7.0;        // ширина
    const D = 6.0;        // глубина
    const H = 4.0;        // высота стен
    const logR = 0.25;    // радиус бревна
    const logStep = 0.5;  // шаг между брёвнами

    // ================================================
    // ФУНДАМЕНТ (беловатый, уходит в землю)
    // ================================================
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x607080,       // беловато-серый, как бутовый камень
      roughness: 0.95,
      metalness: 0.02
    });

    // Высота: 0.7 м над землёй + 1.5 м в землю = 2.2 м всего
    const foundationTopVisible = 0.9;  // сколько торчит над землёй
    const foundationIntoGround = 2.0;  // сколько уходит в землю
    const foundationHeight = foundationTopVisible + foundationIntoGround;

    // Позиция: центр фундамента ниже поверхности, чтобы нижняя часть была в земле
    const foundationCenterY = foundationTopVisible - foundationHeight / 2;

    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.6, foundationHeight, D + 0.6),
      foundationMat
    );
    foundation.position.set(0, foundationCenterY, 0);
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    this.group.add(foundation);

    // --- Камни-булыжники на видимой части фундамента (декор) ---
    // Только в верхней зоне, чтобы они не торчали из-под земли
    for (let i = 0; i < 28; i++) {
      const rockR = 0.12 + Math.random() * 0.12;
      const rockGeo = new THREE.DodecahedronGeometry(rockR);
      const rock = new THREE.Mesh(rockGeo, foundationMat);
      
      // Сторона: перед / зад / лево / право
      const side = Math.floor(Math.random() * 4);
      let rx, rz;
      if (side === 0) {         // перед
        rx = (Math.random() - 0.5) * (W + 0.4);
        rz = (D/2 + 0.25) + (Math.random() - 0.5) * 0.1;
      } else if (side === 1) {  // зад
        rx = (Math.random() - 0.5) * (W + 0.4);
        rz = -(D/2 + 0.25) + (Math.random() - 0.5) * 0.1;
      } else if (side === 2) {  // право
        rx = (W/2 + 0.25) + (Math.random() - 0.5) * 0.1;
        rz = (Math.random() - 0.5) * (D + 0.4);
      } else {                  // лево
        rx = -(W/2 + 0.25) + (Math.random() - 0.5) * 0.1;
        rz = (Math.random() - 0.5) * (D + 0.4);
      }
      
      // Видимая часть — от низа (y=0) до верха фундамента (y=foundationTopVisible)
      rock.position.set(
        rx,
        0.05 + Math.random() * foundationTopVisible,
        rz
      );
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      this.group.add(rock);
    }

    // ================================================
    // СРУБ — стены из брёвен
    // ================================================
    const logRows = Math.floor(H / logStep);

    // --- Передняя и задняя стены ---
    for (let row = 0; row < logRows; row++) {
      const y = 0.6 + row * logStep;
      
      // Передняя стена (Z = +D/2)
      const logFront = new THREE.Mesh(
        new THREE.CylinderGeometry(logR, logR, W, 8),
        row % 2 === 0 ? logMat : logDarkMat
      );
      logFront.rotation.z = Math.PI / 2;
      logFront.position.set(0, y, D/2 - logR);
      logFront.castShadow = true;
      this.group.add(logFront);

      // Задняя стена (Z = -D/2)
      const logBack = logFront.clone();
      logBack.position.set(0, y, -D/2 + logR);
      this.group.add(logBack);
    }

    // --- Левая и правая стены (короче, чтобы не пересекались в углах) ---
    for (let row = 0; row < logRows; row++) {
      const y = 0.6 + row * logStep + logStep/2; // сдвиг на пол-бревна
      
      // Правая стена (X = +W/2)
      const logRight = new THREE.Mesh(
        new THREE.CylinderGeometry(logR, logR, D - 4*logR, 8),
        row % 2 === 0 ? logDarkMat : logMat
      );
      logRight.rotation.x = Math.PI / 2;
      logRight.position.set(W/2 - logR, y, 0);
      logRight.castShadow = true;
      this.group.add(logRight);

      // Левая стена (X = -W/2)
      const logLeft = logRight.clone();
      logLeft.position.set(-W/2 + logR, y, 0);
      this.group.add(logLeft);
    }

    // ================================================
    // ДВЕРЬ (на передней стене, справа)
    // ================================================
    const doorW = 1.0;
    const doorH = 2.0;
    const doorX = W/2 - 1.5;
    
    // Проём (тёмный прямоугольник — невидимый, но даёт визуальную тень)
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.15, doorH + 0.15, 0.1),
      windowFrameMat
    );
    doorFrame.position.set(doorX, 0.6 + doorH/2, D/2 + 0.01);
    this.group.add(doorFrame);

    // Сама дверь
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, doorH, 0.12),
      doorMat
    );
    door.position.set(doorX, 0.6 + doorH/2, D/2 + 0.05);
    door.castShadow = true;
    this.group.add(door);

    // Доски на двери (вертикальные линии)
    for (let i = 0; i < 3; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, doorH - 0.1, 0.02),
        logDarkMat
      );
      plank.position.set(
        doorX - doorW/2 + 0.2 + i * 0.3,
        0.6 + doorH/2,
        D/2 + 0.12
      );
      this.group.add(plank);
    }

    // Ручка
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      handleMat
    );
    handle.position.set(doorX + doorW/2 - 0.15, 0.6 + doorH/2, D/2 + 0.12);
    this.group.add(handle);

    // ================================================
    // ОКНА (два — слева от двери и на правой стене)
    // ================================================
    const windowW = 0.9;
    const windowH = 0.9;

    // --- Окно на передней стене ---
    this.createWindow(
      -W/2 + 1.5, 0.6 + 1.8, D/2 + 0.02,
      windowW, windowH, 'front', windowFrameMat, windowGlowMat
    );

    // --- Окно на правой стене ---
    this.createWindow(
      W/2 + 0.02, 0.6 + 1.8, 0,
      windowW, windowH, 'right', windowFrameMat, windowGlowMat
    );

    // ================================================
    // КРЫША (двускатная)
    // ================================================
    const roofH = 2.5;
    const roofOverhang = 0.6;

    // Два ската
    const roofGeo = new THREE.BoxGeometry(
      Math.sqrt((W/2 + roofOverhang) * (W/2 + roofOverhang) + roofH * roofH),
      0.15,
      D + roofOverhang * 2
    );

    // Правый скат
    const roofRight = new THREE.Mesh(roofGeo, roofMat);
    roofRight.position.set(W/4, 0.3 + H + roofH/2, 0);
    roofRight.rotation.z = -Math.atan2(roofH, W/2 + roofOverhang);
    roofRight.castShadow = true;
    this.group.add(roofRight);

    // Левый скат
    const roofLeft = new THREE.Mesh(roofGeo, roofMat);
    roofLeft.position.set(-W/4, 0.3 + H + roofH/2, 0);
    roofLeft.rotation.z = Math.atan2(roofH, W/2 + roofOverhang);
    roofLeft.castShadow = true;
    this.group.add(roofLeft);

    // Конёк крыши (верхнее бревно)
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.9, D + roofOverhang * 2, 8),
      roofEdgeMat
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, 0.6 + H + roofH + 0.05, 0);
    ridge.castShadow = true;
    this.group.add(ridge);

    // Франтоны (треугольники на торцах крыши)
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-W/2 - roofOverhang, 0);
      shape.lineTo(W/2 + roofOverhang, 0);
      shape.lineTo(0, roofH);
      shape.lineTo(-W/2 - roofOverhang, 0);
      
      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.1, bevelEnabled: false
      });
      const gable = new THREE.Mesh(extrudeGeo, logDarkMat);
      gable.position.set(0, 0.3 + H, side * (D/2 - 0.05));
      gable.castShadow = true;
      this.group.add(gable);
    }

    // ================================================
    // ТРУБА (на крыше, смещена к левому скату)
    // ================================================
    const chimneyX = -W/4;
    const chimneyBase = 0.6 + H + roofH * 0.7;
    
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 2.5, 0.6),
      stoneMat
    );
    chimney.position.set(chimneyX, chimneyBase + 0.4, 0);
    chimney.castShadow = true;
    this.group.add(chimney);

    // Тёмное отверстие трубы сверху
    const chimneyTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.05, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
    );
    chimneyTop.position.set(chimneyX, chimneyBase + 1.8, 0);
    this.group.add(chimneyTop);

    // ================================================
    // КРЫЛЬЦО (ступеньки перед дверью)
    // ================================================
    const porchSteps = 3;
    for (let i = 0; i < porchSteps; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.2, 0.4),
        woodPlankMat
      );
      step.position.set(
        doorX,
        0.6 - i * 0.2,
        D/2 + 0.3 + i * 0.4
      );
      step.castShadow = true;
      step.receiveShadow = true;
      this.group.add(step);
    }

    // Навес над крыльцом
    const porchRoof = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.1, 1.2),
      roofMat
    );
    porchRoof.position.set(doorX, 0.6 + doorH + 0.4, D/2 + 0.6);
    porchRoof.rotation.x = -0.15;
    porchRoof.castShadow = true;
    this.group.add(porchRoof);

    // Два столбика для навеса
    for (const dx of [-0.7, 0.7]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, doorH + 0.4, 8),
        logDarkMat
      );
      post.position.set(doorX + dx, 0.6 + (doorH + 0.4)/2, D/2 + 1.1);
      post.castShadow = true;
      this.group.add(post);
    }

    // ================================================
    // ПОЛЕННИЦА (рядом с дверью, с учётом рельефа)
    // ================================================
    const woodpileX = doorX - 1.8;
    const woodpileZ = D/2 + 1.0;

    // Высота земли в мировой точке под поленницей
    const woodpileWorldX = this.x + woodpileX;
    const woodpileWorldZ = this.z + woodpileZ;
    const woodpileGroundY = this.terrain.getHeightAt(woodpileWorldX, woodpileWorldZ);

    // Локальная высота (относительно группы домика)
    const woodpileBaseY = woodpileGroundY - this.group.position.y;

    // Параметры поленницы
    const logRadius = 0.15;
    const logLength = 0.8;
    const rowStep = 0.3;   // шаг по высоте (чуть больше диаметра — бревна лежат с зазором)

    for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
        const log = new THREE.Mesh(
            new THREE.CylinderGeometry(logRadius, logRadius, logLength, 8),
            row % 2 === 0 ? logMat : logDarkMat
        );
        log.rotation.x = Math.PI / 2;
        log.position.set(
            woodpileX + (col - 1.5) * 0.32,
            woodpileBaseY + logRadius + row * rowStep,
            woodpileZ
        );
        log.castShadow = true;
        log.receiveShadow = true;
        this.group.add(log);
    }
    }

    // ================================================
    // СКАМЕЙКА возле домика (с учётом рельефа)
    // ================================================
    const benchX = doorX + 1.5;
    const benchZ = D/2 + 1.2;

    // Высота земли в мировых координатах под скамейкой
    const benchWorldX = this.x + benchX;
    const benchWorldZ = this.z + benchZ;
    const benchGroundY = this.terrain.getHeightAt(benchWorldX, benchWorldZ);

    // Переводим в локальные координаты группы (группа стоит на yBase)
    const benchLocalY = benchGroundY - this.group.position.y;

    // Высота сиденья над землёй (стандарт — 0.45 м)
    const seatHeight    = 1.0;
    const seatThickness = 0.1;

    // Сиденье
    const benchSeat = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, seatThickness, 0.4),
        woodPlankMat
    );
    benchSeat.position.set(benchX, benchLocalY + seatHeight, benchZ);
    benchSeat.castShadow = true;
    benchSeat.receiveShadow = true;
    this.group.add(benchSeat);

    // Ножки — от земли до сиденья
    const legHeight = seatHeight - seatThickness / 2;
    for (const dx of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, legHeight, 0.35),
            logDarkMat
        );
        leg.position.set(benchX + dx, benchLocalY + legHeight / 2, benchZ);
        leg.castShadow = true;
        leg.receiveShadow = true;
        this.group.add(leg);
    }

    // ================================================
    // СВЕТ ИЗ ОКНА (point light)
    // ================================================
    const windowLight = new THREE.PointLight(0xffaa44, 0.6, 8);
    windowLight.position.set(-W/2 + 1.5, 0.6 + 1.8, D/2 + 0.5);
    this.group.add(windowLight);

    // ================================================
    // СКРЫТАЯ ЛАМПОЧКА ВНУТРИ (для эффекта "кто-то дома")
    // ================================================
    const insideLight = new THREE.PointLight(0xff8844, 0.3, 6);
    insideLight.position.set(0, 1.5, 0);
    this.group.add(insideLight);

    // ================================================
    // ДЫМ ИЗ ТРУБЫ
    // ================================================
    this.smokeOrigin = new THREE.Vector3(chimneyX, chimneyBase + 2.1, 0);
    this.createSmoke();

    // Всё в тени
    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    
    this.scene.add(this.group);
  }

  createWindow(x, y, z, w, h, face, frameMat, glowMat) {
    // Рама
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.15, h + 0.15, 0.08),
      frameMat
    );
    
    let framePos;
    if (face === 'front') {
      framePos = new THREE.Vector3(x, y, z);
      frame.position.copy(framePos);
    } else if (face === 'right') {
      framePos = new THREE.Vector3(x, y, z);
      frame.position.copy(framePos);
      frame.rotation.y = Math.PI / 2;
    }
    this.group.add(frame);

    // Светящееся стекло
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.05),
      glowMat
    );
    
    if (face === 'front') {
      glow.position.set(x, y, z + 0.05);
    } else if (face === 'right') {
      glow.position.set(x + 0.05, y, z);
      glow.rotation.y = Math.PI / 2;
    }
    this.group.add(glow);

    // Переплёт (крест)
    const barH = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.03, 0.02),
      frameMat
    );
    const barV = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, h, 0.02),
      frameMat
    );
    
    if (face === 'front') {
      barH.position.set(x, y, z + 0.08);
      barV.position.set(x, y, z + 0.08);
    } else if (face === 'right') {
      barH.position.set(x + 0.08, y, z);
      barH.rotation.y = Math.PI / 2;
      barV.position.set(x + 0.08, y, z);
      barV.rotation.y = Math.PI / 2;
    }
    this.group.add(barH);
    this.group.add(barV);
  }

  createSmoke() {
    // Простые частицы дыма — маленькие серые сферы, поднимающиеся вверх
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });

    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.15 + Math.random()*0.1, 6, 6);
      const particle = new THREE.Mesh(geo, smokeMat.clone());
      particle.position.copy(this.smokeOrigin);
      particle.position.y += i * 0.15;
      particle.position.x += (Math.random() - 0.5) * 0.2;
      particle.position.z += (Math.random() - 0.5) * 0.2;
      particle.userData.life = i * 0.3;
      particle.userData.speed = 0.3 + Math.random() * 0.2;
      this.smokeParticles.push(particle);
      this.group.add(particle);
    }
  }

  update(dt) {
    // Анимация дыма
    for (let i = 0; i < this.smokeParticles.length; i++) {
      const p = this.smokeParticles[i];
      p.userData.life += dt;
      
      // Дым поднимается
      p.position.y += p.userData.speed * dt;
      // Немного дрейфует в сторону
      p.position.x += Math.sin(p.userData.life * 2) * dt * 0.2;
      p.position.z += Math.cos(p.userData.life * 1.5) * dt * 0.15;
      
      // Растёт и истончается
      const scale = 1 + p.userData.life * 0.5;
      p.scale.setScalar(scale);
      
      // Прозрачность уменьшается
      p.material.opacity = Math.max(0, 0.5 - p.userData.life * 0.15);
      
      // Если дым "умер" — перезапускаем
      if (p.userData.life > 3.5) {
        p.userData.life = 0;
        p.position.copy(this.smokeOrigin);
        p.position.x += (Math.random() - 0.5) * 0.2;
        p.position.z += (Math.random() - 0.5) * 0.2;
        p.scale.setScalar(1);
        p.material.opacity = 0.5;
      }
    }
  }
}

const HOUSES =
{   Lodge
};

export { HOUSES };