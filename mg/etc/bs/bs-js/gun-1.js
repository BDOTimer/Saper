//  gun-1.js
//  class Gun;
//  class Bullet;
//  class Shell;

import { buildGun } from "./gun.compile.js";

// --------------------------------------------------------
// CLASS: Ружьё — держатель готовой модели из gun.compile.js
// --------------------------------------------------------
//import { buildGun, GUN_PARAMS } from "./gun.compile.js";

class Gun {
  constructor(camera, envMap = null) {
    this.camera = camera;
    this.recoil = 0;

    // 🔫 Собираем ружьё из gun.compile.js
    this.model = buildGun(envMap);

    // Базовая позиция в руках (справа снизу, как в FPS)
    this.model.position.set(0.24, -0.22, -0.30);
    this.model.rotation.y = 0.0;
    this.model.rotation.z = 0.02;

    // Крепим к камере
    camera.add(this.model);
  }

  // Позиция дула в мире (для трассера)
  getMuzzlePosition() {
    const v = new THREE.Vector3(0, 0.03, -1.7);
    this.model.localToWorld(v);
    return v;
  }

  // Точка выброса гильзы (справа сверху на коробке)
  getEjectPosition() {
    const v = new THREE.Vector3(0.02, 0.015, 0.05); //0.020, 0.015, 0.050
    this.model.localToWorld(v);
    return v;
  }

  // Направление выброса гильзы
  getEjectDirection() {
    // Локальная скорость выброса в системе координат ружья:
    //   X — вправо (от игрока)
    //   Y — вверх
    //   Z — чуть вперёд (к дулу)
    const local = new THREE.Vector3(0.7, 8.1, -4.75).normalize();
    // Переводим в мировые координаты через текущую ориентацию ружья
    return local.transformDirection(this.model.matrixWorld);
  }

  fire() {
    this.recoil = 1.0;
    if (window.SNDS && SNDS.shoot) SNDS.shoot.play();
    setTimeout(() => {
      if (window.SNDS && SNDS.dzin) SNDS.dzin.play();
    }, 180);
  }

  update(dt) {
    if (this.recoil > 0) {
      this.recoil -= dt * 6;
      if (this.recoil < 0) this.recoil = 0;
    }
    const r = this.recoil;

    this.model.position.z = -0.30 + r * 0.14;
    this.model.rotation.x = r * 0.22;
    // X и Y — обновляются в Breathing
  }
}

// --------------------------------------------------------
// CLASS: Пуля (трассер)
// --------------------------------------------------------
class Bullet {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.life = 0;
    this.maxLife = 0.18; 
    this.speed = 600;    

    this.start = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.totalDist = 0;
    this.traveled = 0;

    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -0.5);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffdd66, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    const headGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const headMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.visible = false;
    this.scene.add(this.head);

    const sparkGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.spark = new THREE.Mesh(sparkGeo, sparkMat);
    this.spark.visible = false;
    this.scene.add(this.spark);
  }

  fire(start, end) {
    this.start.copy(start);
    this.end.copy(end);
    this.dir.subVectors(end, start);
    this.totalDist = this.dir.length();
    if (this.totalDist < 0.001) return;
    this.dir.normalize();
    this.traveled = 0;
    this.life = 0;
    this.active = true;

    this.mesh.visible = true;
    this.head.visible = true;
    this.mesh.material.opacity = 1;
    this.head.material.opacity = 1;
    this.spark.visible = false;
    this.head.position.copy(start);
  }

  update(dt) {
    if (!this.active) return;

    this.life += dt;
    this.traveled += this.speed * dt;

    const headPos = new THREE.Vector3();
    const progress = Math.min(1, this.traveled / this.totalDist);

    headPos.copy(this.start).addScaledVector(this.dir, this.traveled);
    if (progress >= 1) headPos.copy(this.end);
    this.head.position.copy(headPos);

    const trailLen = Math.min(this.traveled, 6.0); 
    const tailPos = new THREE.Vector3().copy(headPos).addScaledVector(this.dir, -trailLen);

    this.mesh.position.copy(tailPos);
    this.mesh.lookAt(headPos);
    this.mesh.scale.set(1, 1, trailLen);

    const t = this.life / this.maxLife;
    const fade = 1 - t;
    this.mesh.material.opacity = Math.max(0, fade);
    this.head.material.opacity = Math.max(0, fade);

    if (progress >= 1) {
      this.spark.position.copy(this.end);
      this.spark.visible = true;
      const sparkT = Math.min(1, (this.life - this.totalDist / this.speed) / 0.12);
      this.spark.material.opacity = Math.max(0, 1 - sparkT);
      this.spark.scale.setScalar(1 + sparkT * 2);
    }

    if (this.life > this.maxLife) {
      this.active = false;
      this.mesh.visible = false;
      this.head.visible = false;
      this.spark.visible = false;
    }
  }
}

// --------------------------------------------------------
// CLASS: Гильза
// --------------------------------------------------------
class Shell {
  constructor(scene, terrain) {
    this.scene   = scene;
    this.terrain = terrain;
    this.active  = false;
    this.life    = 0;
    this.maxLife = 3.0;
    this.landed  = false;

    this.velocity = new THREE.Vector3();
    this.angularVel = new THREE.Vector3();
    
    const matPlastic = new THREE.MeshStandardMaterial({ 
      color: 0xdd1111, roughness: 0.3, metalness: 0.2 
    });
    const matBrass = new THREE.MeshStandardMaterial({ 
      color: 0xffcc33, roughness: 0.2, metalness: 0.9 
    });

    this.mesh = new THREE.Group();
    
    const bodyGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.08, 8);
    bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, matPlastic);
    body.position.x = -0.01;
    this.mesh.add(body);

    const baseGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8);
    baseGeo.rotateZ(Math.PI / 2);
    const base = new THREE.Mesh(baseGeo, matBrass);
    base.position.x = 0.03;
    this.mesh.add(base);

    this.mesh.visible = false;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  fire(startPos, startVel) {
    this.active = true;
    this.life = 0;
    this.landed = false;
    this.mesh.visible = true;
    this.mesh.position.copy(startPos);
    this.mesh.scale.set(1, 1, 1);
    this.velocity.copy(startVel);
    
    this.angularVel.set(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25
    );
    this.mesh.rotation.set(0, 0, 0);
  }

  update(dt) {
    if (!this.active) return;

    this.life += dt;

    if (!this.landed) {
      this.velocity.y -= 15.0 * dt; 
      this.mesh.position.addScaledVector(this.velocity, dt);
      
      this.mesh.rotation.x += this.angularVel.x * dt;
      this.mesh.rotation.y += this.angularVel.y * dt;
      this.mesh.rotation.z += this.angularVel.z * dt;
      
      const groundY = this.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.03;
      if (this.mesh.position.y <= groundY) {
        this.mesh.position.y = groundY;
        this.landed = true;
        this.velocity.set(0, 0, 0);
        this.angularVel.set(0, 0, 0);
        this.mesh.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0);
        
        if (window.SNDS && SNDS.dzin) SNDS.dzin.play();
      }
    } else {
      if (this.life > this.maxLife - 0.5) {
        const scale = Math.max(0.01, (this.maxLife - this.life) / 0.5);
        this.mesh.scale.set(scale, scale, scale);
      }
    }

    if (this.life > this.maxLife) {
      this.active = false;
      this.mesh.visible = false;
    }
  }
}

const GUN1 =
{   Bullet,
    Gun   ,
    Shell
};

export { GUN1 };