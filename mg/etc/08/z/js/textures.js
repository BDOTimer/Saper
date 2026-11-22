// ============================================================
//  Полностью процедурные текстуры (canvas) и материалы.
//  Ни одного внешнего ассета — всё рисуется кодом при старте.
// ============================================================
window.Mat = (function () {
  var T = null, lib = null;

  function cv(size, fn) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    fn(g, size);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    t.encoding = T.sRGBEncoding;
    return t;
  }
  function speck(g, s, r, n, col0, col1, rMin, rMax, a) {
    for (var i = 0; i < n; i++) {
      var c0 = col0 + (col1 - col0) * r() | 0;
      g.fillStyle = 'rgba(' + c0 + ',' + c0 + ',' + c0 + ',' + a + ')';
      var rr = rMin + r() * (rMax - rMin);
      g.beginPath();
      g.arc(r() * s, r() * s, rr, 0, 6.283);
      g.fill();
    }
  }
  function stains(g, s, r, n, dark, a) {
    for (var i = 0; i < n; i++) {
      var x = r() * s, y = r() * s, rr = s * (0.05 + r() * 0.18);
      var gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(20,16,12,' + (a * dark) + ')');
      gr.addColorStop(1, 'rgba(20,16,12,0)');
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }
  function cracks(g, s, r, n, w, col) {
    g.strokeStyle = col; g.lineWidth = w;
    for (var i = 0; i < n; i++) {
      var x = r() * s, y = r() * s;
      g.beginPath(); g.moveTo(x, y);
      var steps = 4 + (r() * 6 | 0), a = r() * 6.28;
      for (var k = 0; k < steps; k++) {
        a += (r() - 0.5) * 1.6;
        var len = s * (0.02 + r() * 0.06);
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }

  function build() {
    T = window.THREE;
    // ---------- текстуры ----------
    var texConcrete = cv(512, function (g, s) {
      var r = window.RNG.mulberry32(101);
      g.fillStyle = '#8f8c86'; g.fillRect(0, 0, s, s);
      speck(g, s, r, 2600, 110, 180, 1, 3, 0.16);
      stains(g, s, r, 26, 0.5, 0.35);
      cracks(g, s, r, 5, 1.5, 'rgba(40,38,34,0.5)');
    });
    var texRoof = cv(512, function (g, s) {
      var r = window.RNG.mulberry32(102);
      g.fillStyle = '#6e6b66'; g.fillRect(0, 0, s, s);
      speck(g, s, r, 2400, 70, 130, 1, 4, 0.2);
      stains(g, s, r, 34, 0.7, 0.4);
      cracks(g, s, r, 8, 2, 'rgba(30,28,25,0.55)');
    });
    var texDirt = cv(512, function (g, s) {
      var r = window.RNG.mulberry32(103);
      g.fillStyle = '#6e5c46'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 900; i++) {
        var sh = r();
        g.fillStyle = sh > 0.5 ? 'rgba(125,107,82,0.35)' : 'rgba(80,66,50,0.4)';
        var x = r() * s, y = r() * s, rr = 2 + r() * 26;
        g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
      }
      speck(g, s, r, 1800, 60, 140, 0.6, 2.2, 0.3);
      stains(g, s, r, 18, 0.6, 0.3);
    });
    var texRubble = cv(512, function (g, s) {
      var r = window.RNG.mulberry32(104);
      g.fillStyle = '#8d877f'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 1400; i++) {
        var v = 110 + r() * 95 | 0;
        g.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v - 10) + ',' + (0.5 + r() * 0.5) + ')';
        g.save();
        g.translate(r() * s, r() * s);
        g.rotate(r() * 6.283);
        g.fillRect(-r() * 9 - 2, -r() * 6 - 1.5, r() * 18 + 3, r() * 12 + 2);
        g.restore();
      }
      stains(g, s, r, 14, 0.6, 0.35);
    });
    var texAsphalt = cv(512, function (g, s) {
      var r = window.RNG.mulberry32(105);
      g.fillStyle = '#3b3b3d'; g.fillRect(0, 0, s, s);
      speck(g, s, r, 3200, 40, 110, 0.6, 2.4, 0.28);
      stains(g, s, r, 30, 0.9, 0.5);
      cracks(g, s, r, 7, 1.6, 'rgba(12,12,13,0.8)');
      // выбоины
      for (var i = 0; i < 5; i++) {
        var x = r() * s, y = r() * s, rr = 6 + r() * 20;
        var gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, 'rgba(8,8,9,0.85)');
        gr.addColorStop(0.7, 'rgba(8,8,9,0.4)');
        gr.addColorStop(1, 'rgba(8,8,9,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
      }
    });
    var texAsphaltLines = cv(512, function (g, s) {
      var r = window.RNG.mulberry32(106);
      g.fillStyle = '#3b3b3d'; g.fillRect(0, 0, s, s);
      speck(g, s, r, 3200, 40, 110, 0.6, 2.4, 0.28);
      stains(g, s, r, 26, 0.9, 0.5);
      cracks(g, s, r, 6, 1.6, 'rgba(12,12,13,0.8)');
      // выцветшая прерывистая разметка (v — вдоль дороги)
      g.fillStyle = 'rgba(176,166,127,0.4)';
      for (var y = 0; y < s; y += s / 4) {
        if (r() < 0.75) g.fillRect(s / 2 - 5, y + 10, 10, s / 8);
      }
      stains(g, s, r, 8, 1.1, 0.45);
    });
    var texWood = cv(256, function (g, s) {
      var r = window.RNG.mulberry32(107);
      g.fillStyle = '#6d5539'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 40; i++) {
        g.strokeStyle = 'rgba(' + (60 + r() * 50 | 0) + ',' + (45 + r() * 35 | 0) + ',' + (25 + r() * 25 | 0) + ',' + (0.4 + r() * 0.4) + ')';
        g.lineWidth = 1 + r() * 3;
        var x = r() * s;
        g.beginPath(); g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 14, s * 0.33, x + (r() - 0.5) * 14, s * 0.66, x + (r() - 0.5) * 10, s);
        g.stroke();
      }
      for (var k = 0; k < 3; k++) {
        var x2 = r() * s, y2 = r() * s;
        g.fillStyle = 'rgba(45,32,18,0.8)';
        g.beginPath(); g.ellipse(x2, y2, 4 + r() * 4, 7 + r() * 6, 0, 0, 6.283); g.fill();
      }
    });
    var texBark = cv(256, function (g, s) {
      var r = window.RNG.mulberry32(108);
      g.fillStyle = '#4a3d30'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 60; i++) {
        var x = r() * s;
        g.strokeStyle = r() < 0.5 ? 'rgba(25,19,14,' + (0.5 + r() * 0.4) + ')' : 'rgba(110,92,72,' + (0.3 + r() * 0.3) + ')';
        g.lineWidth = 1 + r() * 4;
        g.beginPath(); g.moveTo(x, -4);
        for (var y = 0; y < s + 8; y += 16) g.lineTo(x + Math.sin(y * 0.12 + i) * 5, y);
        g.stroke();
      }
    });
    var texGrass = cv(128, function (g, s) {
      g.clearRect(0, 0, s, s);
      var r = window.RNG.mulberry32(109);
      for (var i = 0; i < 9; i++) {
        var x = 14 + r() * (s - 28);
        var h = s * (0.55 + r() * 0.45);
        var bend = (r() - 0.5) * 34;
        g.strokeStyle = 'rgba(' + (120 + r() * 60 | 0) + ',' + (110 + r() * 55 | 0) + ',' + (55 + r() * 35 | 0) + ',' + (0.85 + r() * 0.15) + ')';
        g.lineWidth = 2.4 + r() * 2.2;
        g.beginPath(); g.moveTo(x, s);
        g.quadraticCurveTo(x + bend * 0.4, s - h * 0.6, x + bend, s - h);
        g.stroke();
      }
    });
    var texPaper = cv(64, function (g, s) {
      var r = window.RNG.mulberry32(110);
      g.fillStyle = '#cfc7b4'; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(120,110,90,0.35)';
      g.fillRect(0, s * (0.3 + r() * 0.4), s, 2);
      g.strokeStyle = 'rgba(70,65,55,0.5)';
      for (var i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(s * 0.2, s * (0.2 + i * 0.12));
        g.lineTo(s * (0.5 + r() * 0.3), s * (0.2 + i * 0.12));
        g.stroke();
      }
    });
    var texRust = cv(256, function (g, s) {
      var r = window.RNG.mulberry32(111);
      g.fillStyle = '#6f6a62'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 260; i++) {
        g.fillStyle = 'rgba(' + (120 + r() * 70 | 0) + ',' + (55 + r() * 40 | 0) + ',' + (25 + r() * 25 | 0) + ',' + (0.25 + r() * 0.5) + ')';
        var rr = 4 + r() * 26;
        g.beginPath(); g.arc(r() * s, r() * s, rr, 0, 6.283); g.fill();
      }
      stains(g, s, r, 22, 1, 0.5);
    });
    var texSoot = cv(256, function (g, s) {
      var r = window.RNG.mulberry32(112);
      g.fillStyle = '#232324'; g.fillRect(0, 0, s, s);
      speck(g, s, r, 900, 20, 70, 1, 3, 0.4);
      for (var i = 0; i < 130; i++) {
        g.fillStyle = 'rgba(' + (110 + r() * 60 | 0) + ',' + (55 + r() * 35 | 0) + ',' + (25 + r() * 20 | 0) + ',' + (0.1 + r() * 0.35) + ')';
        g.beginPath(); g.arc(r() * s, r() * s, 3 + r() * 20, 0, 6.283); g.fill();
      }
    });
    var texBlob = cv(256, function (g, s) {
      var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.4)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    var texGlow = cv(256, function (g, s) {
      var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,244,224,0.55)');
      gr.addColorStop(0.6, 'rgba(255,220,170,0.16)');
      gr.addColorStop(1, 'rgba(255,210,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    var texShaft = cv(128, function (g, s) {
      var gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      // мягкие края по горизонтали
      var gh = g.createLinearGradient(0, 0, s, 0);
      gh.addColorStop(0, 'rgba(0,0,0,1)');
      gh.addColorStop(0.25, 'rgba(0,0,0,0)');
      gh.addColorStop(0.75, 'rgba(0,0,0,0)');
      gh.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = gh; g.fillRect(0, 0, s, s);
      g.globalCompositeOperation = 'source-over';
    });

    // ---------- фасады (6 вариантов «разрушенности») ----------
    function facadeTex(seedV, style) {
      return cv(512, function (g, s) {
        var r = window.RNG.mulberry32(seedV);
        g.fillStyle = '#8a8781'; g.fillRect(0, 0, s, s);
        speck(g, s, r, 1500, 100, 170, 1, 2.6, 0.14);
        stains(g, s, r, 20, 0.55, 0.4);
        // закопчённый верх
        var gr = g.createLinearGradient(0, 0, 0, s * 0.45);
        gr.addColorStop(0, 'rgba(15,12,9,0.5)');
        gr.addColorStop(1, 'rgba(15,12,9,0)');
        g.fillStyle = gr; g.fillRect(0, 0, s, s * 0.45);
        // окна: 3 колонки x 2 ряда, плитка = 8м x 6м
        var cols = 3, rows = 2;
        var cw = s / cols, ch = s / rows;
        for (var cy = 0; cy < rows; cy++) for (var cx = 0; cx < cols; cx++) {
          var wx = cx * cw + cw * 0.18, wy = cy * ch + ch * 0.2;
          var ww = cw * 0.64, wh = ch * 0.6;
          var roll = r();
          var type;
          if (roll < 0.14 + (1 - style) * 0.08) type = 'intact';
          else if (roll < 0.34 + style * 0.1) type = 'boarded';
          else type = 'broken';
          // рамка
          g.fillStyle = '#55524c'; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
          if (type === 'intact') {
            var gg = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
            gg.addColorStop(0, '#1e2c3a'); gg.addColorStop(0.5, '#2c4155'); gg.addColorStop(1, '#16222e');
            g.fillStyle = gg; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(210,190,150,0.18)';
            g.beginPath(); g.moveTo(wx, wy + wh * 0.7); g.lineTo(wx + ww * 0.5, wy); g.lineTo(wx + ww * 0.8, wy); g.lineTo(wx + ww * 0.2, wy + wh); g.closePath(); g.fill();
          } else if (type === 'boarded') {
            g.fillStyle = '#241c13'; g.fillRect(wx, wy, ww, wh);
            for (var b = 0; b < 4; b++) {
              g.fillStyle = 'rgb(' + (85 + r() * 35 | 0) + ',' + (65 + r() * 25 | 0) + ',' + (42 + r() * 18 | 0) + ')';
              g.fillRect(wx, wy + b * wh / 4 + 1, ww, wh / 4 - 2);
            }
          } else {
            g.fillStyle = '#07080a'; g.fillRect(wx, wy, ww, wh);
            // рваные осколки по краям
            g.fillStyle = 'rgba(140,150,158,0.5)';
            for (var sh = 0; sh < 7; sh++) {
              var ex = r() < 0.5 ? wx : wx + ww;
              var ey = wy + r() * wh;
              g.beginPath();
              g.moveTo(ex, ey);
              g.lineTo(ex + (ex === wx ? 6 + r() * 10 : -(6 + r() * 10)), ey + (r() - 0.5) * 8);
              g.lineTo(ex, ey + (r() - 0.5) * 10);
              g.closePath(); g.fill();
            }
            g.strokeStyle = 'rgba(190,195,200,0.35)'; g.lineWidth = 1;
            for (var l = 0; l < 3; l++) {
              g.beginPath();
              g.moveTo(wx + r() * ww, wy + r() * wh);
              g.lineTo(wx + r() * ww, wy + r() * wh);
              g.stroke();
            }
          }
          // потёки под окном
          var st = g.createLinearGradient(0, wy + wh, 0, wy + wh + ch * 0.5);
          st.addColorStop(0, 'rgba(30,26,20,0.5)');
          st.addColorStop(1, 'rgba(30,26,20,0)');
          g.fillStyle = st; g.fillRect(wx - 2, wy + wh, ww + 4, ch * 0.5);
        }
        // низ плитки — цоколь
        g.fillStyle = 'rgba(50,46,42,0.65)';
        g.fillRect(0, s - s * 0.07, s, s * 0.07);
        // рваный верх
        g.fillStyle = '#4e4b46';
        for (var x = 0; x < s; x += 8) g.fillRect(x, 0, 8, 3 + r() * 9);
      });
    }

    // ---------- материалы ----------
    var facades = [];
    for (var i = 0; i < 6; i++) {
      var style = i / 5;
      facades.push(new T.MeshStandardMaterial({ map: facadeTex(7000 + i * 131, style), roughness: 0.94, metalness: 0 }));
    }

    lib = {
      facades: facades,
      dirt: new T.MeshStandardMaterial({ map: texDirt, vertexColors: true, roughness: 1, metalness: 0 }),
      roof: new T.MeshStandardMaterial({ map: texRoof, roughness: 1, metalness: 0 }),
      asphaltLines: new T.MeshStandardMaterial({ map: texAsphaltLines, roughness: 0.96, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      rubble: new T.MeshStandardMaterial({ map: texRubble, color: 0xc9c2b8, roughness: 1 }),
      rock: new T.MeshStandardMaterial({ map: texRubble, color: 0x9d968c, roughness: 1 }),
      wood: new T.MeshStandardMaterial({ map: texWood, roughness: 0.9 }),
      bark: new T.MeshStandardMaterial({ map: texBark, roughness: 1, color: 0x9a8c7c }),
      foliage: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      grassBlade: new T.MeshStandardMaterial({ map: texGrass, alphaTest: 0.45, side: T.DoubleSide, roughness: 1, color: 0xffffff }),
      paper: new T.MeshStandardMaterial({ map: texPaper, roughness: 1 }),
      glassShard: new T.MeshStandardMaterial({ color: 0xaec3cc, roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.75 }),
      bottle: new T.MeshStandardMaterial({ color: 0x3f6b52, roughness: 0.15, transparent: true, opacity: 0.85 }),
      can: new T.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.35, metalness: 0.75 }),
      tire: new T.MeshStandardMaterial({ color: 0x16171a, roughness: 0.95 }),
      barrel: new T.MeshStandardMaterial({ map: texRust, roughness: 0.8, metalness: 0.3 }),
      car: new T.MeshStandardMaterial({ color: 0xffffff, map: texSoot, roughness: 0.85, metalness: 0.25 }),
      pole: new T.MeshStandardMaterial({ color: 0x585c5e, roughness: 0.55, metalness: 0.6 }),
      rebar: new T.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.6, metalness: 0.7 }),
      brick: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      shadowBlob: new T.MeshBasicMaterial({ map: texBlob, transparent: true, opacity: 0.5, depthWrite: false }),
      scorch: new T.MeshBasicMaterial({ map: texBlob, transparent: true, opacity: 0.55, depthWrite: false }),
      glow: texGlow,
      shaft: texShaft
    };
    texDirt.repeat.set(64, 64);
    texAsphaltLines.repeat.set(1, 32);
    texRubble.repeat.set(3, 3);
    texRust.repeat.set(2, 1);
    texSoot.repeat.set(2, 1);
    return lib;
  }

  return { get: function () { if (!lib) lib = build(); return lib; } };
})();
