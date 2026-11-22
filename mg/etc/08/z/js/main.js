// ============================================================
//  Точка входа: рендерер, сцена, игровой цикл, pointer lock,
//  перегенерация мира (R / меню), debug-панель, LOD-culling травы.
// ============================================================
(function () {
  var T = window.THREE, CFG = window.CFG;
  var app = document.getElementById('app');
  var renderer, scene, camera, clock;
  var world = null, player = null;
  var debugOn = false;
  var frames = 0, fps = 0, fpsT = 0, fpsCnt = 0, statT = 0;
  var lastCalls = 0, lastTris = 0;

  var params = new URLSearchParams(location.search);
  var seed = (parseInt(params.get('seed'), 10) || CFG.seed) >>> 0;

  function initRenderer() {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    window.__R = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.quality.pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = CFG.quality.shadows;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CFG.light.exposure;
    app.appendChild(renderer.domElement);
  }

  function initScene() {
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(CFG.player.fov, window.innerWidth / window.innerHeight, 0.1, 900);
    camera.position.set(CFG.spawn.x, 30, CFG.spawn.z + 40);
    scene.add(camera);
  }

  async function buildWorld(s) {
    if (world) { world.dispose(); world = null; }
    window.HUD.showProgress();
    await new Promise(function (r) { requestAnimationFrame(r); });
    try {
      world = await window.Generator.build(s, scene, function (label, f) {
        window.HUD.progress(label, f);
      });
    } catch (e) {
      window.HUD.toast('Ошибка генерации: ' + e.message);
      console.error(e);
      return;
    }
    if (!player) {
      player = new window.Player({
        camera: camera, dom: renderer.domElement, CFG: CFG,
        getWorld: function () { return world; }
      });
    }
    window.__W = world;
    window.__P = player;
    player.reset();
    window.HUD.setSeed(s);
    window.HUD.showMenu('start');
    window.HUD.toast('Мир сгенерирован · seed ' + s);
  }

  function regen(s) {
    seed = (s >>> 0) || window.RNG.randomSeed();
    buildWorld(seed);
  }

  function cullGrass() {
    if (!world || !player) return;
    var px = player.pos.x, pz = player.pos.z;
    var d2 = CFG.props.grassDist * CFG.props.grassDist;
    var cells = world.grassCells;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var dx = c.x - px, dz = c.z - pz;
      c.mesh.visible = (dx * dx + dz * dz) < d2;
    }
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'F3') {
      e.preventDefault();
      debugOn = !debugOn;
      window.HUD.debug(debugOn);
    }
    if (e.code === 'KeyR' && world && !window.HUD.isVisible()) {
      regen(window.RNG.randomSeed());
    }
  });

  function loop() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    if (player && world) {
      player.update(dt);
      world.light.update(t, player.pos);
      if (window.AudioSys) window.AudioSys.update(dt);
      if (frames % 10 === 0) cullGrass();
    }
    renderer.render(scene, camera);
    lastCalls = renderer.info.render.calls;
    lastTris = renderer.info.render.triangles;

    frames++;
    fpsCnt++;
    fpsT += dt;
    if (fpsT >= 0.5) { fps = Math.round(fpsCnt / fpsT); fpsCnt = 0; fpsT = 0; }
    statT += dt;
    if (debugOn && statT > 0.2 && player && world) {
      statT = 0;
      window.HUD.debugText(
        'FPS: ' + fps +
        '\nXYZ: ' + player.pos.x.toFixed(1) + ' / ' + player.pos.y.toFixed(1) + ' / ' + player.pos.z.toFixed(1) +
        '\nSeed: ' + world.seed +
        '\nDraw calls: ' + lastCalls + '   Треугольники: ' + (world.stats.tris / 1000).toFixed(0) + 'k' +
        '\nМешей: ' + world.stats.meshes +
        '\nКоллайдеры: ' + world.grid.items.length +
        '\nЗахваты: ' + world.claims.count +
        '\nЧанки травы: ' + world.grassCells.length
      );
    }
  }

  window.__tp = function (x, z) {
    if (player && world) {
      player.pos.set(x, world.heightAt(x, z) + 0.1, z);
      player.vel.set(0, 0, 0);
    }
  };

  window.addEventListener('error', function (e) {
    window.HUD.toast('Ошибка: ' + e.message);
  });

  // ---------- запуск ----------
  initRenderer();
  initScene();
  clock = new T.Clock();
  window.HUD.init({
    onPlay: function () {
      window.HUD.hideMenu();
      window.AudioSys.init();
      renderer.domElement.requestPointerLock();
    },
    onSeed: function (s) { regen(s); },
    onRandom: function () { regen(window.RNG.randomSeed()); }
  });
  window.HUD.setSeed(seed);
  buildWorld(seed);
  renderer.setAnimationLoop(loop);

  // повторный вход по клику, если pointer lock снялся кликом мимо меню
  renderer.domElement.addEventListener('click', function () {
    if (world && !window.HUD.isVisible() && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', function () {
    if (document.pointerLockElement !== renderer.domElement && world && !window.HUD.isVisible()) {
      window.HUD.showMenu('pause');
    }
  });
})();
