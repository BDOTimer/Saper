// ============================================================
//  Оркестратор генерации мира: рельеф -> кварталы -> пропсы ->
//  свет. Каждый этап разбит на кадры (async/await), чтобы не
//  фризить браузер. Всё детерминировано от seed.
// ============================================================
window.Generator = (function () {

  function frame() {
    return new Promise(function (res) { requestAnimationFrame(res); });
  }

  async function build(seed, scene, onProgress) {
    var T = window.THREE, CFG = window.CFG;
    var noise = window.Noise.create(seed);

    var root = new T.Group(); root.name = 'World';
    scene.add(root);
    var env = new T.Group(); env.name = 'Environment';
    var props = new T.Group(); props.name = 'Props';
    var lig = new T.Group(); lig.name = 'Lighting';
    root.add(env); root.add(props); root.add(lig);

    var grid = new window.GridLib.SpatialGrid(8);
    var claims = new window.GridLib.ClaimGrid(8);

    var ctx = {
      T: T, CFG: CFG, seed: seed, noise: noise, scene: scene,
      env: env, props: props, lig: lig, grid: grid, claims: claims,
      addCollider: function (box, layer) {
        grid.insert({ box: box, layer: layer, mask: window.GridLib.LAYERS.PLAYER }, box);
      },
      heightAt: null, distRoad: null,
      veg: function (x, z) {
        return noise.fbm2(x * 0.02 + 51.3, z * 0.02 - 33.7, 3) * 0.5 + 0.5;
      }
    };

    onProgress('Рельеф, воронки, дороги', 0.02);
    await frame();
    window.Terrain.build(ctx);

    var city = await window.City.build(ctx, function (f) {
      onProgress('Кварталы и руины', 0.16 + f * 0.34);
    });

    onProgress('Природа и обломки', 0.52);
    await frame();
    var pr = await window.Props.build(ctx, city, function (f) {
      onProgress('Природа и обломки', 0.52 + f * 0.33);
    });

    onProgress('Свет и атмосфера', 0.88);
    await frame();
    var light = window.Lighting.build(ctx);

    // статистика геометрии (для debug-панели)
    var tris = 0, meshes = 0;
    root.traverse(function (o) {
      if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        meshes++;
        var base = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        tris += base * (o.isInstancedMesh ? o.count : 1);
      }
    });

    onProgress('Готово', 1);

    var world = {
      seed: seed,
      root: root,
      grid: grid,
      claims: claims,
      light: light,
      heightAt: ctx.heightAt,
      craters: ctx.craters || [],
      buildings: city.buildings,
      grassCells: pr.grassCells,
      stats: { tris: Math.round(tris), meshes: meshes },
      dispose: function () {
        scene.remove(root);
        root.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
        });
        grid.clear();
        claims.clear();
      }
    };
    return world;
  }

  return { build: build };
})();
