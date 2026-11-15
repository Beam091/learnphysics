// ระบบจำลองฟิสิกส์ 3 มิติ (Modern 3D Physics Lab Renderer & Camera Controller)
// ทำงานร่วมกับทุกบทเรียนใน LearnPhysics (15 ห้องแล็บจำลอง + 7 เกม + หน้าแรก)
(function () {
  "use strict";

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function norm3(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function sub3(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function cross3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function parseHexColor(hex) {
    if (!hex || hex[0] !== "#") return [74, 125, 255];
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [
      parseInt(h.slice(0, 2), 16) || 0,
      parseInt(h.slice(2, 4), 16) || 0,
      parseInt(h.slice(4, 6), 16) || 0,
    ];
  }

  function shadeColor(hex, intensity, alpha) {
    var rgb = parseHexColor(hex);
    var r = Math.round(clamp(rgb[0] * intensity, 0, 255));
    var g = Math.round(clamp(rgb[1] * intensity, 0, 255));
    var b = Math.round(clamp(rgb[2] * intensity, 0, 255));
    if (alpha !== undefined && alpha < 0.999) {
      return "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
    }
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function getThemeColors() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      return {
        skyTop: "#0c1324",
        skyBot: "#17233c",
        floor: "#1e2942",
        floorGrid: "rgba(148, 178, 232, 0.16)",
        floorAxis: "rgba(186, 210, 255, 0.38)",
        metal: "#64748b",
        metalDark: "#334155",
        accent: "#60a5fa",
        gold: "#fbbf24",
        danger: "#f87171",
        emerald: "#34d399",
        cyan: "#22d3ee",
        glass: "#93c5fd",
        labelBg: "rgba(15, 23, 42, 0.86)",
        labelFg: "#f8fafc",
        labelBorder: "rgba(148, 163, 184, 0.45)",
      };
    }
    return {
      skyTop: "#eef4ff",
      skyBot: "#f8fbff",
      floor: "#e2eaf7",
      floorGrid: "rgba(30, 58, 138, 0.12)",
      floorAxis: "rgba(20, 33, 61, 0.34)",
      metal: "#475569",
      metalDark: "#1e293b",
      accent: "#2563eb",
      gold: "#f59e0b",
      danger: "#dc2626",
      emerald: "#059669",
      cyan: "#0891b2",
      glass: "#60a5fa",
      labelBg: "rgba(255, 255, 255, 0.92)",
      labelFg: "#0f172a",
      labelBorder: "rgba(20, 33, 61, 0.28)",
    };
  }

  function h(tag, props, kids) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "text") el.textContent = props[k];
        else if (k === "class") el.className = props[k];
        else el.setAttribute(k, props[k]);
      });
    }
    if (kids) {
      kids.forEach(function (k) {
        if (k) el.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
      });
    }
    return el;
  }

  // ------------------------------------------------------------------ ตัวเรนเดอร์ 3D Core
  function SceneRenderer(canvas, cam) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = cam;
    this.queue = [];
    this.labels = [];
    this.w = 680;
    this.h = 380;
    this.lightDir = norm3([0.45, 0.85, 0.55]);
  }

  SceneRenderer.prototype.begin = function () {
    var rect = this.canvas.getBoundingClientRect();
    var cssW = Math.max(260, Math.round(rect.width || 680));
    var cssH = Math.max(220, Math.round(rect.height || 380));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var targetW = Math.round(cssW * dpr);
    var targetH = Math.round(cssH * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    this.w = cssW;
    this.h = cssH;
    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pal = getThemeColors();
    this.pal = pal;
    var bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, pal.skyTop);
    bg.addColorStop(1, pal.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    this.queue = [];
    this.labels = [];

    this.cosY = Math.cos(this.cam.yaw);
    this.sinY = Math.sin(this.cam.yaw);
    this.cosP = Math.cos(this.cam.pitch);
    this.sinP = Math.sin(this.cam.pitch);
    this.camDist = 560 / clamp(this.cam.zoom, 0.55, 2.4);
    this.fov = Math.min(cssW, cssH) * 1.48;
  };

  SceneRenderer.prototype.toCam = function (p) {
    var x = p[0];
    var y = p[1] - (this.cam.targetY || 42);
    var z = p[2];
    var x1 = x * this.cosY - z * this.sinY;
    var z1 = x * this.sinY + z * this.cosY;
    var y2 = y * this.cosP - z1 * this.sinP;
    var z2 = y * this.sinP + z1 * this.cosP;
    return [x1, y2, this.camDist - z2];
  };

  SceneRenderer.prototype.proj = function (p) {
    var c = this.toCam(p);
    var z = c[2];
    if (z < 28) return null;
    var s = this.fov / z;
    return {
      x: this.w * 0.5 + c[0] * s,
      y: this.h * 0.54 - c[1] * s,
      z: z,
      s: s,
      cam: c,
    };
  };

  SceneRenderer.prototype.addPoly = function (pts3, color, alpha, strokeColor, forceTwoSided) {
    var cps = [];
    var sps = [];
    var sumZ = 0;
    for (var i = 0; i < pts3.length; i++) {
      var pr = this.proj(pts3[i]);
      if (!pr) return;
      cps.push(pr.cam);
      sps.push(pr);
      sumZ += pr.z;
    }
    var n = cross3(sub3(cps[1], cps[0]), sub3(cps[2], cps[0]));
    if (!forceTwoSided && n[2] <= 0 && (alpha === undefined || alpha >= 0.99)) {
      // Backface culling in cam space: view vector from center points toward -camZ (negative)
    }
    var wn = norm3(cross3(sub3(pts3[1], pts3[0]), sub3(pts3[2], pts3[0])));
    var diff = Math.abs(dot3(wn, this.lightDir));
    var shade = 0.48 + 0.56 * diff;
    var fill = shadeColor(color, shade, alpha);
    var avgZ = sumZ / pts3.length;
    this.queue.push({
      z: avgZ,
      draw: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(sps[0].x, sps[0].y);
        for (var j = 1; j < sps.length; j++) ctx.lineTo(sps[j].x, sps[j].y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      },
    });
  };

  SceneRenderer.prototype.addLine = function (a, b, color, width, dashed, zBias) {
    var pa = this.proj(a);
    var pb = this.proj(b);
    if (!pa || !pb) return;
    var z = (pa.z + pb.z) * 0.5 + (zBias || 0);
    this.queue.push({
      z: z,
      draw: function (ctx) {
        ctx.save();
        ctx.beginPath();
        if (dashed) ctx.setLineDash([6, 5]);
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 2;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addCurve = function (pts, color, width, dashed) {
    for (var i = 0; i < pts.length - 1; i++) {
      this.addLine(pts[i], pts[i + 1], color, width, dashed, -2);
    }
  };

  SceneRenderer.prototype.addFloorGrid = function (halfW, halfD, step) {
    var hw = halfW || 180;
    var hd = halfD || 120;
    var st = step || 30;
    var pal = this.pal;
    // Soft floor base slab slightly at y=-2
    this.addPoly(
      [[-hw, -1, -hd], [hw, -1, -hd], [hw, -1, hd], [-hw, -1, hd]],
      pal.floor,
      0.88,
      null,
      true
    );
    var self = this;
    for (var x = -hw; x <= hw; x += st) {
      self.addLine([x, 0, -hd], [x, 0, hd], x === 0 ? pal.floorAxis : pal.floorGrid, x === 0 ? 1.6 : 1, false, 100);
    }
    for (var z = -hd; z <= hd; z += st) {
      self.addLine([-hw, 0, z], [hw, 0, z], z === 0 ? pal.floorAxis : pal.floorGrid, z === 0 ? 1.6 : 1, false, 100);
    }
  };

  SceneRenderer.prototype.addBox = function (cx, cy, cz, sx, sy, sz, color, alpha, stroke) {
    var hx = sx * 0.5;
    var hy = sy * 0.5;
    var hz = sz * 0.5;
    var p = [
      [cx - hx, cy - hy, cz - hz], // 0
      [cx + hx, cy - hy, cz - hz], // 1
      [cx + hx, cy + hy, cz - hz], // 2
      [cx - hx, cy + hy, cz - hz], // 3
      [cx - hx, cy - hy, cz + hz], // 4
      [cx + hx, cy - hy, cz + hz], // 5
      [cx + hx, cy + hy, cz + hz], // 6
      [cx - hx, cy + hy, cz + hz], // 7
    ];
    var faces = [
      [0, 1, 2, 3], // back
      [4, 5, 6, 7], // front
      [0, 4, 7, 3], // left
      [1, 5, 6, 2], // right
      [3, 2, 6, 7], // top
      [0, 1, 5, 4], // bottom
    ];
    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      this.addPoly([p[f[0]], p[f[1]], p[f[2]], p[f[3]]], color, alpha, stroke, true);
    }
  };

  SceneRenderer.prototype.addRotatedBox = function (cx, cy, cz, sx, sy, sz, angZ, color, alpha, stroke) {
    var hx = sx * 0.5;
    var hy = sy * 0.5;
    var hz = sz * 0.5;
    var c = Math.cos(angZ);
    var s = Math.sin(angZ);
    function rot(lx, ly, lz) {
      return [cx + lx * c - ly * s, cy + lx * s + ly * c, cz + lz];
    }
    var p = [
      rot(-hx, -hy, -hz),
      rot(hx, -hy, -hz),
      rot(hx, hy, -hz),
      rot(-hx, hy, -hz),
      rot(-hx, -hy, hz),
      rot(hx, -hy, hz),
      rot(hx, hy, hz),
      rot(-hx, hy, hz),
    ];
    var faces = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 5, 6, 2],
      [3, 2, 6, 7],
      [0, 1, 5, 4],
    ];
    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      this.addPoly([p[f[0]], p[f[1]], p[f[2]], p[f[3]]], color, alpha, stroke, true);
    }
  };

  SceneRenderer.prototype.addCylinder = function (a, b, r1, r2, color, alpha, segs, withCaps) {
    var dir = sub3(b, a);
    var len = Math.hypot(dir[0], dir[1], dir[2]);
    if (len < 0.1) return;
    var axis = [dir[0] / len, dir[1] / len, dir[2] / len];
    var up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm3(cross3(up, axis));
    var v = norm3(cross3(axis, u));
    var N = segs || 10;
    var ringA = [];
    var ringB = [];
    for (var i = 0; i < N; i++) {
      var th = (i / N) * Math.PI * 2;
      var ct = Math.cos(th);
      var st = Math.sin(th);
      var ox = u[0] * ct + v[0] * st;
      var oy = u[1] * ct + v[1] * st;
      var oz = u[2] * ct + v[2] * st;
      ringA.push([a[0] + ox * r1, a[1] + oy * r1, a[2] + oz * r1]);
      ringB.push([b[0] + ox * r2, b[1] + oy * r2, b[2] + oz * r2]);
    }
    for (var i = 0; i < N; i++) {
      var j = (i + 1) % N;
      this.addPoly([ringA[i], ringA[j], ringB[j], ringB[i]], color, alpha, null, true);
    }
    if (withCaps !== false && r1 > 0.2) this.addPoly(ringA, color, alpha, null, true);
    if (withCaps !== false && r2 > 0.2) this.addPoly(ringB, color, alpha, null, true);
  };

  SceneRenderer.prototype.addSphere = function (pos, radius, color, alpha, shadow) {
    var pr = this.proj(pos);
    if (!pr) return;
    var pxR = Math.max(2, radius * pr.s);
    if (shadow !== false && pos[1] > 1) {
      var shP = this.proj([pos[0], 0.5, pos[2]]);
      if (shP) {
        var shR = Math.max(2, radius * shP.s * clamp(1 - pos[1] / 260, 0.35, 1));
        this.queue.push({
          z: shP.z + 5,
          draw: function (ctx) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(shP.x, shP.y, shR, shR * 0.45, 0, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(15, 23, 42, 0.22)";
            ctx.fill();
            ctx.restore();
          },
        });
      }
    }
    this.queue.push({
      z: pr.z,
      draw: function (ctx) {
        ctx.save();
        var grad = ctx.createRadialGradient(
          pr.x - pxR * 0.32,
          pr.y - pxR * 0.32,
          pxR * 0.1,
          pr.x,
          pr.y,
          pxR
        );
        grad.addColorStop(0, shadeColor(color, 1.35, alpha));
        grad.addColorStop(0.55, shadeColor(color, 0.98, alpha));
        grad.addColorStop(1, shadeColor(color, 0.48, alpha));
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pxR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addRing = function (pos, radius, color, lineW) {
    var N = 24;
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      pts.push([pos[0] + radius * Math.cos(a), pos[1], pos[2] + radius * Math.sin(a)]);
    }
    this.addCurve(pts, color, lineW || 2.2, false);
  };

  SceneRenderer.prototype.addArrow = function (a, b, r, color, label) {
    var d = sub3(b, a);
    var len = Math.hypot(d[0], d[1], d[2]);
    if (len < 2) return;
    var tipLen = Math.min(len * 0.35, (r || 3) * 3.8);
    var ratio = (len - tipLen) / len;
    var mid = [a[0] + d[0] * ratio, a[1] + d[1] * ratio, a[2] + d[2] * ratio];
    this.addCylinder(a, mid, r || 2.5, r || 2.5, color, 1, 8, false);
    this.addCylinder(mid, b, (r || 2.5) * 2.1, 0.1, color, 1, 8, true);
    if (label) {
      this.addLabel([(a[0] + b[0]) * 0.5, Math.max(a[1], b[1]) + 14, (a[2] + b[2]) * 0.5], label);
    }
  };

  SceneRenderer.prototype.addHelix = function (a, b, radius, turns, color) {
    var d = sub3(b, a);
    var len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1) return;
    var axis = [d[0] / len, d[1] / len, d[2] / len];
    var up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm3(cross3(up, axis));
    var v = norm3(cross3(axis, u));
    var steps = turns * 14;
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var f = i / steps;
      var th = f * turns * Math.PI * 2;
      var ox = (u[0] * Math.cos(th) + v[0] * Math.sin(th)) * radius;
      var oy = (u[1] * Math.cos(th) + v[1] * Math.sin(th)) * radius;
      var oz = (u[2] * Math.cos(th) + v[2] * Math.sin(th)) * radius;
      pts.push([a[0] + d[0] * f + ox, a[1] + d[1] * f + oy, a[2] + d[2] * f + oz]);
    }
    this.addCurve(pts, color, 2.2, false);
  };

  SceneRenderer.prototype.addLabel = function (pos, text, bgOverride, fgOverride) {
    var pr = this.proj(pos);
    if (!pr) return;
    this.labels.push({
      x: pr.x,
      y: pr.y,
      text: text,
      bg: bgOverride || this.pal.labelBg,
      fg: fgOverride || this.pal.labelFg,
      border: this.pal.labelBorder,
    });
  };

  SceneRenderer.prototype.end = function () {
    this.queue.sort(function (a, b) {
      return b.z - a.z;
    });
    var ctx = this.ctx;
    for (var i = 0; i < this.queue.length; i++) {
      this.queue[i].draw(ctx);
    }
    ctx.save();
    ctx.font = "600 11px Sarabun, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (var j = 0; j < this.labels.length; j++) {
      var lb = this.labels[j];
      var tw = ctx.measureText(lb.text).width + 12;
      var th = 20;
      var rx = clamp(lb.x - tw * 0.5, 4, this.w - tw - 4);
      var ry = clamp(lb.y - th * 0.5, 4, this.h - th - 4);
      ctx.fillStyle = lb.bg;
      ctx.strokeStyle = lb.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rx, ry, tw, th, 6);
      else ctx.rect(rx, ry, tw, th);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lb.fg;
      ctx.fillText(lb.text, rx + tw * 0.5, ry + th * 0.5 + 0.5);
    }
    ctx.restore();
    this.canvas.setAttribute("data-cam-yaw", this.cam.yaw.toFixed(2));
    this.canvas.setAttribute("data-cam-pitch", this.cam.pitch.toFixed(2));
    this.canvas.setAttribute("data-cam-zoom", this.cam.zoom.toFixed(2));
    this.canvas.setAttribute("data-meshes-count", String(this.queue.length));
  };

  // ------------------------------------------------------------------ ตัวสร้างฉาก 3D ทั้ง 15 เครื่องยนต์ + โหมดเกม
  var SCENES = {};

  SCENES.projectile = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(170, 90, 30);
    var scale = 1.65;
    var ox = -125;

    // ฐานและลำกล้องปืนใหญ่ 3D
    var angleRad = ((st.angle || 45) * Math.PI) / 180;
    r.addBox(ox, 5, 0, 26, 10, 20, pal.metalDark, 1);
    r.addCylinder([ox, 10, 0], [ox + 34 * Math.cos(angleRad), 10 + 34 * Math.sin(angleRad), 0], 7, 5.5, pal.metal, 1, 10);
    r.addSphere([ox, 10, 0], 6, pal.metalDark, 1, false);

    // เป้าหมาย 3D ในโหมดเกม
    if (st.targetDist > 0) {
      var tx = ox + st.targetDist * scale;
      var tolPx = (st.tolerance || 4) * scale;
      r.addBox(tx, 2.5, 0, Math.max(14, tolPx * 2), 5, 28, pal.gold, 0.92);
      r.addRing([tx, 5.5, 0], Math.max(10, tolPx), pal.danger, 2.5);
      r.addCylinder([tx, 5, 14], [tx, 52, 14], 1.8, 1.8, pal.metalDark, 1);
      r.addPoly([[tx, 50, 14], [tx + 22, 43, 14], [tx, 36, 14]], pal.danger, 1, null, true);
      r.addLabel([tx, 62, 14], "🎯 เป้า " + st.targetDist + " ม.");
    }

    // เส้นวิถีโค้ง 3D (ซ่อนปลายถ้าเป็นเกมและยังไม่กดยิง)
    var T = st.T || 3.6;
    var vx = st.vx || 18;
    var vy = st.vy || 18;
    var G = 9.8;
    var isHiddenGame = !!st.isGame && !st.revealed;
    var maxFrac = isHiddenGame ? 0.22 : (st.animFrac !== undefined ? st.animFrac : 1);
    var pts = [];
    for (var i = 0; i <= 36; i++) {
      var f = (i / 36) * maxFrac;
      var t = f * T;
      var x = ox + vx * t * scale;
      var y = 10 + Math.max(0, vy * t - 0.5 * G * t * t) * scale;
      pts.push([x, y, 0]);
    }
    r.addCurve(pts, pal.accent, isHiddenGame ? 2.5 : 3.2, isHiddenGame);

    // จุดสูงสุด + จุดตก + ลูกปืนใหญ่ 3D
    var ballT = st.ballT !== undefined ? st.ballT : (isHiddenGame ? 0 : T * ((time * 0.45) % 1));
    var bx = ox + vx * ballT * scale;
    var by = 10 + Math.max(0, vy * ballT - 0.5 * G * ballT * ballT) * scale;
    r.addSphere([bx, by, 0], 6.5, pal.danger, 1, true);

    if (!isHiddenGame && st.R > 0) {
      var lx = ox + st.R * scale;
      r.addSphere([lx, 4, 0], 4.5, pal.gold, 1, false);
      if (st.H > 0) {
        var ax = ox + st.R * 0.5 * scale;
        var ay = 10 + st.H * scale;
        r.addLine([ax, 0, 0], [ax, ay, 0], pal.gold, 1.5, true);
        r.addSphere([ax, ay, 0], 4, pal.gold, 1, false);
        r.addLabel([ax, ay + 16, 0], "H=" + st.H.toFixed(1) + "ม.");
      }
      r.addLabel([lx, 22, 0], "R=" + st.R.toFixed(1) + "ม.");
    }

    if (pulse && pulse.active) {
      var pAge = (performance.now() - pulse.started) / 1000;
      if (pAge < 0.8 && st.R > 0) {
        r.addRing([ox + st.R * scale, 3, 0], 10 + pAge * 36, pal.emerald, 2.5);
      }
    }
  };

  SCENES.coulomb = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(160, 100, 30);
    var dist = clamp(st.r || 1, 0.3, 4);
    var span = 34 + dist * 46;
    var x1 = -span * 0.5;
    var x2 = span * 0.5;
    var y = 48;
    var q1 = st.q1 || 4;
    var q2 = st.q2 || -4;
    var opp = q1 * q2 < 0;

    // ฐานฉนวนตั้งประจุ
    r.addCylinder([x1, 0, 0], [x1, y, 0], 4, 3, pal.metal, 1);
    r.addCylinder([x2, 0, 0], [x2, y, 0], 4, 3, pal.metal, 1);
    r.addBox(x1, 3, 0, 26, 6, 26, pal.metalDark, 1);
    r.addBox(x2, 3, 0, 26, 6, 26, pal.metalDark, 1);

    // เส้นสนามไฟฟ้า 3D รอบประจุทั้งสอง
    for (var ring = 0; ring < 6; ring++) {
      var phi = (ring / 6) * Math.PI * 2 + time * 0.3;
      var arc = [];
      for (var k = 0; k <= 16; k++) {
        var f = k / 16;
        var xx = x1 + (x2 - x1) * f;
        var bulge = opp ? Math.sin(f * Math.PI) * 32 : Math.sin(f * Math.PI) * 52;
        arc.push([xx, y + bulge * Math.cos(phi), bulge * Math.sin(phi)]);
      }
      r.addCurve(arc, opp ? pal.accent : pal.gold, 1.5, true);
    }

    var r1 = clamp(12 + Math.abs(q1) * 1.1, 14, 24);
    var r2 = clamp(12 + Math.abs(q2) * 1.1, 14, 24);
    r.addSphere([x1, y, 0], r1, q1 >= 0 ? pal.danger : pal.accent, 1, true);
    r.addSphere([x2, y, 0], r2, q2 >= 0 ? pal.danger : pal.accent, 1, true);

    var dir = opp ? 1 : -1;
    var fLen = 36;
    r.addArrow([x1 + dir * r1, y + 26, 0], [x1 + dir * (r1 + fLen), y + 26, 0], 2.5, pal.emerald, "F₁");
    r.addArrow([x2 - dir * r2, y + 26, 0], [x2 - dir * (r2 + fLen), y + 26, 0], 2.5, pal.emerald, "F₂");
    r.addLine([x1, 8, 16], [x2, 8, 16], pal.metalDark, 2, false);
    r.addLabel([0, 18, 16], "r = " + dist.toFixed(2) + " ม.");
    r.addLabel([x1, y + r1 + 14, 0], (q1 >= 0 ? "+" : "") + q1 + " μC");
    r.addLabel([x2, y + r2 + 14, 0], (q2 >= 0 ? "+" : "") + q2 + " μC");
  };

  SCENES.reflection = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(160, 100, 30);
    // กระจกเงาราบ 3 มิติ
    r.addBox(0, 6, 0, 230, 8, 95, pal.metalDark, 1);
    r.addBox(0, 11.5, 0, 224, 3, 88, pal.cyan, 0.72);
    // เส้นแนวฉาก
    r.addLine([0, 12, 0], [0, 130, 0], pal.metalDark, 2, true);
    r.addLabel([0, 138, 0], "เส้นแนวฉาก");

    var deg = clamp(st.angle || 40, 5, 85);
    var rad = (deg * Math.PI) / 180;
    var L = 128;
    var src = [-L * Math.sin(rad), 12 + L * Math.cos(rad), 0];
    var dst = [L * Math.sin(rad), 12 + L * Math.cos(rad), 0];

    // หัวฉายเลเซอร์ 3 มิติ
    r.addCylinder(src, [src[0] * 0.85, src[1] * 0.85 + 2, 0], 6, 5, pal.metalDark, 1);
    r.addCylinder(src, [0, 12, 0], 2.6, 2.6, pal.danger, 1, 8);
    r.addCylinder([0, 12, 0], dst, 2.6, 2.6, pal.gold, 1, 8);

    // อนุภาคโฟตอนวิ่งตามลำแสง
    var p = (time * 0.8) % 1;
    var px = p < 0.5 ? src[0] * (1 - p * 2) : dst[0] * ((p - 0.5) * 2);
    var py = 12 + (p < 0.5 ? (src[1] - 12) * (1 - p * 2) : (dst[1] - 12) * ((p - 0.5) * 2));
    r.addSphere([px, py, 0], 4.5, pal.danger, 1, false);

    r.addLabel([src[0] * 0.55 - 12, src[1] * 0.55 + 16, 0], "θi = " + deg + "°");
    r.addLabel([dst[0] * 0.55 + 12, dst[1] * 0.55 + 16, 0], "θr = " + deg + "°");
  };

  SCENES["snell-law"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(160, 100, 30);
    // บล็อกแก้ว/น้ำ 3 มิติช่วงล่าง y: 0..64 และอากาศช่วงบน y: 64..135
    r.addBox(0, 32, 0, 230, 64, 96, pal.glass, 0.34, pal.accent);
    r.addLine([0, 2, 0], [0, 134, 0], pal.metalDark, 2, true);
    var hy = 64;
    var deg1 = clamp(st.angle || 35, 0, 85);
    var n1 = st.n1 || 1.0;
    var n2 = st.n2 || 1.33;
    var a1 = (deg1 * Math.PI) / 180;
    var L1 = 82;
    var src = [-L1 * Math.sin(a1), hy + L1 * Math.cos(a1), 0];
    r.addCylinder(src, [0, hy, 0], 2.8, 2.8, pal.danger, 1, 8);

    var sinB = (n1 * Math.sin(a1)) / n2;
    if (sinB >= 1) {
      var ref = [L1 * Math.sin(a1), hy + L1 * Math.cos(a1), 0];
      r.addCylinder([0, hy, 0], ref, 2.8, 2.8, pal.gold, 1, 8);
      r.addLabel([ref[0] * 0.65, ref[1] * 0.85, 0], "สะท้อนกลับหมด!");
    } else {
      var b = Math.asin(sinB);
      var L2 = 60;
      var dst = [L2 * Math.sin(b), hy - L2 * Math.cos(b), 0];
      r.addCylinder([0, hy, 0], dst, 2.8, 2.8, pal.cyan, 1, 8);
      var deg2 = (b * 180) / Math.PI;
      r.addLabel([dst[0] + 24, hy - 34, 0], "θ₂ = " + deg2.toFixed(1) + "°");
    }
    var p = (time * 0.7) % 1;
    if (p < 0.5) {
      var k = p * 2;
      r.addSphere([src[0] * (1 - k), src[1] + (hy - src[1]) * k, 0], 4, pal.danger, 1, false);
    }
    r.addLabel([-75, hy + 52, 20], "n₁ = " + n1.toFixed(2));
    r.addLabel([-75, 22, 20], "n₂ = " + n2.toFixed(2));
  };

  SCENES["ohm-law"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(165, 110, 30);
    // แผงวงจร 3 มิติ
    r.addBox(0, 5, 0, 260, 10, 145, pal.metalDark, 1);
    var V = st.V || 12;
    var R = st.R || 6;
    var I = st.I !== undefined ? st.I : V / Math.max(0.5, R);
    var isHidden = !!st.isGame && !st.revealed;

    // เส้นลวดวงจร 3 มิติบนบอร์ด
    var wireY = 18;
    var pts = [[-95, wireY, -45], [95, wireY, -45], [95, wireY, 45], [-95, wireY, 45], [-95, wireY, -45]];
    for (var i = 0; i < 4; i++) {
      r.addCylinder(pts[i], pts[i + 1], 3, 3, pal.gold, 1, 8);
    }

    // แบตเตอรี่ 3D (ด้านซ้าย)
    r.addCylinder([-95, 10, -22], [-95, 36, -22], 14, 14, pal.accent, 1, 12);
    r.addCylinder([-95, 36, -22], [-95, 42, -22], 6, 6, pal.gold, 1, 10);
    r.addLabel([-95, 52, -22], "V = " + V + " V");

    // ตัวต้านทาน 3D (ด้านบน - เปล่งแสงตามความร้อน I^2 R)
    var hot = clamp((V * V) / Math.max(1, R) / 60, 0, 1);
    r.addCylinder([-32, 22, -45], [32, 22, -45], 11, 11, hot > 0.45 ? pal.danger : pal.emerald, 1, 12);
    r.addLabel([0, 42, -45], "R = " + R + " Ω");

    // แอมมิเตอร์ 3D (ด้านล่าง)
    r.addBox(0, 22, 45, 56, 26, 24, pal.metal, 1);
    if (isHidden) {
      r.addLabel([0, 46, 45], st.targetI ? "🎯 เป้า: " + st.targetI.toFixed(1) + " A" : "⚡ รอทดสอบวงจร");
    } else {
      r.addLabel([0, 46, 45], "I = " + I.toFixed(2) + " A");
    }

    // อนุภาคอิเล็กตรอน 3 มิติไหลวนรอบลูปวงจร
    if (!isHidden || (pulse && pulse.active)) {
      var speed = clamp(I * 0.28, 0.15, 2.2);
      var count = 12;
      for (var e = 0; e < count; e++) {
        var frac = ((e / count) + time * speed * 0.25) % 1;
        var pos;
        if (frac < 0.25) {
          var f0 = frac / 0.25;
          pos = [-95 + 190 * f0, wireY, -45];
        } else if (frac < 0.5) {
          var f1 = (frac - 0.25) / 0.25;
          pos = [95, wireY, -45 + 90 * f1];
        } else if (frac < 0.75) {
          var f2 = (frac - 0.5) / 0.25;
          pos = [95 - 190 * f2, wireY, 45];
        } else {
          var f3 = (frac - 0.75) / 0.25;
          pos = [-95, wireY, 45 - 90 * f3];
        }
        r.addSphere(pos, 4.2, pal.cyan, 1, false);
      }
    }
  };

  SCENES["harmonic-wave"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(175, 95, 35);
    var freq = st.f || 2.5;
    var lam = st.lambda || 4.0;
    var amp = clamp((st.amp || 1.5) * 18, 10, 44);
    var isHidden = !!st.isGame && !st.revealed;
    var revealPulse = pulse && pulse.active && (performance.now() - pulse.started) < 1200;
    var drawAll = !isHidden || revealPulse;

    // เสารับคลื่น 3 มิติซ้าย-ขวา
    r.addCylinder([-145, 0, 0], [-145, 95, 0], 4, 4, pal.metalDark, 1);
    r.addCylinder([145, 0, 0], [145, 95, 0], 4, 4, pal.metalDark, 1);
    r.addLine([-145, 52, 0], [145, 52, 0], pal.floorAxis, 1.4, true);

    var pts = [];
    var segs = 38;
    var phase = drawAll ? time * freq * 1.8 : 0;
    var maxI = drawAll ? segs : 10;
    for (var i = 0; i <= maxI; i++) {
      var x = -140 + (i / segs) * 280;
      var k = (2 * Math.PI) / clamp(lam * 28, 35, 220);
      var y = 52 + amp * Math.sin(k * (x + 140) - phase);
      pts.push([x, y, 0]);
      if (i % 2 === 0) {
        r.addLine([x, 52, 0], [x, y, 0], pal.glass, 1.3, false);
        r.addSphere([x, y, 0], 3.8, pal.accent, 1, false);
      }
    }
    r.addCurve(pts, pal.accent, 3, !drawAll);
    if (st.targetV && isHidden) {
      r.addLabel([0, 108, 0], "🎯 เป้าความเร็วคลื่น v = " + st.targetV.toFixed(1) + " ม./วิ");
    } else {
      r.addLabel([0, 108, 0], "v = fλ = " + (freq * lam).toFixed(1) + " ม./วิ");
    }
  };

  SCENES["newton-force"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(175, 95, 35);
    var F = st.F || 40;
    var m = st.m || 4;
    var mu = st.mu !== undefined ? st.mu : 0.2;
    var G = 9.8;
    var N = m * G;
    var maxFric = mu * N;
    var acc = st.acc !== undefined ? st.acc : (F > maxFric ? (F - maxFric) / m : 0);

    // รางทดลองยาว 3 มิติ
    r.addBox(0, 4, 0, 310, 8, 56, pal.metalDark, 1);

    // ตำแหน่งกล่อง 3 มิติขณะเคลื่อนที่
    var animFrac = 0;
    if (st.animX !== undefined) {
      animFrac = st.animX;
    } else if (acc > 0) {
      animFrac = ((time * (0.2 + acc * 0.08)) % 1);
    }
    if (pulse && pulse.active) {
      var pT = Math.min(1, (performance.now() - pulse.started) / 900);
      animFrac = acc > 0 ? pT * pT : Math.sin(pT * Math.PI * 3) * 0.02;
    }
    var bx = -95 + animFrac * 175;
    var size = clamp(24 + m * 2.5, 26, 48);
    var boxColor = st.isGame && !st.revealed ? pal.accent : pal.gold;
    r.addBox(bx, 8 + size * 0.5, 0, size, size, size, boxColor, 0.95, pal.metalDark);

    // ลูกศรแรง 3D (แรงดึง F, แรงเสียดทาน f, แรงปฏิกิริยา N, น้ำหนัก mg)
    var fArrowLen = clamp(F * 0.7, 16, 72);
    r.addArrow([bx + size * 0.5, 8 + size * 0.5, 0], [bx + size * 0.5 + fArrowLen, 8 + size * 0.5, 0], 2.8, pal.emerald, "F=" + F + "N");
    var frLen = clamp(Math.min(F, maxFric) * 0.7, 10, 58);
    r.addArrow([bx - size * 0.5, 14, 0], [bx - size * 0.5 - frLen, 14, 0], 2.3, pal.danger, "f");
    r.addArrow([bx, 8 + size, 0], [bx, 8 + size + 32, 0], 2.2, pal.cyan, "N");
    r.addLabel([bx, 8 + size + 50, 0], m + " kg");
  };

  SCENES["linear-motion"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(180, 90, 35);
    // รางอะลูมิเนียม 3 มิติพร้อมหลักเมตร
    r.addBox(0, 4, 0, 320, 8, 44, pal.metal, 1);
    for (var mk = -120; mk <= 120; mk += 60) {
      r.addBox(mk, 14, -20, 3, 20, 3, pal.metalDark, 1);
    }

    var u = st.u !== undefined ? st.u : 4;
    var a = st.a !== undefined ? st.a : 2;
    var T = Math.max(0.5, st.t || 4);
    var phaseT = (time * 0.85) % T;
    if (pulse && pulse.active) {
      var elap = (performance.now() - pulse.started) / 1000;
      phaseT = clamp(elap * (T / 1.4), 0, T);
    }
    var s = u * phaseT + 0.5 * a * phaseT * phaseT;
    var sMax = Math.max(10, Math.abs(u * T + 0.5 * a * T * T));
    var cx = clamp(-130 + (s / sMax) * 250, -135, 135);

    // รถทดลอง 3 มิติ + ล้อ 4 ล้อ
    r.addBox(cx, 22, 0, 42, 16, 26, pal.accent, 1);
    r.addSphere([cx - 13, 12, 14], 5.5, pal.metalDark, 1, false);
    r.addSphere([cx + 13, 12, 14], 5.5, pal.metalDark, 1, false);
    r.addSphere([cx - 13, 12, -14], 5.5, pal.metalDark, 1, false);
    r.addSphere([cx + 13, 12, -14], 5.5, pal.metalDark, 1, false);

    var curV = u + a * phaseT;
    r.addArrow([cx + 22, 24, 0], [cx + 22 + clamp(curV * 2.2, -55, 55), 24, 0], 2.4, pal.emerald, "v=" + curV.toFixed(1));
    r.addLabel([cx, 48, 0], "s = " + s.toFixed(1) + " ม.");
  };

  SCENES["momentum-collision"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(180, 90, 35);
    r.addBox(0, 4, 0, 320, 8, 52, pal.metalDark, 1);

    var m1 = st.m1 || 4;
    var u1 = st.u1 || 6;
    var m2 = st.m2 || 2;
    var u2 = st.u2 !== undefined ? st.u2 : 0;
    var elastic = st.elastic !== false;
    var rad1 = clamp(12 + m1 * 1.4, 14, 24);
    var rad2 = clamp(12 + m2 * 1.4, 14, 24);

    // คำนวณความเร็วหลังชน
    var v1 = elastic ? ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2) : (m1 * u1 + m2 * u2) / (m1 + m2);
    var v2 = elastic ? ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2) : v1;

    var cyc = (time * 0.45) % 1;
    if (pulse && pulse.active) {
      cyc = clamp((performance.now() - pulse.started) / 1800, 0, 0.99);
    }
    var x1, x2;
    if (cyc < 0.5) {
      var fPre = cyc * 2;
      x1 = -120 + (120 - rad1) * fPre;
      x2 = 70 + (-70 + rad2) * fPre;
    } else {
      var fPost = (cyc - 0.5) * 2;
      x1 = -rad1 + v1 * 9 * fPost;
      x2 = rad2 + v2 * 9 * fPost;
      if (cyc < 0.62) r.addRing([0, 26, 0], 14 + (cyc - 0.5) * 180, pal.gold, 2.5);
    }

    r.addSphere([clamp(x1, -145, 145), 8 + rad1, 0], rad1, pal.danger, 1, true);
    r.addSphere([clamp(x2, -145, 145), 8 + rad2, 0], rad2, pal.accent, 1, true);
    r.addLabel([clamp(x1, -130, 130), 14 + rad1 * 2.2, 0], "m₁=" + m1 + "กก.");
    r.addLabel([clamp(x2, -130, 130), 14 + rad2 * 2.2, 0], "m₂=" + m2 + "กก.");
  };

  SCENES["circular-shm"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(170, 100, 35);
    var m = st.m || 2;
    var amp = clamp((st.r || 2) * 16, 18, 56);
    var k = st.k || 20;
    var omega = Math.sqrt(k / Math.max(0.2, m));
    var ang = time * omega;

    // ฝั่งซ้าย: จานหมุนวงกลมแนวนอน 3 มิติ
    var discCx = -65;
    r.addCylinder([discCx, 2, 0], [discCx, 10, 0], amp + 14, amp + 14, pal.metal, 0.45, 24);
    r.addCylinder([discCx, 0, 0], [discCx, 36, 0], 4, 4, pal.metalDark, 1);
    r.addRing([discCx, 11, 0], amp, pal.accent, 1.8);
    var bx = discCx + amp * Math.cos(ang);
    var bz = amp * Math.sin(ang);
    r.addLine([discCx, 16, 0], [bx, 16, bz], pal.metalDark, 2, false);
    r.addSphere([bx, 18, bz], 8.5, pal.danger, 1, true);
    r.addArrow([bx, 18, bz], [discCx, 18, 0], 1.8, pal.emerald);
    r.addLabel([discCx, 62, 0], "วงกลม ω=" + omega.toFixed(1));

    // ฝั่งขวา: สปริงสั่น SHM แนวตั้ง 3 มิติ
    var sx = 78;
    r.addBox(sx, 118, 0, 56, 8, 28, pal.metalDark, 1);
    var massY = 58 + amp * 0.65 * Math.sin(ang);
    r.addHelix([sx, 114, 0], [sx, massY + 12, 0], 11, 7, pal.gold);
    r.addBox(sx, massY, 0, 26, 22, 26, pal.accent, 1);
    r.addLabel([sx, 134, 0], "SHM สปริง k=" + k);
  };

  SCENES["fluid-pressure"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(165, 100, 35);
    var rho = st.rho || 1000;
    var hDepth = clamp(st.h || 5, 0.5, 20);
    var rhoObj = st.rhoObj || 800;

    // ถังของเหลวใส 3 มิติ
    var tankW = 150;
    var tankH = 110;
    var tankD = 96;
    r.addBox(0, tankH * 0.5 + 4, 0, tankW, tankH, tankD, rho > 1100 ? pal.cyan : pal.glass, 0.28, pal.accent);
    r.addBox(0, 3, 0, tankW + 10, 6, tankD + 10, pal.metalDark, 1);

    // หัววัดความดันระดับลึก h
    var sy = clamp(106 - (hDepth / 20) * 88, 16, 102);
    r.addLine([-52, 112, 16], [-52, sy, 16], pal.gold, 2.2, false);
    r.addSphere([-52, sy, 16], 5.5, pal.danger, 1, false);
    r.addLabel([-92, sy, 16], "h=" + hDepth.toFixed(1) + "ม.");

    // วัตถุที่ลอยหรือจมในของเหลว 3 มิติ (เคลื่อนไหวนุ่มๆ)
    var floats = rhoObj <= rho;
    var bob = floats ? Math.sin(time * 2.2) * 3.5 : 0;
    var subFrac = clamp(rhoObj / rho, 0.2, 1);
    var objY = floats ? 110 - subFrac * 24 + bob : 20;
    r.addBox(22, objY, 0, 34, 28, 34, pal.gold, 0.96, pal.metalDark);
    r.addArrow([22, objY + 14, 0], [22, objY + 46, 0], 2.2, pal.emerald, "Fb");
    r.addArrow([22, objY - 14, 0], [22, objY - 40, 0], 2.2, pal.danger, "W");
    r.addLabel([22, 128, 0], floats ? "ลอย (ρobj ≤ ρ)" : "จม (ρobj > ρ)");
  };

  SCENES["ideal-gas"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(165, 100, 35);
    var T = st.T || 300;
    var V = st.V || 5;
    var n = st.n || 1;
    var R = 8.314;
    var P = st.P !== undefined ? st.P : (n * R * T) / Math.max(0.5, V);
    var isHidden = !!st.isGame && !st.revealed;

    // ความสูงลูกสูบ 3 มิติผันตาม V
    var pisH = clamp(36 + (V / 10) * 78, 38, 116);
    var pulseOff = pulse && pulse.active && (performance.now() - pulse.started) < 600
      ? Math.sin(((performance.now() - pulse.started) / 600) * Math.PI) * -6
      : 0;
    pisH += pulseOff;

    // กระบอกสูบแก้วใส 3 มิติ + หัวเตาความร้อนด้านล่าง
    r.addBox(0, 4, 0, 120, 8, 96, pal.metalDark, 1);
    if (T > 340) {
      r.addBox(0, 10, 0, 74, 4, 58, pal.danger, clamp((T - 200) / 500, 0.25, 0.9));
    }
    r.addCylinder([0, 8, 0], [0, 126, 0], 54, 54, pal.glass, 0.2, 18, false);
    // หัวลูกสูบ 3 มิติและก้านสูบ
    r.addCylinder([0, pisH, 0], [0, pisH + 10, 0], 50, 50, pal.gold, 0.94, 18);
    r.addCylinder([0, pisH + 10, 0], [0, pisH + 46, 0], 6, 6, pal.metalDark, 1, 10);

    // โมเลกุลแก๊ส 3 มิติวิ่งกระดอนตามอุณหภูมิ T
    var speedScale = Math.sqrt(T / 300) * 1.45;
    var molCount = Math.round(clamp(12 + n * 10, 12, 34));
    for (var i = 0; i < molCount; i++) {
      var s1 = Math.sin(i * 12.9898) * 43758.5453;
      var s2 = Math.cos(i * 78.233) * 19341.12;
      var ax = (s1 - Math.floor(s1)) * Math.PI * 2;
      var az = (s2 - Math.floor(s2)) * Math.PI * 2;
      var px = 38 * Math.sin(ax + time * speedScale * (1.2 + (i % 4) * 0.35));
      var pz = 38 * Math.cos(az + time * speedScale * (1.0 + (i % 3) * 0.4));
      var py = 14 + (pisH - 22) * (0.5 + 0.5 * Math.sin(i * 2.1 + time * speedScale * 2.2));
      r.addSphere([px, py, pz], 4, T > 420 ? pal.danger : pal.accent, 1, false);
    }

    if (isHidden && st.targetP) {
      r.addLabel([88, 72, 0], "🎯 เป้า: " + st.targetP + " kPa");
    } else {
      r.addLabel([88, 72, 0], "P = " + P.toFixed(0) + " kPa");
    }
    r.addLabel([-88, 56, 0], "T=" + T + "K, V=" + V + "L");
  };

  SCENES["thin-lens"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(185, 95, 35);
    // รางม้านั่งแสง 3 มิติ
    r.addBox(0, 4, 0, 340, 8, 40, pal.metalDark, 1);
    var scale = 2.4;
    var f = st.f || 15;
    var s = st.s || 30;
    var objX = clamp(-s * scale, -155, -24);
    var isHidden = !!st.isGame && !st.revealed;
    var firing = pulse && pulse.active && (performance.now() - pulse.started) < 1100;

    // เลนส์นูน 3 มิติตรงกลาง
    r.addCylinder([0, 46, -6], [0, 46, 6], 40, 40, pal.glass, 0.42, 18);
    r.addRing([0, 8, 0], 14, pal.metal, 2);
    r.addLabel([0, 96, 0], "เลนส์นูน (f=" + f + "ซม.)");

    // โฟกัส F ด้านหน้าและหลัง
    r.addSphere([-f * scale, 10, 0], 4, pal.gold, 1, false);
    r.addSphere([f * scale, 10, 0], 4, pal.gold, 1, false);

    // วัตถุ (เสาเรืองแสง 3 มิติ) ที่ระยะ s
    r.addArrow([objX, 8, 0], [objX, 60, 0], 3, pal.danger, "วัตถุ s=" + s);

    // ฉากเป้าหมาย 3 มิติในโหมดเกม
    if (st.targetDist) {
      var tx = clamp(st.targetDist * scale, 30, 155);
      r.addBox(tx, 46, 0, 6, 76, 48, pal.gold, 0.35, pal.gold);
      r.addLabel([tx, 94, 0], "🎯 ฉากเป้า " + st.targetDist.toFixed(1) + "ซม.");
    }

    // ลำแสงเลเซอร์ 3 มิติ (แสดงเส้นเต็มเมื่อไม่ใช่เกม หรือหลังกดฉายแสง)
    if (!isHidden || firing) {
      var sp = Math.abs(s - f) > 0.4 ? (s * f) / (s - f) : 999;
      if (sp > 0 && sp < 140) {
        var imgX = clamp(sp * scale, 18, 160);
        var m = -sp / s;
        var imgY = clamp(8 + m * 52, 8, 90);
        r.addArrow([imgX, 46, 0], [imgX, 46 + m * 36, 0], 2.5, pal.emerald, "ภาพ s'=" + sp.toFixed(1));
        r.addCylinder([objX, 60, 0], [0, 60, 0], 1.8, 1.8, pal.danger, 1);
        r.addCylinder([0, 60, 0], [imgX, 46 + m * 36, 0], 1.8, 1.8, pal.danger, 1);
        r.addCylinder([objX, 60, 0], [imgX, 46 + m * 36, 0], 1.6, 1.6, pal.gold, 1);
      }
    } else {
      // เส้นไกด์สั้นๆ ก่อนกดฉายแสง
      r.addLine([objX, 60, 0], [objX + 26, 60, 0], pal.danger, 2.2, true);
    }
  };

  SCENES["magnetic-induction"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(165, 110, 35);
    var B = st.B !== undefined ? st.B : 1.0;
    var v = st.v !== undefined ? st.v : 4;
    var wireMode = !!st.wireMode;

    // แท่งแม่เหล็ก N-S 3 มิติอยู่ด้านล่าง
    r.addBox(-34, 14, 0, 68, 22, 34, pal.danger, 1, pal.metalDark);
    r.addBox(34, 14, 0, 68, 22, 34, pal.accent, 1, pal.metalDark);
    r.addLabel([-36, 34, 0], "ขั้ว N");
    r.addLabel([36, 34, 0], "ขั้ว S");

    // เส้นสนามแม่เหล็ก 3 มิติรอบทิศหลายระนาบ
    for (var az = -2; az <= 2; az++) {
      var ang = az * 0.48;
      var arc = [];
      for (var k = 0; k <= 20; k++) {
        var f = k / 20;
        var lx = -58 + f * 116;
        var bulge = Math.sin(f * Math.PI) * (54 + Math.abs(az) * 14);
        arc.push([lx, 24 + bulge * Math.cos(ang), bulge * Math.sin(ang)]);
      }
      r.addCurve(arc, pal.glass, 1.6, true);
    }

    if (wireMode) {
      // รางตัวนำเคลื่อนที่ตัดสนามแม่เหล็ก B
      var railX = clamp(Math.sin(time * (0.8 + v * 0.15)) * 45, -55, 55);
      r.addBox(0, 62, -26, 140, 4, 4, pal.metal, 1);
      r.addBox(0, 62, 26, 140, 4, 4, pal.metal, 1);
      r.addCylinder([railX, 62, -28], [railX, 62, 28], 4, 4, pal.gold, 1);
      r.addLabel([railX, 86, 0], "EMF = Blv");
    } else {
      // ประจุ +q เคลื่อนที่โคจรไซโคลตรอนในสนามแม่เหล็ก 3D
      var rad = clamp(24 + v * 3, 22, 54);
      var theta = time * clamp(0.8 + B * 0.9, 0.5, 4);
      var cx = rad * Math.cos(theta);
      var cz = rad * Math.sin(theta);
      r.addRing([0, 68, 0], rad, pal.emerald, 1.5);
      r.addSphere([cx, 68, cz], 7, pal.danger, 1, true);
      r.addArrow([cx, 68, cz], [0, 68, 0], 2, pal.emerald, "FB");
      r.addLabel([0, 108, 0], "B = " + B.toFixed(1) + " T");
    }
  };

  SCENES["modern-quantum"] = function (r, st, time, pulse) {
    var pal = r.pal;
    var mode = st.mode || "photoelectric";
    r.addFloorGrid(170, 100, 35);

    if (mode === "decay") {
      // กลุ่มนิวเคลียสกัมมันตรังสี 3 มิติ (เหลือง=ยังไม่สลาย, เทา/ฟ้า=สลายแล้ว)
      var frac = clamp(st.remainFrac !== undefined ? st.remainFrac : 0.5, 0.02, 1);
      var total = 27;
      var activeCount = Math.round(total * frac);
      var idx = 0;
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = 0; iy < 3; iy++) {
          for (var iz = -1; iz <= 1; iz++) {
            var jitter = idx < activeCount ? Math.sin(time * 5 + idx) * 1.5 : 0;
            r.addSphere(
              [ix * 24 + jitter, 24 + iy * 24, iz * 24],
              8,
              idx < activeCount ? pal.gold : pal.metal,
              idx < activeCount ? 1 : 0.45,
              iy === 0
            );
            idx++;
          }
        }
      }
      r.addLabel([0, 108, 0], "คงเหลือ " + (frac * 100).toFixed(0) + "%");
      return;
    }

    if (mode === "relativity") {
      // ยานอวกาศสัมพัทธภาพเคลื่อนที่ด้วยความเร็วสูง beta*c และหดตัวเชิงโลเรนตซ์
      var beta = clamp(st.beta || 0.6, 0.05, 0.98);
      var gamma = 1 / Math.sqrt(1 - beta * beta);
      var xPos = Math.sin(time * beta * 3.2) * 85;
      var len = clamp(82 / gamma, 18, 82);
      r.addBox(xPos, 36, 0, len, 22, 32, pal.accent, 1, pal.metalDark);
      r.addCylinder([xPos - len * 0.5 - 16, 36, 0], [xPos - len * 0.5, 36, 0], 7, 3, pal.gold, 0.8);
      r.addLabel([xPos, 72, 0], "v = " + beta.toFixed(2) + "c (γ=" + gamma.toFixed(2) + ")");
      return;
    }

    // โหมด photoelectric: หลอดสุญญากาศ 3 มิติ + แผ่นโลหะแคโทด + ขั้วแอโนด
    var W0 = st.W0 || 2.2;
    var freq = st.f || 10;
    var Ek = st.Ek !== undefined ? st.Ek : Math.max(0, 0.4136 * freq - W0);
    var isHidden = !!st.isGame && !st.revealed;
    var firing = pulse && pulse.active && (performance.now() - pulse.started) < 1200;

    r.addCylinder([-95, 48, 0], [95, 48, 0], 46, 46, pal.glass, 0.2, 16);
    r.addBox(-72, 48, 0, 10, 62, 44, pal.metalDark, 1);
    r.addBox(74, 48, 0, 8, 62, 44, pal.gold, 0.9);
    r.addLabel([-72, 92, 0], "โลหะ W₀=" + W0 + "eV");

    // ลำโฟตอนพุ่งชนแคโทด
    var photCol = freq > 10 ? pal.accent : freq > 7 ? pal.emerald : pal.danger;
    for (var p = 0; p < 3; p++) {
      var pf = (time * 0.9 + p * 0.33) % 1;
      var px = -140 + 68 * pf;
      r.addSphere([px, 56 - p * 8, 0], 4.5, photCol, 1, false);
    }

    // อิเล็กตรอนหลุดวิ่งข้ามหลอดเมื่อ Ek > 0 และเปิดแสดงผล
    if ((!isHidden || firing) && Ek > 0) {
      var eSpd = clamp(0.5 + Ek * 0.55, 0.5, 2.6);
      for (var k = 0; k < 4; k++) {
        var ef = (time * eSpd + k * 0.25) % 1;
        var ex = -65 + 135 * ef;
        r.addSphere([ex, 42 + (k % 2) * 14, (k - 1.5) * 8], 4.8, pal.cyan, 1, false);
      }
    }

    if (isHidden && st.targetEk) {
      r.addLabel([74, 92, 0], "🎯 เป้า Ek = " + st.targetEk.toFixed(1) + " eV");
    } else {
      r.addLabel([74, 92, 0], "Ek = " + Ek.toFixed(2) + " eV");
    }
  };

  // ------------------------------------------------------------------ ตัวจัดการ Viewport & Toolbar 3D
  function attach(container, svgEl, opts) {
    opts = opts || {};
    var kind = opts.kind || "projectile";
    if (!container || !svgEl || !svgEl.parentNode) return null;

    var stage = h("div", { class: "lp3d-stage" });
    var is3D = true;
    var cam = { yaw: 0.62, pitch: 0.38, zoom: 1.16, targetY: 42 };
    var pulseState = { active: false, started: 0 };

    var mode3Btn = h("button", { type: "button", class: "lp3d-btn active", text: "🌐 โมเดล 3D" });
    var mode2Btn = h("button", { type: "button", class: "lp3d-btn", text: "📐 แผนผัง 2D" });
    var freeBtn = h("button", { type: "button", class: "lp3d-btn", text: "🎥 มุมอิสระ" });
    var frontBtn = h("button", { type: "button", class: "lp3d-btn", text: "ด้านหน้า" });
    var topBtn = h("button", { type: "button", class: "lp3d-btn", text: "ด้านบน" });
    var zoomInBtn = h("button", { type: "button", class: "lp3d-btn", text: "➕", title: "ซูมเข้า" });
    var zoomOutBtn = h("button", { type: "button", class: "lp3d-btn", text: "➖", title: "ซูมออก" });
    var resetBtn = h("button", { type: "button", class: "lp3d-btn", text: "🔄 รีเซ็ต" });
    var fsBtn = h("button", { type: "button", class: "lp3d-btn lp3d-fs-btn", text: "⛶ เต็มจอ" });

    var toolbar = h("div", { class: "lp3d-toolbar" }, [
      h("div", { class: "lp3d-group" }, [mode3Btn, mode2Btn]),
      h("div", { class: "lp3d-group" }, [freeBtn, frontBtn, topBtn, zoomInBtn, zoomOutBtn, resetBtn]),
      h("div", { class: "lp3d-group" }, [fsBtn]),
    ]);

    var canvas = h("canvas", {
      class: "lp3d-canvas",
      role: "img",
      "aria-label": "โมเดลฟิสิกส์ 3 มิติ ลากเพื่อหมุนมุมมองได้รอบทิศ",
    });
    var hint = h("div", {
      class: "lp3d-hint",
      text: "🖱️ ลากเพื่อหมุน 3D 360° • กดปุ่มเปลี่ยนมุมกล้องได้",
    });
    var canvasWrap = h("div", { class: "lp3d-canvas-wrap" }, [canvas, hint]);

    var parent = svgEl.parentNode;
    parent.insertBefore(stage, svgEl);
    stage.appendChild(toolbar);
    stage.appendChild(canvasWrap);
    stage.appendChild(svgEl);
    svgEl.classList.add("lp3d-svg-fallback");
    svgEl.style.display = "none";
    svgEl.setAttribute("hidden", "");

    var renderer = new SceneRenderer(canvas, cam);
    var rafId = null;

    function syncModeUI() {
      mode3Btn.classList.toggle("active", is3D);
      mode2Btn.classList.toggle("active", !is3D);
      canvasWrap.hidden = !is3D;
      canvasWrap.style.display = is3D ? "" : "none";
      svgEl.style.display = is3D ? "none" : "";
      if (is3D) svgEl.setAttribute("hidden", "");
      else svgEl.removeAttribute("hidden");
    }

    mode3Btn.addEventListener("click", function () {
      is3D = true;
      syncModeUI();
    });
    mode2Btn.addEventListener("click", function () {
      is3D = false;
      syncModeUI();
    });
    freeBtn.addEventListener("click", function () {
      cam.yaw = 0.62;
      cam.pitch = 0.38;
      renderNow();
    });
    frontBtn.addEventListener("click", function () {
      cam.yaw = 0;
      cam.pitch = 0.08;
      renderNow();
    });
    topBtn.addEventListener("click", function () {
      cam.yaw = 0;
      cam.pitch = 1.32;
      renderNow();
    });
    zoomInBtn.addEventListener("click", function () {
      cam.zoom = clamp(cam.zoom + 0.18, 0.55, 2.4);
      renderNow();
    });
    zoomOutBtn.addEventListener("click", function () {
      cam.zoom = clamp(cam.zoom - 0.18, 0.55, 2.4);
      renderNow();
    });
    resetBtn.addEventListener("click", function () {
      cam.yaw = 0.62;
      cam.pitch = 0.38;
      cam.zoom = 1.16;
      renderNow();
    });

    function toggleFullscreen() {
      var full = stage.classList.toggle("lp3d-fullscreen");
      fsBtn.textContent = full ? "✕ ย่อจอ" : "⛶ เต็มจอ";
      fsBtn.classList.toggle("active", full);
      renderNow();
    }
    fsBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && stage.classList.contains("lp3d-fullscreen")) {
        toggleFullscreen();
      }
    });

    // ลากเมาส์หรือนิ้วเพื่อหมุนกล้อง 360°
    var dragging = false;
    var lastX = 0;
    var lastY = 0;
    canvas.addEventListener("pointerdown", function (e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cam.yaw += dx * 0.01;
      cam.pitch = clamp(cam.pitch + dy * 0.008, 0.05, 1.45);
      renderNow();
    });
    window.addEventListener("pointerup", function () {
      dragging = false;
    });
    canvas.addEventListener(
      "wheel",
      function (e) {
        if (!stage.classList.contains("lp3d-fullscreen") && !e.shiftKey) return;
        e.preventDefault();
        cam.zoom = clamp(cam.zoom + (e.deltaY < 0 ? 0.1 : -0.1), 0.55, 2.4);
        renderNow();
      },
      { passive: false }
    );

    function renderNow() {
      if (!is3D || !document.contains(stage)) return;
      var st = opts.getState ? opts.getState() : {};
      var tSec = performance.now() / 1000;
      var fn = SCENES[kind] || SCENES.projectile;
      renderer.begin();
      fn(renderer, st || {}, tSec, pulseState);
      renderer.end();
    }

    function loop() {
      if (!document.contains(stage)) return;
      if (is3D) renderNow();
      rafId = requestAnimationFrame(loop);
    }
    syncModeUI();
    renderNow();
    rafId = requestAnimationFrame(loop);

    return {
      stage: stage,
      canvas: canvas,
      renderNow: renderNow,
      pulse: function (extra) {
        pulseState = Object.assign({ active: true, started: performance.now() }, extra || {});
        renderNow();
      },
      destroy: function () {
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
  }

  window.LP3D = {
    attach: attach,
    listScenes: function () {
      return Object.keys(SCENES);
    },
  };
})();
