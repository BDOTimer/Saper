// ============================================================
//  Свет и атмосфера: закатное солнце (2 каскада теней PCFSoft),
//  hemisphere-заполнение, шейдерное небо с солнечным диском,
//  псевдообъёмные лучи в проёмах улиц, пыль в воздухе (шейдер),
//  экспоненциальный туман. Каскады следуют за игроком со
//  привязкой к текселю (без «шейдера» теней при движении).
// ============================================================
window.Lighting = (function () {

  function makeDust(T, L) {
    var n = L.dustCount;
    var g = new T.BufferGeometry();
    var pos = new Float32Array(n * 3), seeds = new Float32Array(n);
    var r = window.RNG.mulberry32(0xD057);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 70;
      pos[i * 3 + 1] = r() * 14 - 2;
      pos[i * 3 + 2] = (r() - 0.5) * 70;
      seeds[i] = r();
    }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new T.BufferAttribute(seeds, 1));
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new T.Color(0xc4ad92) } },
      vertexShader: [
        'attribute float aSeed; uniform float uTime; varying float vF;',
        'void main(){',
        '  vec3 p = position;',
        '  p.x += sin(uTime*0.22 + aSeed*31.0)*1.8;',
        '  p.y += sin(uTime*0.16 + aSeed*57.0)*1.1;',
        '  p.z += cos(uTime*0.19 + aSeed*43.0)*1.8;',
        '  vec4 mv = modelViewMatrix*vec4(p,1.0);',
        '  float d = max(0.1,-mv.z);',
        '  vF = smoothstep(5.0,12.0,d)*(1.0-smoothstep(30.0,52.0,d));',
        '  gl_PointSize = clamp((1.3+aSeed*1.9)*(70.0/d),1.0,6.5);',
        '  gl_Position = projectionMatrix*mv;',
        '}'].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; varying float vF;',
        'void main(){',
        '  float a = smoothstep(0.5,0.1,length(gl_PointCoord-0.5));',
        '  gl_FragColor = vec4(uColor, a*0.34*vF);',
        '}'].join('\n')
    });
    var pts = new T.Points(g, m);
    pts.frustumCulled = false;
    pts.name = 'Dust';
    return { obj: pts, mat: m };
  }

  function build(ctx) {
    var T = ctx.T, CFG = ctx.CFG, lig = ctx.lig, scene = ctx.scene;
    var L = CFG.light;
    var M = window.Mat.get();

    scene.fog = new T.FogExp2(L.fogColor, L.fogDensity);

    var az = L.sunAzimuthDeg * Math.PI / 180;
    var el = L.sunElevationDeg * Math.PI / 180;
    var sunVec = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();

    // ---------- каскады теней ----------
    var lightsGrp = new T.Group(); lightsGrp.name = 'SunCascades'; lig.add(lightsGrp);
    var casc = [];
    for (var i = 0; i < CFG.cascades.length; i++) {
      var c = CFG.cascades[i];
      var dl = new T.DirectionalLight(L.sunColor, L.sunIntensity * c.split);
      dl.castShadow = CFG.quality.shadows;
      dl.shadow.mapSize.set(c.mapSize, c.mapSize);
      var s = c.range;
      dl.shadow.camera.left = -s; dl.shadow.camera.right = s;
      dl.shadow.camera.top = s; dl.shadow.camera.bottom = -s;
      dl.shadow.camera.near = 1; dl.shadow.camera.far = s * 3;
      dl.shadow.bias = -0.00035;
      dl.shadow.normalBias = c.normalBias;
      dl.shadow.camera.updateProjectionMatrix();
      lightsGrp.add(dl); lightsGrp.add(dl.target);
      casc.push({ dl: dl, range: c.range });
    }
    var hemi = new T.HemisphereLight(L.hemiSky, L.hemiGround, L.hemiIntensity);
    hemi.name = 'HemisphereFill';
    lig.add(hemi);

    // ---------- небо ----------
    var skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new T.Color(0x5c6d8a) },
        mid: { value: new T.Color(0xb08a70) },
        hor: { value: new T.Color(0xdcb289) },
        sunDir: { value: sunVec },
        sunCol: { value: new T.Color(0xffd9a8) }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = position;',
        ' gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 top,mid,hor,sunDir,sunCol; varying vec3 vDir;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = d.y;',
        '  vec3 col = mix(hor, mid, smoothstep(0.02,0.16,h));',
        '  col = mix(col, top, smoothstep(0.14,0.55,h));',
        '  if(h<0.02) col = mix(hor, vec3(0.42,0.36,0.30), smoothstep(0.0,-0.25,h));',
        '  float s = max(dot(d, sunDir),0.0);',
        '  col += sunCol*(pow(s,180.0)*0.9 + pow(s,8.0)*0.28);',
        '  gl_FragColor = vec4(col,1.0);',
        '}'].join('\n')
    });
    var sky = new T.Mesh(new T.SphereGeometry(820, 32, 16), skyMat);
    sky.name = 'SkyDome';
    lig.add(sky);

    // ---------- солнечный диск ----------
    var sunSpr = new T.Sprite(new T.SpriteMaterial({
      map: M.glow, color: 0xffe0b0, blending: T.AdditiveBlending, depthWrite: false, fog: false
    }));
    sunSpr.scale.set(150, 150, 1);
    sunSpr.name = 'SunSprite';
    lig.add(sunSpr);

    // ---------- псевдообъёмные лучи ----------
    var shaftsGrp = new T.Group(); shaftsGrp.name = 'GodRays'; lig.add(shaftsGrp);
    var shaftList = [];
    var rS = window.RNG.mulberry32(window.RNG.hashCombine(ctx.seed, 0x5AF7));
    var cell = CFG.map.blockSize + CFG.map.roadWidth;
    for (var si = 0; si < L.godRays; si++) {
      var w = window.RNG.range(rS, 3.5, 8), h = window.RNG.range(rS, 10, 20);
      var g = new T.PlaneGeometry(w, h);
      var m = new T.MeshBasicMaterial({
        map: M.shaft, transparent: true, opacity: window.RNG.range(rS, 0.05, 0.13),
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false, color: 0xffd9a0
      });
      var mesh = new T.Mesh(g, m);
      var onX = rS() < 0.5;
      var line = (Math.floor(window.RNG.range(rS, -2.4, 2.4)) + 0.5) * cell;
      var along = window.RNG.range(rS, -95, 95);
      mesh.position.set(onX ? line : along, h * 0.55, onX ? along : line);
      mesh.rotation.y = az + Math.PI / 2;
      mesh.renderOrder = 6;
      shaftsGrp.add(mesh);
      shaftList.push({ m: m, base: m.opacity, ph: rS() * 6.28 });
    }

    // ---------- пыль ----------
    var dust = makeDust(T, L);
    lig.add(dust.obj);

    // ---------- покадровое обновление ----------
    var tmpV = new T.Vector3();
    function update(t, playerPos) {
      for (var i = 0; i < casc.length; i++) {
        var cc = casc[i];
        var texel = (2 * cc.range) / cc.dl.shadow.mapSize.x;
        var tx = Math.round(playerPos.x / texel) * texel;
        var tz = Math.round(playerPos.z / texel) * texel;
        cc.dl.target.position.set(tx, 0, tz);
        cc.dl.target.updateMatrixWorld();
        cc.dl.position.set(
          tx + sunVec.x * cc.range * 1.2,
          sunVec.y * cc.range * 1.2 + 8,
          tz + sunVec.z * cc.range * 1.2);
      }
      sky.position.set(playerPos.x, 0, playerPos.z);
      sunSpr.position.copy(sunVec).multiplyScalar(740).add(tmpV.set(playerPos.x, 0, playerPos.z));
      dust.obj.position.set(playerPos.x, Math.max(2, playerPos.y), playerPos.z);
      dust.mat.uniforms.uTime.value = t;
      for (var si2 = 0; si2 < shaftList.length; si2++) {
        var sh = shaftList[si2];
        sh.m.opacity = sh.base * (0.75 + 0.25 * Math.sin(t * 0.5 + sh.ph));
      }
    }

    return { update: update, sunVec: sunVec };
  }

  return { build: build };
})();
