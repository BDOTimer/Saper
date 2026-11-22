/* ================================================================
   enemies.js · ПЕПЕЛ-7 — процедурный отряд противников
   • модели собираются в runtime из примитивов (без ассетов)
   • GPU-instancing: 13 частей тела × N врагов = 13 draw call
   • вооружены, ведут бой с укрытиями/стрейфом, стреляют очередями
   • получают урон от игрока (хедшот ×2.6), при смерти ПАДАЮТ
   ================================================================ */
import * as THREE from 'three';

const MAXE = 18, MAXMED = 10, MAXFLASH = 14, MAXTR = 26;
const XAX = new THREE.Vector3(1, 0, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

/* ---------- геометрия с запечённым тонированием ---------- */
function pushGeo(P, N, C, g, m, shade) {
  const gg = g.index ? g.toNonIndexed() : g;
  const pa = gg.attributes.position, na = gg.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(m);
    P.push(v.x, v.y, v.z);
    n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
    N.push(n.x, n.y, n.z);
    const f = (n.y > .9 ? 1.14 : n.y < -.9 ? .52 : Math.abs(n.x) > .9 ? .88 : 1) * shade;
    C.push(f, f, f);
  }
  if (gg !== g) gg.dispose();
  g.dispose();
}
function build(parts) {
  const P = [], N = [], C = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const p of parts) {
    e.set(p.rx || 0, p.ry || 0, p.rz || 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0), q, ONE);
    pushGeo(P, N, C, p.g, m, p.s === undefined ? 1 : p.s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s, 1);

function rifleGeo() {
  return build([
    { g: box(.06, .09, .34), z: -.05, s: 1 },
    { g: box(.032, .032, .30), y: .012, z: -.34, s: .92 },
    { g: box(.055, .06, .17), y: -.004, z: -.23, s: .74 },
    { g: box(.045, .13, .07), y: -.095, z: -.06, rx: .22, s: .85 },
    { g: box(.05, .08, .18), y: -.012, z: .19, s: .78 },
    { g: box(.012, .045, .012), y: .062, z: -.30, s: 1.1 },
    { g: box(.05, .022, .05), y: .056, z: -.02, s: 1.05 }
  ]);
}

/* ---------- варианты противников ---------- */
const VARIANTS = [
  { key: 'scav', hp: 80, speed: 2.35, pref: 13, cloth: 0x6d6450, vest: 0x4b463d, skin: 0xa8836a, helm: 0, scale: .97 },
  { key: 'raider', hp: 105, speed: 2.85, pref: 11, cloth: 0x7a4a38, vest: 0x3b3730, skin: 0x9c7a62, helm: 0, scale: 1.0 },
  { key: 'heavy', hp: 155, speed: 2.05, pref: 16, cloth: 0x49514f, vest: 0x2f3a3e, skin: 0x8f7358, helm: 1, scale: 1.1 }
];
const DIFF = {
  recon: { dmg: 6, acc: .30, rate: 2.7, speed: .88, count: .75, hp: .85, conc: 8 },
  assault: { dmg: 9, acc: .43, rate: 2.05, speed: 1, count: 1, hp: 1, conc: 11 },
  veteran: { dmg: 13, acc: .56, rate: 1.5, speed: 1.14, count: 1.3, hp: 1.2, conc: 14 }
};
const WAVES = 5;

