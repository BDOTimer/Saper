//  animals.js
//  class Duck;

// --------------------------------------------------------
// CLASS: Утка
// --------------------------------------------------------
class Duck {
  constructor(scene, terrain, spawnPos, targetPos) {
    this.scene   = scene;
    this.terrain = terrain;
    this.alive = true;
    this.falling = false;
    this.removeMe = false;
    this.fallSpeed = 0;
    this.fallRotSpeed = 0;
    this.life = 0;
    this.wingPhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.buildModel();
    this.group.position.copy(spawnPos);
    this.group.position.y = Math.max(2, spawnPos.y + 2 + Math.random()*2);
    this.scene.add(this.group);

    this.velocity = new THREE.Vector3(
      (Math.random() - 0.3) * 6,
      2 + Math.random() * 3,
      (Math.random() - 0.5) * 6
    );
    this.targetPos = targetPos.clone();
    this.wanderTimer = 0;
  }

  buildModel() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x2a5a3a });
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });

    const bodyGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.5, 0.9, 1);
    this.group.add(body);

    const neckGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8);
    const neck = new THREE.Mesh(neckGeo, headMat);
    neck.position.set(0.35, 0.12, 0);
    neck.rotation.z = -0.5;
    this.group.add(neck);

    const headGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.5, 0.22, 0);
    this.group.add(head);

    const beakGeo = new THREE.ConeGeometry(0.06, 0.2, 6);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.z = -Math.PI/2;
    beak.position.set(0.68, 0.2, 0);
    this.group.add(beak);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(0.55, 0.26, 0.08);
    this.group.add(eye1);
    const eye2 = eye1.clone();
    eye2.position.z = -0.08;
    this.group.add(eye2);

    this.wingL = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.7),
      wingMat
    );
    this.wingL.position.set(0, 0.15, 0.35);
    this.group.add(this.wingL);

    this.wingR = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.7),
      wingMat
    );
    this.wingR.position.set(0, 0.15, -0.35);
    this.group.add(this.wingR);

    const tailGeo = new THREE.ConeGeometry(0.15, 0.3, 6);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.rotation.z = Math.PI/2;
    tail.position.set(-0.45, 0.05, 0);
    this.group.add(tail);

    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  getBoundingBox() {
    return new THREE.Box3().setFromObject(this.group);
  }

  hit() {
    if (!this.alive) return false;
    this.alive = false;
    this.falling = true;
    this.fallSpeed = 2;
    this.fallRotSpeed = (Math.random() - 0.5) * 8;
    if (window.SNDS && SNDS.death) SNDS.death.play();
    return true;
  }

  update(dt) {
    if (this.alive) {
      this.life += dt;
      
      this.wanderTimer += dt;
      if (this.wanderTimer > 1.2) {
        this.wanderTimer = 0;
        this.velocity.x += (Math.random() - 0.5) * 4;
        this.velocity.z += (Math.random() - 0.5) * 4;
        this.velocity.y += Math.random() * 1;
      }
      this.velocity.y -= dt * 1.0; 

      this.group.position.addScaledVector(this.velocity, dt);

      const horiz = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
      if (horiz.lengthSq() > 0.01) {
        this.group.rotation.y = Math.atan2(-this.velocity.z, this.velocity.x);
      }

      this.wingPhase += dt * 18;
      const flap = Math.sin(this.wingPhase) * 0.9;
      this.wingL.rotation.x = flap;
      this.wingR.rotation.x = -flap;

      if (this.group.position.y > 35 || this.group.position.length() > 150) {
        this.removeMe = true;
      }
    } else if (this.falling) {
      this.fallSpeed += dt * 25;
      this.group.position.y -= this.fallSpeed * dt;
      this.group.rotation.x += this.fallRotSpeed * dt;
      this.group.rotation.z += this.fallRotSpeed * 0.7 * dt;

      this.wingL.rotation.x = -1.5;
      this.wingR.rotation.x = 1.5;

      const groundY = this.terrain.getHeightAt(this.group.position.x, this.group.position.z) + 0.3;
      if (this.group.position.y <= groundY) {
        this.group.position.y = groundY;
        this.falling = false;
        setTimeout(() => { this.removeMe = true; }, 800);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (o.material.dispose) o.material.dispose();
      }
    });
  }
}

const ANIMALS =
{   Duck
};

export { ANIMALS };