/* ================================================================ */
export function createEnemySystem(ctx) {
  const W = () => ctx.world;
  const group = new THREE.Group(); group.name = 'Enemies';
  ctx.scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .87, metalness: .06 });
  const gunMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .62 });
  ctx.setupMaterial(bodyMat); ctx.setupMaterial(gunMat);

  /* --- части тела --- */
  const L1A = .30, L2A = .28, L1L = .44, L2L = .42;
  const geos = {
    pelvis: build([{ g: box(.34, .26, .22) }]),
    torso: build([{ g: box(.44, .48, .26) }, { g: box(.30, .30, .15), z: .20, s: .8 }, { g: box(.46, .12, .28), y: .16, s: 1.05 }]),
    head: build([{ g: box(.22, .25, .23) }, { g: box(.24, .09, .06), y: -.02, z: -.11, s: .7 }]),
    helmet: build([{ g: box(.28, .14, .29) }, { g: box(.30, .05, .10), y: -.05, z: -.11, s: .85 }]),
    armUp: build([{ g: cyl(.068, .078, L1A, 6) }]),
    armLo: build([{ g: cyl(.058, .066, L2A, 6) }, { g: box(.09, .09, .10), y: -L2A / 2 - .02, s: .9 }]),
    thigh: build([{ g: cyl(.088, .10, L1L, 6) }]),
    shin: build([{ g: cyl(.072, .086, L2L, 6) }, { g: box(.14, .10, .26), y: -L2L / 2 - .04, z: -.04, s: .7 }]),
    rifle: rifleGeo()
  };
  const PARTS = [
    ['pelvis', geos.pelvis, bodyMat, true, 'vest'],
    ['torso', geos.torso, bodyMat, true, 'cloth'],
    ['head', geos.head, bodyMat, true, 'skin'],
    ['helmet', geos.helmet, bodyMat, false, 'vest'],
    ['armUpL', geos.armUp, bodyMat, false, 'cloth'],
    ['armUpR', geos.armUp, bodyMat, false, 'cloth'],
    ['armLoL', geos.armLo, bodyMat, false, 'skin'],
    ['armLoR', geos.armLo, bodyMat, false, 'skin'],
    ['thighL', geos.thigh, bodyMat, true, 'cloth'],
    ['thighR', geos.thigh, bodyMat, true, 'cloth'],
    ['shinL', geos.shin, bodyMat, true, 'vest'],
    ['shinR', geos.shin, bodyMat, true, 'vest'],
    ['rifle', geos.rifle, gunMat, true, 'gun']
  ];
  const meshes = {};
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const [key, g, mat, cast] of PARTS) {
    const m = new THREE.InstancedMesh(g, mat, MAXE);
    m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAXE; i++) m.setMatrixAt(i, zero);
    m.instanceMatrix.needsUpdate = true;
    group.add(m); meshes[key] = m;
  }

  /* --- полоски здоровья (билборд-инстансы) --- */
  const barGeo = new THREE.PlaneGeometry(.72, .10);
  const barHP = new THREE.InstancedBufferAttribute(new Float32Array(MAXE), 1).setUsage(THREE.DynamicDrawUsage);
  const barA = new THREE.InstancedBufferAttribute(new Float32Array(MAXE), 1).setUsage(THREE.DynamicDrawUsage);
  barGeo.setAttribute('aHP', barHP); barGeo.setAttribute('aA', barA);
  const barMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    vertexShader: `attribute float aHP,aA;varying vec2 vU;varying float vH,vA;
      void main(){vU=uv;vH=aHP;vA=aA;
        vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
        float sc=length(vec3(instanceMatrix[0][0],instanceMatrix[0][1],instanceMatrix[0][2]));
        vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        vec4 mv=viewMatrix*vec4(ip+(r*position.x+u*position.y)*sc,1.);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec2 vU;varying float vH,vA;
      void main(){
        float inner=step(.10,vU.y)*step(vU.y,.90)*step(.02,vU.x)*step(vU.x,.98);
        float fill=step(vU.x,.02+.96*vH);
        vec3 fc=mix(vec3(1.,.22,.14),vec3(1.,.74,.24),vH);
        vec3 col=mix(vec3(.05,.04,.03),mix(vec3(.12,.10,.08),fc,fill),inner);
        float a=vA*(.35+.65*inner);
        if(a<.01)discard;
        gl_FragColor=vec4(col,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const bars = new THREE.InstancedMesh(barGeo, barMat, MAXE);
  bars.frustumCulled = false; bars.renderOrder = 6; group.add(bars);
  for (let i = 0; i < MAXE; i++) bars.setMatrixAt(i, zero);

  /* --- вспышки выстрелов --- */
  const flGeo = new THREE.PlaneGeometry(1, 1);
  const flA = new THREE.InstancedBufferAttribute(new Float32Array(MAXFLASH), 1).setUsage(THREE.DynamicDrawUsage);
  const flR = new THREE.InstancedBufferAttribute(new Float32Array(MAXFLASH), 1).setUsage(THREE.DynamicDrawUsage);
  flGeo.setAttribute('aA', flA); flGeo.setAttribute('aR', flR);
  const flMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aA,aR;varying vec2 vU;varying float vA;
      void main(){vU=uv;vA=aA;
        vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
        float sc=length(vec3(instanceMatrix[0][0],instanceMatrix[0][1],instanceMatrix[0][2]));
        vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        float c=cos(aR),s=sin(aR);vec2 p=vec2(position.x*c-position.y*s,position.x*s+position.y*c);
        vec4 mv=viewMatrix*vec4(ip+(r*p.x+u*p.y)*sc,1.);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec2 vU;varying float vA;
      void main(){vec2 p=vU-.5;float d=length(p);
        float core=1.-smoothstep(0.,.26,d);
        float ang=atan(p.y,p.x);
        float rays=pow(abs(cos(ang*2.)),10.)*(1.-smoothstep(0.,.5,d));
        float a=(core+rays*.75)*vA; if(a<.01)discard;
        gl_FragColor=vec4(vec3(1.,.76,.40)*a*1.8,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const flashes = new THREE.InstancedMesh(flGeo, flMat, MAXFLASH);
  flashes.frustumCulled = false; flashes.renderOrder = 7; group.add(flashes);
  const flState = []; for (let i = 0; i < MAXFLASH; i++) { flState.push({ life: 0 }); flashes.setMatrixAt(i, zero); }
  let flCur = 0;

  /* --- трассеры противника --- */
  const trMat = new THREE.MeshBasicMaterial({ color: 0xff6a34, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(.025, .025, 1), trMat, MAXTR);
  tracers.frustumCulled = false; group.add(tracers);
  const trState = []; for (let i = 0; i < MAXTR; i++) { trState.push({ life: 0 }); tracers.setMatrixAt(i, zero); }
  let trCur = 0;

  /* --- аптечки --- */
  const medGeo = build([
    { g: box(.26, .17, .18), s: 1 },
    { g: box(.16, .045, .005), y: .01, z: -.093, s: 1.6 },
    { g: box(.045, .12, .005), y: .01, z: -.093, s: 1.6 },
    { g: box(.28, .03, .20), y: .09, s: .8 }
  ]);
  const medMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .1, emissive: 0x223311, emissiveIntensity: .35 });
  ctx.setupMaterial(medMat);
  const meds = new THREE.InstancedMesh(medGeo, medMat, MAXMED);
  meds.castShadow = true; meds.frustumCulled = false; group.add(meds);
  const medState = []; for (let i = 0; i < MAXMED; i++) { medState.push({ on: false, x: 0, y: 0, z: 0, t: 0 }); meds.setMatrixAt(i, zero); }
  meds.setColorAt(0, new THREE.Color(0xd8dcc4)); meds.instanceColor.needsUpdate = true;

  /* --- служебный свет выстрелов --- */
  const shotLight = new THREE.PointLight(0xffa855, 0, 12, 2);
  group.add(shotLight);

  /* ---------- пул противников ---------- */
  const pool = [];
  for (let i = 0; i < MAXE; i++) pool.push({
    slot: i, on: false, dead: false, v: VARIANTS[0], hp: 100, maxhp: 100,
    x: 0, y: 0, z: 0, yaw: 0, phase: 0, spawnT: 0, aim: 0, flinch: 0, recoil: 0,
    cool: 0, burst: 0, shotT: 0, los: false, losT: 0, strafe: 1, strafeT: 0,
    fallT: 0, fallDir: 1, fallYaw: 0, corpseT: 0, sink: 0, speed: 2.4, pref: 12
  });

  let diff = DIFF.assault, diffKey = 'assault';
  let running = false, wave = 0, quota = 0, spawned = 0, spawnT = 0, inter = 0, phase = 'idle';
  const stats = { kills: 0, headshots: 0, waves: 0, time: 0 };
  let rngS = 1;
  const rnd = () => { rngS = (rngS * 1664525 + 1013904223) >>> 0; return rngS / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();

  /* ---------- временные матрицы ---------- */
  const mRoot = new THREE.Matrix4(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(),
    mPiv = new THREE.Matrix4(), mElb = new THREE.Matrix4(), mUp = new THREE.Matrix4(),
    mLo = new THREE.Matrix4(), mHand = new THREE.Matrix4(), mOut = new THREE.Matrix4();
  const qA = new THREE.Quaternion(), qRoot = new THREE.Quaternion(), eA = new THREE.Euler();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vMuz = new THREE.Vector3(), vTgt = new THREE.Vector3();
  const cA = new THREE.Color();
  const ZERO = zero;

  function rx(m, a) { qA.setFromAxisAngle(XAX, a); m.compose(vA.set(0, 0, 0), qA, ONE); return m; }
  function tr(m, x, y, z) { m.makeTranslation(x, y, z); return m; }
  function limb(root, ox, oy, oz, swing, bend, l1, l2) {
    mA.compose(vA.set(ox, oy, oz), qA.setFromAxisAngle(XAX, swing), ONE);
    mPiv.multiplyMatrices(root, mA);
    mUp.multiplyMatrices(mPiv, tr(mB, 0, -l1 / 2, 0));
    mA.compose(vA.set(0, -l1, 0), qA.setFromAxisAngle(XAX, bend), ONE);
    mElb.multiplyMatrices(mPiv, mA);
    mLo.multiplyMatrices(mElb, tr(mB, 0, -l2 / 2, 0));
    mHand.multiplyMatrices(mElb, tr(mB, 0, -l2, 0));
  }
  const put = (key, slot, m) => meshes[key].setMatrixAt(slot, m);

  /* ---------- спавн ---------- */
  function findSpot(px, pz) {
    const w = W(); if (!w) return null;
    const half = w.layout.half;
    for (let t = 0; t < 60; t++) {
      const a = rr(0, Math.PI * 2), d = rr(26, 56);
      const x = clamp(px + Math.cos(a) * d, -half + 10, half - 10);
      const z = clamp(pz + Math.sin(a) * d, -half + 10, half - 10);
      if (!w.occ.free(x, z, .7, 1)) continue;
      w.normalAt(x, z, vB); if (vB.y < .82) continue;
      let clash = false;
      for (const e of pool) if (e.on && (e.x - x) ** 2 + (e.z - z) ** 2 < 9) { clash = true; break; }
      if (clash) continue;
      return { x, z };
    }
    return null;
  }
  function spawn() {
    const w = W(); if (!w) return false;
    const p = ctx.player.pos;
    const spot = findSpot(p.x, p.z); if (!spot) return false;
    const e = pool.find(o => !o.on); if (!e) return false;
    const roll = rnd();
    const vi = wave <= 1 ? (roll < .8 ? 0 : 1) : wave <= 3 ? (roll < .45 ? 0 : roll < .85 ? 1 : 2) : (roll < .25 ? 0 : roll < .65 ? 1 : 2);
    const v = VARIANTS[vi];
    e.on = true; e.dead = false; e.v = v;
    e.maxhp = Math.round(v.hp * diff.hp); e.hp = e.maxhp;
    e.x = spot.x; e.z = spot.z; e.y = w.heightAt(spot.x, spot.z);
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z) + Math.PI;
    e.phase = rr(0, 6.28); e.spawnT = 0; e.aim = 0; e.flinch = 0; e.recoil = 0;
    e.cool = rr(.6, 2.0); e.burst = 0; e.shotT = 0; e.los = false; e.losT = rr(0, .25);
    e.strafe = rnd() < .5 ? -1 : 1; e.strafeT = rr(1, 2.6);
    e.fallT = 0; e.corpseT = 0; e.sink = 0; e.fallDir = rnd() < .5 ? -1 : 1; e.fallYaw = rr(-.5, .5);
    e.speed = v.speed * diff.speed; e.pref = v.pref;
    const tint = rr(.85, 1.12);
    for (const [key, , , , role] of PARTS) {
      const hex = role === 'cloth' ? v.cloth : role === 'vest' ? v.vest : role === 'skin' ? v.skin : 0x2b2f35;
      cA.set(hex).multiplyScalar(tint);
      meshes[key].setColorAt(e.slot, cA);
      meshes[key].instanceColor.needsUpdate = true;
    }
    ctx.fx.puff(e.x, e.y, e.z, 6, false);
    spawned++;
    return true;
  }

  /* ---------- выстрел противника ---------- */
  function shoot(e) {
    const cam = ctx.camera.position;
    vMuz.set(0, .012, -.52).applyMatrix4(mOut.set(
      meshes.rifle.matrix ? mRoot : mRoot)); // placeholder, реальный расчёт ниже
    // точная позиция ствола из матрицы оружия слота
    meshes.rifle.getMatrixAt(e.slot, mOut);
    vMuz.set(0, .012, -.52).applyMatrix4(mOut);
    const dist = Math.hypot(cam.x - e.x, cam.z - e.z);
    const moving = ctx.player.speedXZ;
    let chance = diff.acc * clamp(1.15 - dist / 46, .35, 1) * (moving > 5 ? .62 : moving > 1 ? .82 : 1);
    if (e.v.key === 'heavy') chance *= .85;
    const hit = rnd() < chance;
    vTgt.copy(cam);
    if (!hit) { vTgt.x += rr(-1.5, 1.5); vTgt.y += rr(-.9, 1.1); vTgt.z += rr(-1.5, 1.5); }
    else { vTgt.x += rr(-.12, .12); vTgt.y += rr(-.12, .12); vTgt.z += rr(-.12, .12); }
    // трассер
    const ti = trCur; trCur = (trCur + 1) % MAXTR;
    vA.addVectors(vMuz, vTgt).multiplyScalar(.5);
    vB.subVectors(vTgt, vMuz); const len = Math.max(.05, vB.length()); vB.normalize();
    qA.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vB);
    mOut.compose(vA, qA, vA.set(1, 1, len));
    tracers.setMatrixAt(ti, mOut); tracers.instanceMatrix.needsUpdate = true;
    trState[ti].life = .055;
    // вспышка
    const fi = flCur; flCur = (flCur + 1) % MAXFLASH;
    const fs = rr(.34, .5);
    mOut.compose(vMuz, qA.identity(), vA.set(fs, fs, fs));
    flashes.setMatrixAt(fi, mOut); flashes.instanceMatrix.needsUpdate = true;
    flA.array[fi] = 1; flR.array[fi] = rr(0, 6.28); flState[fi].life = .055;
    shotLight.position.copy(vMuz); shotLight.intensity = 9;
    e.recoil = 1;
    ctx.sfx.enemyShot(dist);
    if (hit) ctx.onDamage(Math.round(diff.dmg * rr(.85, 1.15)), e);
  }

  /* ---------- урон по противнику ---------- */
  function damage(e, amount, headshot, point) {
    if (!e.on || e.dead) return null;
    e.hp -= amount; e.flinch = .2; e.aim = Math.max(e.aim, .4);
    ctx.fx.blood(point.x, point.y, point.z, headshot ? 12 : 7);
    ctx.sfx.flesh();
    if (e.hp <= 0) {
      e.dead = true; e.hp = 0; e.fallT = 0; e.corpseT = 0; e.sink = 0;
      e.fallDir = rnd() < .5 ? -1 : 1; e.fallYaw = rr(-.6, .6);
      stats.kills++; if (headshot) stats.headshots++;
      ctx.fx.puff(e.x, e.y, e.z, 8, false);
      ctx.sfx.enemyDeath();
      if (rnd() < (ctx.playerHealth() < 45 ? .5 : .26)) dropMed(e.x, e.z);
      ctx.onKill({ headshot, x: e.x, y: e.y, z: e.z, variant: e.v.key });
      return { killed: true, headshot, damage: amount };
    }
    return { killed: false, headshot, damage: amount };
  }
  function dropMed(x, z) {
    const w = W(); if (!w) return;
    const m = medState.find(o => !o.on); if (!m) return;
    m.on = true; m.x = x; m.z = z; m.y = w.heightAt(x, z) + .22; m.t = 0;
  }

  /* ---------- рейкаст игрока ---------- */
  function slab(o, d, mnx, mny, mnz, mxx, mxy, mxz, maxT) {
    let tmin = 0, tmax = maxT;
    const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z], mn = [mnx, mny, mnz], mx = [mxx, mxy, mxz];
    for (let i = 0; i < 3; i++) {
      const inv = 1 / (Math.abs(da[i]) < 1e-9 ? (da[i] < 0 ? -1e-9 : 1e-9) : da[i]);
      let t1 = (mn[i] - oa[i]) * inv, t2 = (mx[i] - oa[i]) * inv;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    return tmin > 0 ? tmin : -1;
  }
  function raycast(o, d, maxDist) {
    let best = null, bt = maxDist;
    for (const e of pool) {
      if (!e.on || e.dead) continue;
      const s = e.v.scale;
      const th = slab(o, d, e.x - .15 * s, e.y + 1.47 * s, e.z - .15 * s, e.x + .15 * s, e.y + 1.82 * s, e.z + .15 * s, bt);
      const tb = slab(o, d, e.x - .31 * s, e.y + .05, e.z - .27 * s, e.x + .31 * s, e.y + 1.50 * s, e.z + .27 * s, bt);
      let t = -1, head = false;
      if (th >= 0 && (tb < 0 || th < tb)) { t = th; head = true; } else if (tb >= 0) t = tb;
      if (t >= 0 && t < bt) { bt = t; best = { t, enemy: e, headshot: head, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }; }
    }
    return best;
  }

  /* ---------- ИИ + анимация ---------- */
  function update(dt) {
    const w = W(); if (!w) return;
    const p = ctx.player.pos, cam = ctx.camera.position;
    if (running) stats.time += dt;

    /* волны */
    if (running) {
      if (phase === 'fight') {
        spawnT -= dt;
        const alive = pool.filter(e => e.on && !e.dead).length;
        if (spawned < quota && alive < diff.conc && spawnT <= 0) { if (spawn()) spawnT = .75; else spawnT = .4; }
        if (spawned >= quota && alive === 0) {
          stats.waves = wave;
          if (wave >= WAVES) { running = false; phase = 'done'; ctx.onVictory(getStats()); }
          else { phase = 'inter'; inter = 5.5; ctx.onWave({ cleared: wave, next: wave + 1, total: WAVES }); }
        }
      } else if (phase === 'inter') {
        inter -= dt;
        if (inter <= 0) beginWave(wave + 1);
      }
    }

    /* аптечки */
    let medDirty = false;
    for (let i = 0; i < MAXMED; i++) {
      const m = medState[i];
      if (!m.on) { meds.setMatrixAt(i, ZERO); continue; }
      m.t += dt;
      const dx = m.x - p.x, dz = m.z - p.z;
      if (dx * dx + dz * dz < 1.7 && Math.abs(m.y - p.y) < 2.2) {
        m.on = false; meds.setMatrixAt(i, ZERO); medDirty = true;
        ctx.sfx.pickup(); ctx.onPickup(30); ctx.fx.puff(m.x, m.y, m.z, 5, false);
        continue;
      }
      if (m.t > 45) { m.on = false; meds.setMatrixAt(i, ZERO); medDirty = true; continue; }
      eA.set(0, m.t * 1.3, 0); qA.setFromEuler(eA);
      mOut.compose(vA.set(m.x, m.y + Math.sin(m.t * 2.2) * .07, m.z), qA, ONE);
      meds.setMatrixAt(i, mOut); medDirty = true;
    }
    if (medDirty) meds.instanceMatrix.needsUpdate = true;

    /* вспышки/трассеры */
    for (let i = 0; i < MAXFLASH; i++) {
      const f = flState[i];
      if (f.life > 0) { f.life -= dt; flA.array[i] = Math.max(0, f.life / .055); if (f.life <= 0) flashes.setMatrixAt(i, ZERO); }
      else flA.array[i] = 0;
    }
    flA.needsUpdate = true; flR.needsUpdate = true; flashes.instanceMatrix.needsUpdate = true;
    let trDirty = false;
    for (let i = 0; i < MAXTR; i++) {
      const t = trState[i];
      if (t.life > 0) { t.life -= dt; if (t.life <= 0) { tracers.setMatrixAt(i, ZERO); trDirty = true; } }
    }
    if (trDirty) tracers.instanceMatrix.needsUpdate = true;
    shotLight.intensity *= Math.exp(-20 * dt);

    /* противники */
    for (const e of pool) {
      const s = e.slot;
      if (!e.on) { for (const [key] of PARTS) put(key, s, ZERO); barA.array[s] = 0; bars.setMatrixAt(s, ZERO); continue; }

      const dx = p.x - e.x, dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);

      if (e.dead) {
        e.fallT = Math.min(1, e.fallT + dt / .62);
        e.corpseT += dt;
        if (e.corpseT > 24) { e.sink += dt * .55; if (e.sink > 1.8) { e.on = false; } }
        barA.array[s] = 0; bars.setMatrixAt(s, ZERO);
      } else {
        e.spawnT = Math.min(1, e.spawnT + dt / .35);
        e.flinch = Math.max(0, e.flinch - dt);
        e.recoil *= Math.exp(-9 * dt);
        e.losT -= dt;
        if (e.losT <= 0) {
          e.losT = .22 + rnd() * .12;
          vA.set(e.x, e.y + 1.42, e.z);
          e.los = !ctx.losBlocked(vA, cam);
        }
        /* перемещение */
        let mx = 0, mz = 0;
        const want = e.los ? (dist > e.pref ? 1 : dist < e.pref * .55 ? -1 : 0) : 1;
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        if (want !== 0) { mx = nx * want; mz = nz * want; }
        else {
          e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rr(1.2, 2.8); }
          mx = -nz * e.strafe; mz = nx * e.strafe;
        }
        if (e.flinch > 0) { mx *= .25; mz *= .25; }
        /* разделение */
        for (const o of pool) {
          if (o === e || !o.on || o.dead) continue;
          const ox = e.x - o.x, oz = e.z - o.z, d2 = ox * ox + oz * oz;
          if (d2 < 2.6 && d2 > .0001) { const d = Math.sqrt(d2); mx += ox / d * .8; mz += oz / d * .8; }
        }
        const ml = Math.hypot(mx, mz);
        if (ml > .01) {
          mx /= ml; mz /= ml;
          const step = e.speed * dt * (e.aim > .6 ? .55 : 1);
          let ok = false;
          for (const ang of [0, .6, -.6, 1.2, -1.2, 2.0, -2.0]) {
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const tx = mx * ca - mz * sa, tz = mx * sa + mz * ca;
            const px2 = e.x + tx * step * 3, pz2 = e.z + tz * step * 3;
            if (Math.abs(px2) > w.layout.half - 7 || Math.abs(pz2) > w.layout.half - 7) continue;
            if (!w.occ.free(px2, pz2, .45, 1)) continue;
            w.normalAt(px2, pz2, vB); if (vB.y < .74) continue;
            e.x += tx * step; e.z += tz * step; ok = true; break;
          }
          if (ok) e.phase += e.speed * dt * 2.3;
        } else e.phase += dt * .6;
        e.y = w.heightAt(e.x, e.z);
        /* поворот к игроку */
        const wantYaw = Math.atan2(-dx, -dz);
        let dy = wantYaw - e.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        e.yaw += dy * Math.min(1, dt * 7);
        /* атака */
        const canShoot = e.los && dist < 44 && e.spawnT >= 1;
        e.aim = lerp(e.aim, canShoot ? 1 : 0, 1 - Math.exp(-6 * dt));
        if (e.burst > 0) {
          e.shotT -= dt;
          if (e.shotT <= 0) { writeSkeleton(e, 0); shoot(e); e.burst--; e.shotT = .115; if (e.burst === 0) e.cool = diff.rate * rr(.75, 1.35); }
        } else if (canShoot) {
          e.cool -= dt;
          if (e.cool <= 0 && e.aim > .72) { e.burst = e.v.key === 'heavy' ? 5 : 3; e.shotT = 0; }
        }
        /* полоска здоровья */
        const showBar = dist < 46 && e.spawnT > .5;
        barHP.array[s] = clamp(e.hp / e.maxhp, 0, 1);
        barA.array[s] = showBar ? clamp(1 - (dist - 34) / 12, 0, 1) * .95 : 0;
        mOut.compose(vA.set(e.x, e.y + 2.02 * e.v.scale, e.z), qA.identity(), vA.set(1, 1, 1));
        bars.setMatrixAt(s, mOut);
      }
      writeSkeleton(e, dt);
    }
    for (const [key] of PARTS) meshes[key].instanceMatrix.needsUpdate = true;
    bars.instanceMatrix.needsUpdate = true; barHP.needsUpdate = true; barA.needsUpdate = true;
  }

  /* ---------- скелет → матрицы инстансов ---------- */
  function writeSkeleton(e, dt) {
    const s = e.slot, sc = e.v.scale;
    const grow = e.dead ? 1 : ease(e.spawnT);
    const fall = ease(e.fallT);
    const tilt = fall * Math.PI * .5 * e.fallDir;
    const lift = Math.sin(fall * Math.PI) * .16 + fall * .17 - e.sink;
    const collapse = e.dead ? Math.sin(Math.min(1, e.fallT * 2.2) * Math.PI) * .5 : 0;
    eA.set(tilt, e.yaw + fall * e.fallYaw, fall * .22 * e.fallDir, 'YXZ');
    qRoot.setFromEuler(eA);
    mRoot.compose(vA.set(e.x, e.y + lift, e.z), qRoot, vB.set(sc * grow, sc * grow, sc * grow));

    const walk = Math.sin(e.phase), walk2 = Math.cos(e.phase);
    const aim = e.aim;
    const bob = e.dead ? 0 : Math.abs(Math.sin(e.phase)) * .035;
    const flinch = e.flinch > 0 ? Math.sin(e.flinch * 40) * .06 : 0;

    /* таз / торс / голова */
    mOut.multiplyMatrices(mRoot, tr(mA, 0, .94 + bob - collapse * .18, 0)); put('pelvis', s, mOut);
    mA.compose(vA.set(0, 1.30 + bob - collapse * .22, 0), qA.setFromAxisAngle(XAX, aim * .12 + flinch + fall * .25), ONE);
    mOut.multiplyMatrices(mRoot, mA); put('torso', s, mOut);
    mA.compose(vA.set(0, 1.63 + bob - collapse * .24, -.01), qA.setFromAxisAngle(XAX, aim * -.1 + flinch * 1.6), ONE);
    mOut.multiplyMatrices(mRoot, mA); put('head', s, mOut);
    if (e.v.helm) {
      mA.compose(vA.set(0, 1.755 + bob - collapse * .24, 0), qA.setFromAxisAngle(XAX, aim * -.1), ONE);
      mOut.multiplyMatrices(mRoot, mA); put('helmet', s, mOut);
    } else put('helmet', s, ZERO);

    /* ноги */
    const legA = e.dead ? collapse * .9 : walk * .55 * (1 - aim * .35);
    const legB = e.dead ? collapse * .7 : -walk * .55 * (1 - aim * .35);
    const kneeA = e.dead ? -collapse * 1.2 : -Math.max(0, walk) * .8 - .06;
    const kneeB = e.dead ? -collapse * 1.0 : -Math.max(0, -walk) * .8 - .06;
    limb(mRoot, -.115, .90 + bob - collapse * .18, 0, legA, kneeA, L1L, L2L);
    put('thighL', s, mUp); put('shinL', s, mLo);
    limb(mRoot, .115, .90 + bob - collapse * .18, 0, legB, kneeB, L1L, L2L);
    put('thighR', s, mUp); put('shinR', s, mLo);

    /* руки */
    const swingR = e.dead ? -.5 - collapse : lerp(-walk * .42, 1.36, aim) - e.recoil * .18;
    const swingL = e.dead ? -.35 - collapse : lerp(walk * .42, 1.24, aim);
    const bendR = e.dead ? -.7 : lerp(-.35, .16, aim) + e.recoil * .22;
    const bendL = e.dead ? -.9 : lerp(-.35, .42, aim);
    const shY = 1.44 + bob - collapse * .22;
    limb(mRoot, -.265, shY, 0, swingL, bendL, L1A, L2A);
    put('armUpL', s, mUp); put('armLoL', s, mLo);
    limb(mRoot, .265, shY, 0, swingR, bendR, L1A, L2A);
    put('armUpR', s, mUp); put('armLoR', s, mLo);

    /* оружие в правой руке, ствол горизонтально */
    mA.compose(vA.set(.02, -.04, -.06), qA.setFromAxisAngle(XAX, -(swingR + bendR)), ONE);
    mOut.multiplyMatrices(mHand, mA);
    put('rifle', s, mOut);
  }

  /* ---------- волны / управление ---------- */
  function beginWave(n) {
    wave = n; phase = 'fight';
    quota = Math.max(3, Math.round((3 + n * 1.7) * diff.count));
    spawned = 0; spawnT = .3;
    ctx.onWave({ started: n, total: WAVES, quota });
    ctx.sfx.waveStart();
  }
  function start(key) {
    if (key && DIFF[key]) { diffKey = key; diff = DIFF[key]; }
    clearAll();
    rngS = (Math.random() * 4294967295) >>> 0;
    stats.kills = 0; stats.headshots = 0; stats.waves = 0; stats.time = 0;
    running = true; beginWave(1);
  }
  function clearAll() {
    for (const e of pool) { e.on = false; e.dead = false; for (const [key] of PARTS) put(key, e.slot, ZERO); bars.setMatrixAt(e.slot, ZERO); barA.array[e.slot] = 0; }
    for (const [key] of PARTS) meshes[key].instanceMatrix.needsUpdate = true;
    for (let i = 0; i < MAXMED; i++) { medState[i].on = false; meds.setMatrixAt(i, ZERO); }
    meds.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < MAXTR; i++) { trState[i].life = 0; tracers.setMatrixAt(i, ZERO); }
    tracers.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < MAXFLASH; i++) { flState[i].life = 0; flA.array[i] = 0; flashes.setMatrixAt(i, ZERO); }
    flashes.instanceMatrix.needsUpdate = true; flA.needsUpdate = true;
    bars.instanceMatrix.needsUpdate = true; barA.needsUpdate = true;
    running = false; phase = 'idle'; wave = 0; quota = 0; spawned = 0;
  }
  function getStats() {
    return { kills: stats.kills, headshots: stats.headshots, wave, waves: WAVES, time: stats.time };
  }
  function status() {
    const alive = pool.filter(e => e.on && !e.dead).length;
    return {
      running, phase, wave, total: WAVES, alive,
      left: Math.max(0, quota - spawned) + alive,
      inter: Math.max(0, inter), kills: stats.kills, headshots: stats.headshots, time: stats.time
    };
  }
  function dispose() {
    clearAll();
    ctx.scene.remove(group);
    for (const k in geos) geos[k].dispose();
    barGeo.dispose(); flGeo.dispose(); medGeo.dispose();
    tracers.geometry.dispose();
    bodyMat.dispose(); gunMat.dispose(); barMat.dispose(); flMat.dispose(); trMat.dispose(); medMat.dispose();
  }

  return {
    group, start, update, raycast, damage, status, getStats, dispose,
    reset: clearAll,
    setDifficulty(k) { if (DIFF[k]) { diffKey = k; diff = DIFF[k]; } },
    get difficulty() { return diffKey; },
    get aliveCount() { return pool.filter(e => e.on && !e.dead).length; }
  };
}