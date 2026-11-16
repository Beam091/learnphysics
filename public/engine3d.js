// ระบบจำลองฟิสิกส์ 3 มิติ (LearnPhysics v6.0.0 Ultra Studio PBR 3D Renderer & Camera Controller)
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

  function add3(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  function mul3(v, s) {
    return [v[0] * s, v[1] * s, v[2] * s];
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
    if (!hex || typeof hex !== "string") return [74, 125, 255];
    if (hex[0] === "#") {
      var h = hex.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [
        parseInt(h.slice(0, 2), 16) || 0,
        parseInt(h.slice(2, 4), 16) || 0,
        parseInt(h.slice(4, 6), 16) || 0,
      ];
    }
    var m = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      return [
        clamp(parseInt(m[1], 10) || 0, 0, 255),
        clamp(parseInt(m[2], 10) || 0, 0, 255),
        clamp(parseInt(m[3], 10) || 0, 0, 255),
      ];
    }
    return [74, 125, 255];
  }

  function mixHex(hexA, hexB, t, alpha) {
    var a = parseHexColor(hexA);
    var b = parseHexColor(hexB);
    var f = clamp(t, 0, 1);
    var r = clamp(Math.round(a[0] + (b[0] - a[0]) * f), 0, 255);
    var g = clamp(Math.round(a[1] + (b[1] - a[1]) * f), 0, 255);
    var bl = clamp(Math.round(a[2] + (b[2] - a[2]) * f), 0, 255);
    if (alpha !== undefined && alpha < 0.999) {
      return "rgba(" + r + "," + g + "," + bl + "," + clamp(alpha, 0, 1).toFixed(3) + ")";
    }
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  function shadeColor(hex, intensity, alpha, specAdd) {
    var rgb = parseHexColor(hex);
    var add = specAdd ? specAdd * 255 : 0;
    var r = Math.round(clamp(rgb[0] * intensity + add, 0, 255));
    var g = Math.round(clamp(rgb[1] * intensity + add, 0, 255));
    var b = Math.round(clamp(rgb[2] * intensity + add, 0, 255));
    if (alpha !== undefined && alpha < 0.999) {
      return "rgba(" + r + "," + g + "," + b + "," + clamp(alpha, 0, 1).toFixed(3) + ")";
    }
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // Smooth 64-sample Catmull-Rom curve sampler to eliminate polygonal kinks
  function sampleCatmullRom(pts, targetCount) {
    if (!pts || pts.length < 2) return pts || [];
    if (pts.length === 2) {
      var out2 = [];
      var segs2 = Math.min(16, targetCount || 12);
      for (var k = 0; k <= segs2; k++) {
        var f = k / segs2;
        out2.push([
          pts[0][0] + (pts[1][0] - pts[0][0]) * f,
          pts[0][1] + (pts[1][1] - pts[0][1]) * f,
          pts[0][2] + (pts[1][2] - pts[0][2]) * f,
        ]);
      }
      return out2;
    }
    if (pts.length >= targetCount) return pts;
    var n = pts.length;
    var out = [];
    var samples = targetCount - 1;
    for (var i = 0; i <= samples; i++) {
      var u = (i / samples) * (n - 1);
      var idx = Math.min(n - 2, Math.floor(u));
      var t = u - idx;
      var p0 = pts[Math.max(0, idx - 1)];
      var p1 = pts[idx];
      var p2 = pts[Math.min(n - 1, idx + 1)];
      var p3 = pts[Math.min(n - 1, idx + 2)];
      var t2 = t * t;
      var t3 = t2 * t;
      var res = [0, 0, 0];
      for (var c = 0; c < 3; c++) {
        res[c] =
          0.5 *
          (2 * p1[c] +
            (-p0[c] + p2[c]) * t +
            (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
            (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
      }
      out.push(res);
    }
    return out;
  }

  function isDarkActive() {
    var htmlEl = document.documentElement;
    var attr = htmlEl.getAttribute("data-theme");
    return (
      attr === "dark" ||
      htmlEl.classList.contains("dark") ||
      (attr !== "light" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  }

  function getThemeColors() {
    var dark = isDarkActive();
    if (dark) {
      return {
        isDark: true,
        skyTop: "#071120",
        skyMid: "#0f1f38",
        skyHor: "#172a46",
        floorNear: "#0c172a",
        floorMid: "#122139",
        floorFar: "#172a46",
        floorEdge: "rgba(148, 197, 255, 0.24)",
        gridRgb: "148, 184, 248",
        floorAxis: "rgba(186, 214, 255, 0.26)",
        titanium: "#7c8ca3",
        metal: "#64748b",
        metalLight: "#94a3b8",
        metalDark: "#1b2434",
        graphite: "#2d394c",
        brass: "#eab308",
        bronze: "#c28538",
        accent: "#3b82f6",
        cobalt: "#3b82f6",
        orange: "#fb923c",
        gold: "#fbbf24",
        ivory: "#ebe3d5",
        danger: "#fb7185",
        emerald: "#34d399",
        cyan: "#22d3ee",
        glass: "#93c5fd",
        violet: "#a78bfa",
        dialFace: "#e2e8f0",
        shadowRgb: "4, 8, 18",
      };
    }
    return {
      isDark: false,
      skyTop: "#b8d8ff",
      skyMid: "#deeeff",
      skyHor: "#f7fbff",
      floorNear: "#c9d9ef",
      floorMid: "#e3edfb",
      floorFar: "#f5f9ff",
      floorEdge: "rgba(255, 255, 255, 0.94)",
      gridRgb: "74, 106, 158",
      floorAxis: "rgba(54, 82, 136, 0.28)",
      titanium: "#9aa8bc",
      metal: "#56657a",
      metalLight: "#96a5ba",
      metalDark: "#1d2430",
      graphite: "#2c3545",
      brass: "#d49b38",
      bronze: "#a86f32",
      accent: "#2563eb",
      cobalt: "#1d63f2",
      orange: "#f97316",
      gold: "#f59e0b",
      ivory: "#f2ebe0",
      danger: "#e11d48",
      emerald: "#059669",
      cyan: "#0891b2",
      glass: "#60a5fa",
      violet: "#7c3aed",
      dialFace: "#f8fafc",
      shadowRgb: "16, 30, 56",
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

  function clipSegCam(a, b, nearZ) {
    var aIn = a[2] >= nearZ;
    var bIn = b[2] >= nearZ;
    if (!aIn && !bIn) return null;
    if (aIn && bIn) return [a, b];
    var denom = b[2] - a[2];
    var t = Math.abs(denom) > 1e-6 ? (nearZ - a[2]) / denom : 0.5;
    var hit = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      nearZ,
    ];
    return aIn ? [a, hit] : [hit, b];
  }

  // ------------------------------------------------------------------ ตัวเรนเดอร์ Ultra Studio PBR 3D (v6.0)
  function SceneRenderer(canvas, cam) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = cam;
    this.queue = [];
    this.floorQueue = [];
    this.shadowQueue = [];
    this.w = 680;
    this.h = 360;
    this.lightDir = norm3([-0.42, 0.86, 0.54]);
    this.hasFloor = false;
    this.floorStep = 38;
  }

  SceneRenderer.prototype.begin = function () {
    var rect = this.canvas.getBoundingClientRect();
    var cssW = Math.max(260, Math.round(rect.width || this.canvas.clientWidth || 680));
    var cssH = Math.max(220, Math.round(rect.height || this.canvas.clientHeight || 360));
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

    var sky = ctx.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(0.38, pal.skyMid);
    sky.addColorStop(0.74, pal.skyHor);
    sky.addColorStop(1, pal.skyHor);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);

    this.queue = [];
    this.floorQueue = [];
    this.shadowQueue = [];
    this.hasFloor = false;
    this.floorStep = 38;

    this.cosY = Math.cos(this.cam.yaw);
    this.sinY = Math.sin(this.cam.yaw);
    this.cosP = Math.cos(this.cam.pitch);
    this.sinP = Math.sin(this.cam.pitch);
    this.camDist = 280;
    this.fov = Math.min(cssW * 0.85, cssH * 1.48) * 1.24 * clamp(this.cam.zoom, 0.55, 2.6);
    var ty = this.cam.targetY !== undefined ? this.cam.targetY : 36;
    this.camPos = [
      this.camDist * this.cosP * this.sinY,
      ty + this.camDist * this.sinP,
      this.camDist * this.cosP * this.cosY,
    ];
  };

  SceneRenderer.prototype.toCam = function (p) {
    var ty = this.cam.targetY !== undefined ? this.cam.targetY : 36;
    var x = p[0];
    var y = p[1] - ty;
    var z = p[2];
    var x1 = x * this.cosY - z * this.sinY;
    var z1 = x * this.sinY + z * this.cosY;
    var y2 = y * this.cosP - z1 * this.sinP;
    var z2 = y * this.sinP + z1 * this.cosP;
    return [x1, y2, this.camDist - z2];
  };

  SceneRenderer.prototype.projCam = function (c) {
    var z = c[2];
    if (z < 28) return null;
    var s = this.fov / z;
    return {
      x: this.w * 0.5 + c[0] * s,
      y: this.h * 0.57 - c[1] * s,
      z: z,
      s: s,
      cam: c,
    };
  };

  SceneRenderer.prototype.proj = function (p) {
    return this.projCam(this.toCam(p));
  };

  SceneRenderer.prototype.drawStudioFloor = function (ctx) {
    var pal = this.pal;
    var w = this.w;
    var h = this.h;
    var ty = this.cam.targetY !== undefined ? this.cam.targetY : 36;
    var cy = h * 0.57;
    var fov = this.fov;
    var d = this.camDist;

    // Full-bleed gently-curved porcelain studio floor across 0..w down to bottom corners
    var horPts = [];
    var minY = h;
    var allAboveTop = this.cam.pitch >= 1.15;
    if (allAboveTop) {
      minY = 0;
      horPts.push({ x: -4, y: -4 });
      horPts.push({ x: w + 4, y: -4 });
    } else {
      var cols = 48;
      for (var i = 0; i <= cols; i++) {
        var xs = -4 + ((w + 8) * i) / cols;
        var dx = (xs - w * 0.5) / fov;
        var D = 600 / (1 + 0.80 * dx * dx);
        var c1 = D * this.sinP - ty * this.cosP;
        var c2 = d + D * this.cosP + ty * this.sinP;
        var yh = clamp(cy - fov * (c1 / c2), -24, h - 24);
        if (yh < minY) minY = yh;
        horPts.push({ x: xs, y: yh });
      }
    }

    var gTop = clamp(minY, 0, h - 24);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-4, h + 4);
    for (var j = 0; j < horPts.length; j++) {
      ctx.lineTo(horPts[j].x, horPts[j].y);
    }
    ctx.lineTo(w + 4, h + 4);
    ctx.closePath();

    var flGrad = ctx.createLinearGradient(0, gTop, 0, h);
    flGrad.addColorStop(0, pal.floorFar);
    flGrad.addColorStop(0.32, pal.floorMid);
    flGrad.addColorStop(0.76, pal.floorNear);
    flGrad.addColorStop(1, pal.floorNear);
    ctx.fillStyle = flGrad;
    ctx.fill();

    ctx.clip();

    // Infinite radial distance-faded floor grid (-420..+420 X, -360..+360 Z, step ~38)
    var step = this.floorStep || 38;
    var buckets = [[], [], [], [], [], []];
    var self = this;

    function pushGridSeg(a3, b3, mx, mz) {
      var dist = Math.hypot(mx, mz);
      var att = Math.exp(-dist / 260);
      if (att < 0.04) return;
      var seg = clipSegCam(self.toCam(a3), self.toCam(b3), 28);
      if (!seg) return;
      var pa = self.projCam(seg[0]);
      var pb = self.projCam(seg[1]);
      if (!pa || !pb) return;
      if ((pa.x < -40 && pb.x < -40) || (pa.x > w + 40 && pb.x > w + 40)) return;
      if ((pa.y < -40 && pb.y < -40) || (pa.y > h + 40 && pb.y > h + 40)) return;
      var bIdx = Math.min(5, Math.floor(att * 6));
      buckets[bIdx].push(pa.x, pa.y, pb.x, pb.y);
    }

    var xSegs = 10;
    var zMin = -360;
    var zMax = 360;
    for (var gx = -418; gx <= 418; gx += step) {
      for (var zi = 0; zi < xSegs; zi++) {
        var za = zMin + ((zMax - zMin) * zi) / xSegs;
        var zb = zMin + ((zMax - zMin) * (zi + 1)) / xSegs;
        pushGridSeg([gx, 0, za], [gx, 0, zb], gx, (za + zb) * 0.5);
      }
    }

    var zSegs = 11;
    var xMin = -420;
    var xMax = 420;
    for (var gz = -342; gz <= 342; gz += step) {
      for (var xi = 0; xi < zSegs; xi++) {
        var xa = xMin + ((xMax - xMin) * xi) / zSegs;
        var xb = xMin + ((xMax - xMin) * (xi + 1)) / zSegs;
        pushGridSeg([xa, 0, gz], [xb, 0, gz], (xa + xb) * 0.5, gz);
      }
    }

    var maxGridAlpha = pal.isDark ? 0.22 : 0.23;
    ctx.lineWidth = 0.9;
    for (var bi = 0; bi < buckets.length; bi++) {
      var arr = buckets[bi];
      if (!arr.length) continue;
      var bAlpha = ((bi + 0.55) / 6) * maxGridAlpha;
      ctx.beginPath();
      for (var si = 0; si < arr.length; si += 4) {
        ctx.moveTo(arr[si], arr[si + 1]);
        ctx.lineTo(arr[si + 2], arr[si + 3]);
      }
      ctx.strokeStyle = "rgba(" + pal.gridRgb + "," + bAlpha.toFixed(3) + ")";
      ctx.stroke();
    }

    // Height-attenuated floor mirror reflections (sorted far-to-near)
    this.floorQueue.sort(function (a, b) {
      return b.z - a.z;
    });
    for (var fi = 0; fi < this.floorQueue.length; fi++) {
      this.floorQueue[fi].draw(ctx);
    }

    // Specular porcelain studio sheen painted over reflections
    var sheenGrad = ctx.createLinearGradient(0, gTop, 0, h);
    sheenGrad.addColorStop(0, pal.isDark ? "rgba(23, 42, 70, 0.42)" : "rgba(255, 255, 255, 0.48)");
    sheenGrad.addColorStop(0.36, pal.isDark ? "rgba(23, 42, 70, 0.14)" : "rgba(247, 251, 255, 0.16)");
    sheenGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, gTop, w, h - gTop + 4);

    var cen = this.proj([0, 0, 0]);
    if (cen) {
      var sheenR = Math.max(110, cen.s * 145);
      var sh = ctx.createRadialGradient(cen.x, cen.y, 8, cen.x, cen.y, sheenR);
      sh.addColorStop(0, pal.isDark ? "rgba(96, 165, 250, 0.09)" : "rgba(255, 255, 255, 0.44)");
      sh.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, w, h);
    }

    // 2-Layer AO Contact & Soft Directional Cast Shadows (sorted far-to-near)
    this.shadowQueue.sort(function (a, b) {
      return b.z - a.z;
    });
    for (var sIdx = 0; sIdx < this.shadowQueue.length; sIdx++) {
      this.shadowQueue[sIdx].draw(ctx);
    }

    ctx.restore();

    // Subtle crisp horizon rim highlight along the gently-curved floor boundary
    if (!allAboveTop) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(horPts[0].x, horPts[0].y);
      for (var k = 1; k < horPts.length; k++) {
        ctx.lineTo(horPts[k].x, horPts[k].y);
      }
      ctx.strokeStyle = pal.floorEdge;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
  };

  SceneRenderer.prototype.addFloorGrid = function (halfW, halfD, step) {
    this.hasFloor = true;
    this.floorStep = step && step >= 34 && step <= 44 ? step : 38;
  };

  SceneRenderer.prototype.addContactShadow = function (x, z, rx, rz, strength) {
    var pr = this.proj([x, 0.12, z]);
    if (!pr) return;
    var aspect = clamp(0.26 + 0.68 * this.sinP, 0.26, 0.94);
    var pxRx = Math.max(2.6, rx * pr.s);
    var pxRz = Math.max(1.8, (rz || rx) * pr.s * aspect);
    var st = clamp(strength !== undefined ? strength : 0.30, 0.03, 0.56);
    var rgb = this.pal.shadowRgb;
    this.shadowQueue.push({
      z: pr.z,
      draw: function (ctx) {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.scale(1, pxRz / pxRx);
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, pxRx);
        g.addColorStop(0, "rgba(" + rgb + "," + st.toFixed(3) + ")");
        g.addColorStop(0.45, "rgba(" + rgb + "," + (st * 0.52).toFixed(3) + ")");
        g.addColorStop(0.80, "rgba(" + rgb + "," + (st * 0.14).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.beginPath();
        ctx.arc(0, 0, pxRx, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      },
    });
  };

  // 2-Layer shadow: tight dark contact AO footprint + wider soft offset directional cast ellipse
  SceneRenderer.prototype.addShadow2Layer = function (x, alt, z, rx, rz, strength) {
    var a = Math.max(0, alt || 0);
    var baseSt = clamp(strength !== undefined ? strength : 0.32, 0.05, 0.55);
    var aoAtt = Math.exp(-a / 30);
    if (aoAtt > 0.08) {
      this.addContactShadow(x, z, rx * 0.84, (rz || rx) * 0.84, baseSt * 1.15 * aoAtt);
    }
    var castAtt = Math.exp(-a / 145);
    if (castAtt > 0.06) {
      var offScale = 0.42 * clamp(a + 6, 4, 52);
      var sx = x - (this.lightDir[0] / this.lightDir[1]) * offScale;
      var sz = z - (this.lightDir[2] / this.lightDir[1]) * offScale;
      this.addContactShadow(sx, sz, rx * 1.38, (rz || rx) * 1.32, baseSt * 0.46 * castAtt);
    }
  };

  SceneRenderer.prototype.addPoly = function (pts3, color, alpha, strokeColor, forceTwoSided, reflectFloor, customNormal) {
    var sps = [];
    var sumZ = 0;
    var cx = 0;
    var cy = 0;
    var cz = 0;
    for (var i = 0; i < pts3.length; i++) {
      var pr = this.proj(pts3[i]);
      if (!pr) return;
      sps.push(pr);
      sumZ += pr.z;
      cx += pts3[i][0];
      cy += pts3[i][1];
      cz += pts3[i][2];
    }
    var nPts = pts3.length;
    cx /= nPts;
    cy /= nPts;
    cz /= nPts;

    var wn = customNormal ? norm3(customNormal) : norm3(cross3(sub3(pts3[1], pts3[0]), sub3(pts3[2], pts3[0])));
    var viewDir = norm3(sub3(this.camPos, [cx, cy, cz]));
    if (dot3(wn, viewDir) < 0) {
      wn = [-wn[0], -wn[1], -wn[2]];
    }
    var al = alpha !== undefined ? alpha : 1;
    var ndotl = clamp(dot3(wn, this.lightDir), 0, 1);
    var hemi = 0.46 + 0.16 * clamp(wn[1], -1, 1);
    var halfV = norm3([
      this.lightDir[0] + viewDir[0],
      this.lightDir[1] + viewDir[1],
      this.lightDir[2] + viewDir[2],
    ]);
    var spec = Math.pow(clamp(dot3(wn, halfV), 0, 1), 28) * 0.28;
    var effAlpha = al;
    if (al < 0.9) {
      var fresnel = Math.pow(clamp(1 - Math.abs(dot3(wn, viewDir)), 0, 1), 2.1);
      spec += fresnel * 0.34;
      effAlpha = clamp(al + fresnel * 0.28, 0.08, 0.94);
    }
    var shade = hemi + 0.56 * ndotl;
    var fill = shadeColor(color, shade, effAlpha, spec);
    var avgZ = sumZ / nPts;

    this.queue.push({
      z: avgZ,
      draw: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(sps[0].x, sps[0].y);
        for (var j = 1; j < sps.length; j++) ctx.lineTo(sps[j].x, sps[j].y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (!strokeColor && effAlpha >= 0.88) {
          ctx.strokeStyle = fill;
          ctx.lineWidth = 0.65;
          ctx.lineJoin = "round";
          ctx.stroke();
        }
        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      },
    });

    if (reflectFloor && cy > 0.2 && cy < 42) {
      var refAlpha = clamp(al * Math.exp(-Math.max(0, cy) / 24) * 0.14, 0, 0.14);
      if (refAlpha < 0.012) return;
      var refSps = [];
      var refZ = 0;
      for (var k = 0; k < nPts; k++) {
        var rp = this.proj([pts3[k][0], -Math.min(22, Math.max(0, pts3[k][1]) * 0.42), pts3[k][2]]);
        if (!rp) return;
        refSps.push(rp);
        refZ += rp.z;
      }
      var refFill = shadeColor(color, shade * 0.92, refAlpha, 0);
      this.floorQueue.push({
        z: refZ / nPts,
        draw: function (ctx) {
          ctx.beginPath();
          ctx.moveTo(refSps[0].x, refSps[0].y);
          for (var m = 1; m < refSps.length; m++) ctx.lineTo(refSps[m].x, refSps[m].y);
          ctx.closePath();
          ctx.fillStyle = refFill;
          ctx.fill();
        },
      });
    }
  };

  SceneRenderer.prototype.addLine = function (a, b, color, width, dashed, zBias) {
    var seg = clipSegCam(this.toCam(a), this.toCam(b), 28);
    if (!seg) return;
    var pa = this.projCam(seg[0]);
    var pb = this.projCam(seg[1]);
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

  // High-resolution 64-sample 3D trajectory tube (bloom + core + offset white specular ribbon)
  SceneRenderer.prototype._renderTubeDense = function (dense, color, width, dashed, reflectFloor) {
    if (!dense || dense.length < 2) return;
    var baseW = width || 3.4;
    var glowCol = mixHex(color, "#ffffff", 0.16, 0.24);
    var tubeCol = color;
    var coreCol = mixHex(color, "#ffffff", 0.72, 0.92);
    var chunkSize = 8;
    var dashPhase = 0;

    for (var start = 0; start < dense.length - 1; start += chunkSize) {
      var end = Math.min(dense.length - 1, start + chunkSize);
      var spList = [];
      var sumZ = 0;
      var sumY = 0;
      var valid = true;
      for (var i = start; i <= end; i++) {
        var pr = this.proj(dense[i]);
        if (!pr) {
          valid = false;
          break;
        }
        spList.push(pr);
        sumZ += pr.z;
        sumY += dense[i][1];
      }
      if (!valid || spList.length < 2) continue;
      var count = spList.length;
      var avgZ = sumZ / count - 2;
      var avgY = sumY / count;
      var localDashOffset = -dashPhase;
      for (var dIdx = 1; dIdx < count; dIdx++) {
        dashPhase += Math.hypot(spList[dIdx].x - spList[dIdx - 1].x, spList[dIdx].y - spList[dIdx - 1].y);
      }

      (function (list, zVal, dOff) {
        this.queue.push({
          z: zVal,
          draw: function (ctx) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            if (dashed) {
              ctx.setLineDash([7, 6]);
              ctx.lineDashOffset = dOff;
            }
            ctx.beginPath();
            ctx.moveTo(list[0].x, list[0].y);
            for (var k = 1; k < list.length; k++) ctx.lineTo(list[k].x, list[k].y);
            ctx.strokeStyle = glowCol;
            ctx.lineWidth = baseW * 2.55;
            ctx.stroke();

            ctx.strokeStyle = tubeCol;
            ctx.lineWidth = baseW * 1.15;
            ctx.stroke();

            ctx.translate(-0.75, -0.95);
            ctx.strokeStyle = coreCol;
            ctx.lineWidth = Math.max(1.0, baseW * 0.36);
            ctx.stroke();
            ctx.restore();
          },
        });
      }).call(this, spList, avgZ, localDashOffset);

      if (reflectFloor !== false && avgY < 48) {
        var refAlpha = clamp(Math.exp(-Math.max(0, avgY) / 26) * 0.15, 0, 0.15);
        if (refAlpha >= 0.014) {
          var refPts = [];
          var refSumZ = 0;
          var refOk = true;
          for (var rIdx = start; rIdx <= end; rIdx++) {
            var p3 = dense[rIdx];
            var rp = this.proj([p3[0], -Math.min(22, Math.max(0, p3[1]) * 0.42), p3[2]]);
            if (!rp) {
              refOk = false;
              break;
            }
            refPts.push(rp);
            refSumZ += rp.z;
          }
          if (refOk && refPts.length >= 2) {
            var refCol = mixHex(color, "#ffffff", 0.12, refAlpha);
            (function (rList, rZ, dOff) {
              this.floorQueue.push({
                z: rZ,
                draw: function (ctx) {
                  ctx.save();
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  if (dashed) {
                    ctx.setLineDash([7, 6]);
                    ctx.lineDashOffset = dOff;
                  }
                  ctx.beginPath();
                  ctx.moveTo(rList[0].x, rList[0].y);
                  for (var m = 1; m < rList.length; m++) ctx.lineTo(rList[m].x, rList[m].y);
                  ctx.strokeStyle = refCol;
                  ctx.lineWidth = baseW * 1.25;
                  ctx.stroke();
                  ctx.restore();
                },
              });
            }).call(this, refPts, refSumZ / refPts.length, localDashOffset);
          }
        }
      }
    }
  };

  SceneRenderer.prototype.addTube3D = function (pts, color, width, dashed, reflectFloor) {
    if (!pts || pts.length < 2) return;
    var dense = sampleCatmullRom(pts, 64);
    this._renderTubeDense(dense, color, width, dashed, reflectFloor);
  };

  SceneRenderer.prototype.addStraightTube3D = function (pts, color, width, dashed, reflectFloor) {
    if (!pts || pts.length < 2) return;
    var dense = [pts[0]];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i];
      var b = pts[i + 1];
      var segLen = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      var steps = Math.max(1, Math.min(24, Math.ceil(segLen / 8)));
      for (var s = 1; s <= steps; s++) {
        var f = s / steps;
        dense.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
      }
    }
    this._renderTubeDense(dense, color, width, dashed, reflectFloor);
  };

  SceneRenderer.prototype.addGlowCurve = SceneRenderer.prototype.addTube3D;

  // Shared helper for plain / chamfered / rotated machined blocks
  SceneRenderer.prototype._emitBlock = function (cx, cy, cz, sx, sy, sz, angZ, chamfer, color, alpha, stroke, reflect, shadow) {
    var hx = sx * 0.5;
    var hy = sy * 0.5;
    var hz = sz * 0.5;
    var ch = chamfer > 0 ? Math.min(chamfer, sx * 0.16, sy * 0.28, sz * 0.18) : 0;
    var c = angZ ? Math.cos(angZ) : 1;
    var s = angZ ? Math.sin(angZ) : 0;
    function xform(lx, ly, lz) {
      return angZ
        ? [cx + lx * c - ly * s, cy + lx * s + ly * c, cz + lz]
        : [cx + lx, cy + ly, cz + lz];
    }

    if (ch < 0.45) {
      var p = [
        xform(-hx, -hy, -hz),
        xform(hx, -hy, -hz),
        xform(hx, hy, -hz),
        xform(-hx, hy, -hz),
        xform(-hx, -hy, hz),
        xform(hx, -hy, hz),
        xform(hx, hy, hz),
        xform(-hx, hy, hz),
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
        this.addPoly([p[f[0]], p[f[1]], p[f[2]], p[f[3]]], color, alpha, stroke, true, reflect && i !== 5);
      }
    } else {
      var ySh = hy - ch;
      var ihx = hx - ch;
      var ihz = hz - ch;
      var v = [
        xform(-hx, -hy, -hz),
        xform(hx, -hy, -hz),
        xform(hx, -hy, hz),
        xform(-hx, -hy, hz),
        xform(-hx, ySh, -hz),
        xform(hx, ySh, -hz),
        xform(hx, ySh, hz),
        xform(-hx, ySh, hz),
        xform(-ihx, hy, -ihz),
        xform(ihx, hy, -ihz),
        xform(ihx, hy, ihz),
        xform(-ihx, hy, ihz),
      ];
      var cFaces = [
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [4, 5, 9, 8],
        [5, 6, 10, 9],
        [6, 7, 11, 10],
        [7, 4, 8, 11],
        [8, 9, 10, 11],
        [0, 1, 2, 3],
      ];
      for (var ci = 0; ci < cFaces.length; ci++) {
        var cf = cFaces[ci];
        var fCol = ci >= 4 && ci <= 7 ? mixHex(color, "#ffffff", 0.14) : color;
        this.addPoly([v[cf[0]], v[cf[1]], v[cf[2]], v[cf[3]]], fCol, alpha, stroke, true, reflect && ci !== 9);
      }
    }

    var bottomY = cy - hy;
    if (shadow !== false && reflect && bottomY <= 18) {
      this.addShadow2Layer(cx, Math.max(0, bottomY), cz, sx * 0.56, sz * 0.56, 0.28);
    }
  };

  SceneRenderer.prototype.addBox = function (cx, cy, cz, sx, sy, sz, color, alpha, stroke, reflect, shadow) {
    this._emitBlock(cx, cy, cz, sx, sy, sz, 0, 0, color, alpha, stroke, reflect, shadow);
  };

  SceneRenderer.prototype.addChamferBox = function (cx, cy, cz, sx, sy, sz, color, alpha, stroke, reflect, shadow) {
    this._emitBlock(cx, cy, cz, sx, sy, sz, 0, 2.2, color, alpha, stroke, reflect, shadow);
  };

  SceneRenderer.prototype.addBevelBox = SceneRenderer.prototype.addChamferBox;

  SceneRenderer.prototype.addRotatedBox = function (cx, cy, cz, sx, sy, sz, angZ, color, alpha, stroke, reflect) {
    this._emitBlock(cx, cy, cz, sx, sy, sz, angZ, 0, color, alpha, stroke, reflect !== false, false);
  };

  SceneRenderer.prototype.addRotatedChamferBox = function (cx, cy, cz, sx, sy, sz, angZ, color, alpha, stroke, reflect) {
    this._emitBlock(cx, cy, cz, sx, sy, sz, angZ, 2.2, color, alpha, stroke, reflect !== false, false);
  };

  // Octagonal corner-chamfered industrial base plinth
  SceneRenderer.prototype.addOctaPlinth = function (cx, cy, cz, sx, sy, sz, cut, color, alpha, reflect) {
    var hx = sx * 0.5;
    var hy = sy * 0.5;
    var hz = sz * 0.5;
    var k = clamp(cut || 4.5, 1.5, Math.min(hx, hz) * 0.45);
    var ch = Math.min(1.6, sy * 0.25);
    var ring = [
      [-hx + k, -hz],
      [hx - k, -hz],
      [hx, -hz + k],
      [hx, hz - k],
      [hx - k, hz],
      [-hx + k, hz],
      [-hx, hz - k],
      [-hx, -hz + k],
    ];
    var bot = [];
    var mid = [];
    var top = [];
    var sc = 1 - ch / Math.max(8, Math.min(hx, hz));
    for (var i = 0; i < 8; i++) {
      bot.push([cx + ring[i][0], cy - hy, cz + ring[i][1]]);
      mid.push([cx + ring[i][0], cy + hy - ch, cz + ring[i][1]]);
      top.push([cx + ring[i][0] * sc, cy + hy, cz + ring[i][1] * sc]);
    }
    for (var j = 0; j < 8; j++) {
      var n = (j + 1) % 8;
      this.addPoly([bot[j], bot[n], mid[n], mid[j]], color, alpha, null, true, reflect && j % 2 === 0);
      this.addPoly([mid[j], mid[n], top[n], top[j]], mixHex(color, "#ffffff", 0.16), alpha, null, true, false);
    }
    this.addPoly(top, mixHex(color, "#ffffff", 0.05), alpha, null, true, false);
    if (reflect && cy - hy <= 14) {
      this.addShadow2Layer(cx, Math.max(0, cy - hy), cz, sx * 0.54, sz * 0.54, 0.30);
    }
  };

  SceneRenderer.prototype.addCylinder = function (a, b, r1, r2, color, alpha, segs, withCaps, reflect, shadow) {
    var dir = sub3(b, a);
    var len = Math.hypot(dir[0], dir[1], dir[2]);
    if (len < 0.1) return;
    var axis = [dir[0] / len, dir[1] / len, dir[2] / len];
    var up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm3(cross3(up, axis));
    var v = norm3(cross3(axis, u));
    var maxRad = Math.max(r1 || 0, r2 || 0);
    var minSegs = maxRad >= 20 ? 32 : maxRad >= 8 ? 22 : maxRad >= 3 ? 14 : 10;
    var N = Math.max(segs || 24, minSegs);
    var axialSlices = len > 36 && withCaps === false ? Math.min(4, Math.ceil(len / 36)) : 1;
    var unitOx = [];
    var unitOy = [];
    var unitOz = [];
    var normRing = [];
    var dr = (r1 - r2) / len;
    for (var i = 0; i < N; i++) {
      var th = (i / N) * Math.PI * 2;
      var ct = Math.cos(th);
      var st = Math.sin(th);
      var ox = u[0] * ct + v[0] * st;
      var oy = u[1] * ct + v[1] * st;
      var oz = u[2] * ct + v[2] * st;
      unitOx.push(ox);
      unitOy.push(oy);
      unitOz.push(oz);
      normRing.push(norm3([ox + axis[0] * dr, oy + axis[1] * dr, oz + axis[2] * dr]));
    }
    var al = alpha !== undefined ? alpha : 1;
    for (var s = 0; s < axialSlices; s++) {
      var f0 = s / axialSlices;
      var f1 = (s + 1) / axialSlices;
      var sa = [a[0] + dir[0] * f0, a[1] + dir[1] * f0, a[2] + dir[2] * f0];
      var sb = [a[0] + dir[0] * f1, a[1] + dir[1] * f1, a[2] + dir[2] * f1];
      var sr1 = r1 + (r2 - r1) * f0;
      var sr2 = r1 + (r2 - r1) * f1;
      var ringA = [];
      var ringB = [];
      for (var k = 0; k < N; k++) {
        ringA.push([sa[0] + unitOx[k] * sr1, sa[1] + unitOy[k] * sr1, sa[2] + unitOz[k] * sr1]);
        ringB.push([sb[0] + unitOx[k] * sr2, sb[1] + unitOy[k] * sr2, sb[2] + unitOz[k] * sr2]);
      }
      for (var m = 0; m < N; m++) {
        var j = (m + 1) % N;
        var nMid = norm3(add3(normRing[m], normRing[j]));
        this.addPoly(
          [ringA[m], ringA[j], ringB[j], ringB[m]],
          color,
          alpha,
          null,
          true,
          reflect && m % 2 === 0,
          nMid
        );
      }
      if (s === 0 && withCaps !== false && r1 > 0.25) {
        this.addPoly(ringA, color, alpha, null, true, false, mul3(axis, -1));
        if (r1 >= 5.5 && al >= 0.9) this._addCapBevel(a, u, v, r1 * 0.92, mixHex(color, "#ffffff", 0.35, 0.45));
      }
      if (s === axialSlices - 1 && withCaps !== false && r2 > 0.25) {
        this.addPoly(ringB, color, alpha, null, true, false, axis);
        if (r2 >= 5.5 && al >= 0.9) this._addCapBevel(b, u, v, r2 * 0.92, mixHex(color, "#ffffff", 0.35, 0.45));
      }
    }
    if (shadow !== false && reflect && Math.min(a[1], b[1]) <= 18) {
      var maxR = Math.max(r1, r2);
      this.addShadow2Layer((a[0] + b[0]) * 0.5, Math.max(0, Math.min(a[1], b[1])), (a[2] + b[2]) * 0.5, maxR * 1.1, maxR * 1.1, 0.26);
    }
  };

  SceneRenderer.prototype._addCapBevel = function (center, u, v, r, color) {
    var N = 20;
    var sps = [];
    var sumZ = 0;
    for (var i = 0; i <= N; i++) {
      var th = (i / N) * Math.PI * 2;
      var ct = Math.cos(th);
      var st = Math.sin(th);
      var pr = this.proj([
        center[0] + (u[0] * ct + v[0] * st) * r,
        center[1] + (u[1] * ct + v[1] * st) * r,
        center[2] + (u[2] * ct + v[2] * st) * r,
      ]);
      if (!pr) return;
      sps.push(pr);
      sumZ += pr.z;
    }
    this.queue.push({
      z: sumZ / sps.length - 0.5,
      draw: function (ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sps[0].x, sps[0].y);
        for (var j = 1; j < sps.length; j++) ctx.lineTo(sps[j].x, sps[j].y);
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addCone = function (a, b, rBase, color, alpha, segs, reflect, shadow) {
    this.addCylinder(a, b, rBase, 0.08, color, alpha, segs || 24, false, reflect, shadow);
    var dir = sub3(b, a);
    var len = Math.hypot(dir[0], dir[1], dir[2]);
    if (len < 0.1 || rBase <= 0.25) return;
    var axis = [dir[0] / len, dir[1] / len, dir[2] / len];
    var up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm3(cross3(up, axis));
    var v = norm3(cross3(axis, u));
    var N = segs || 24;
    var cap = [];
    for (var i = 0; i < N; i++) {
      var th = (i / N) * Math.PI * 2;
      var ct = Math.cos(th);
      var st = Math.sin(th);
      cap.push([a[0] + (u[0] * ct + v[0] * st) * rBase, a[1] + (u[1] * ct + v[1] * st) * rBase, a[2] + (u[2] * ct + v[2] * st) * rBase]);
    }
    this.addPoly(cap, color, alpha, null, true, false, mul3(axis, -1));
  };

  // 5-Layer PBR Clearcoat Sphere
  SceneRenderer.prototype.addSphere = function (pos, radius, color, alpha, shadow) {
    var pr = this.proj(pos);
    if (!pr) return;
    var pxR = Math.max(2.2, radius * pr.s);
    var al = alpha !== undefined ? alpha : 1;
    var alt = Math.max(0, pos[1] - radius);

    if (shadow !== false) {
      var shRad = radius * clamp(1.16 - alt / 260, 0.45, 1.25);
      var shAlpha = clamp(0.32 - alt / 320, 0.08, 0.32) * al;
      this.addShadow2Layer(pos[0], alt, pos[2], shRad, shRad, shAlpha);
    }

    // Height-attenuated studio floor mirror reflection
    if (pos[1] >= 0 && pos[1] < 65) {
      var refAl = clamp(Math.exp(-Math.max(0, pos[1]) / 32) * 0.20 * al, 0, 0.20);
      if (refAl >= 0.012) {
        var refPos = [pos[0], -Math.min(24, pos[1] * 0.48), pos[2]];
        var rp = this.proj(refPos);
        if (rp) {
          var rPx = Math.max(2, radius * rp.s);
          var refColA = mixHex(color, "#ffffff", 0.24, refAl);
          var refColB = shadeColor(color, 0.72, refAl * 0.5);
          this.floorQueue.push({
            z: rp.z,
            draw: function (ctx) {
              ctx.save();
              var g = ctx.createRadialGradient(rp.x, rp.y - rPx * 0.12, rPx * 0.08, rp.x, rp.y, rPx);
              g.addColorStop(0, refColA);
              g.addColorStop(0.72, refColB);
              g.addColorStop(1, "rgba(0,0,0,0)");
              ctx.beginPath();
              ctx.arc(rp.x, rp.y, rPx, 0, Math.PI * 2);
              ctx.fillStyle = g;
              ctx.fill();
              ctx.restore();
            },
          });
        }
      }
    }

    var bounceCol = this.pal.isDark
      ? "rgba(147, 197, 253, " + (0.20 * al).toFixed(3) + ")"
      : "rgba(232, 243, 255, " + (0.38 * al).toFixed(3) + ")";
    var nearGroundAo = alt < radius * 1.4 && pxR >= 4.5 ? clamp(1 - alt / (radius * 1.4), 0, 1) * 0.22 * al : 0;

    this.queue.push({
      z: pr.z,
      draw: function (ctx) {
        ctx.save();

        // Layer 1: Subtle ground-contact AO under sphere when near floor
        if (nearGroundAo > 0.02) {
          var aoG = ctx.createRadialGradient(pr.x, pr.y + pxR * 0.92, 0, pr.x, pr.y + pxR * 0.92, pxR * 1.05);
          aoG.addColorStop(0, "rgba(15, 23, 42, " + nearGroundAo.toFixed(3) + ")");
          aoG.addColorStop(1, "rgba(15, 23, 42, 0)");
          ctx.beginPath();
          ctx.ellipse(pr.x, pr.y + pxR * 0.94, pxR * 0.95, pxR * 0.28, 0, 0, Math.PI * 2);
          ctx.fillStyle = aoG;
          ctx.fill();
        }

        // Layer 2: Hemisphere diffuse radial gradient
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pxR, 0, Math.PI * 2);
        ctx.clip();

        var gx = pr.x - pxR * 0.30;
        var gy = pr.y - pxR * 0.32;
        var grad = ctx.createRadialGradient(gx, gy, pxR * 0.05, pr.x, pr.y, pxR);
        grad.addColorStop(0, mixHex(color, "#ffffff", 0.56, al));
        grad.addColorStop(0.28, shadeColor(color, 1.14, al));
        grad.addColorStop(0.64, shadeColor(color, 0.92, al));
        grad.addColorStop(0.92, shadeColor(color, 0.48, al));
        grad.addColorStop(1, shadeColor(color, 0.62, al));
        ctx.fillStyle = grad;
        ctx.fillRect(pr.x - pxR - 1, pr.y - pxR - 1, pxR * 2 + 2, pxR * 2 + 2);

        // Layer 3: Directional key-light highlight lobe
        var lx = pr.x - pxR * 0.28;
        var ly = pr.y - pxR * 0.28;
        var lobe = ctx.createRadialGradient(lx, ly, 0, lx, ly, pxR * 0.62);
        lobe.addColorStop(0, "rgba(255,255,255," + (0.34 * al).toFixed(3) + ")");
        lobe.addColorStop(0.55, "rgba(255,255,255," + (0.10 * al).toFixed(3) + ")");
        lobe.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lobe;
        ctx.fillRect(pr.x - pxR - 1, pr.y - pxR - 1, pxR * 2 + 2, pxR * 2 + 2);

        // Layer 4: Crisp dual studio window specular catchlight
        if (pxR >= 4.5) {
          var sx = pr.x - pxR * 0.36;
          var sy = pr.y - pxR * 0.36;
          var sr = pxR * 0.25;
          var specG = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          specG.addColorStop(0, "rgba(255,255,255," + (0.86 * al).toFixed(3) + ")");
          specG.addColorStop(0.55, "rgba(255,255,255," + (0.32 * al).toFixed(3) + ")");
          specG.addColorStop(1, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.ellipse(sx, sy, sr * 1.1, sr * 0.78, -0.52, 0, Math.PI * 2);
          ctx.fillStyle = specG;
          ctx.fill();

          if (pxR >= 8) {
            var sx2 = pr.x + pxR * 0.26;
            var sy2 = pr.y - pxR * 0.20;
            var sr2 = pxR * 0.12;
            var spec2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, sr2);
            spec2.addColorStop(0, "rgba(255,255,255," + (0.34 * al).toFixed(3) + ")");
            spec2.addColorStop(1, "rgba(255,255,255,0)");
            ctx.beginPath();
            ctx.arc(sx2, sy2, sr2, 0, Math.PI * 2);
            ctx.fillStyle = spec2;
            ctx.fill();
          }
        }

        // Layer 5: Soft floor bounce rim at bottom edge
        var bG = ctx.createRadialGradient(pr.x, pr.y + pxR * 0.76, pxR * 0.1, pr.x, pr.y + pxR * 0.76, pxR * 0.92);
        bG.addColorStop(0, bounceCol);
        bG.addColorStop(0.55, "rgba(255,255,255,0)");
        bG.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = bG;
        ctx.fillRect(pr.x - pxR - 1, pr.y - pxR - 1, pxR * 2 + 2, pxR * 2 + 2);

        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addRing = function (pos, radius, color, lineW, onFloor) {
    var N = 48;
    var sps = [];
    var sumZ = 0;
    for (var i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      var pr = this.proj([pos[0] + radius * Math.cos(a), pos[1], pos[2] + radius * Math.sin(a)]);
      if (!pr) return;
      sps.push(pr);
      sumZ += pr.z;
    }
    var targetQ = onFloor ? this.floorQueue : this.queue;
    targetQ.push({
      z: sumZ / sps.length - 1,
      draw: function (ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sps[0].x, sps[0].y);
        for (var j = 1; j < sps.length; j++) ctx.lineTo(sps[j].x, sps[j].y);
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW || 2.2;
        ctx.stroke();
        ctx.restore();
      },
    });
  };

  // Arbitrary plane 3D arc (e.g. machined elevation protractor quadrant)
  SceneRenderer.prototype.addArc3D = function (center, radius, startAng, endAng, uAxis, vAxis, color, lineW) {
    var segs = 36;
    var sps = [];
    var sumZ = 0;
    for (var i = 0; i <= segs; i++) {
      var a = startAng + ((endAng - startAng) * i) / segs;
      var ca = Math.cos(a);
      var sa = Math.sin(a);
      var pr = this.proj([
        center[0] + (uAxis[0] * ca + vAxis[0] * sa) * radius,
        center[1] + (uAxis[1] * ca + vAxis[1] * sa) * radius,
        center[2] + (uAxis[2] * ca + vAxis[2] * sa) * radius,
      ]);
      if (!pr) return;
      sps.push(pr);
      sumZ += pr.z;
    }
    this.queue.push({
      z: sumZ / sps.length - 1,
      draw: function (ctx) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sps[0].x, sps[0].y);
        for (var j = 1; j < sps.length; j++) ctx.lineTo(sps[j].x, sps[j].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW || 2.0;
        ctx.stroke();
        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addPillar = function (x, yTop, z, color) {
    if (yTop < 4) return;
    var segCount = Math.max(5, Math.min(14, Math.round(yTop / 6.5)));
    var colGlow = mixHex(color, "#ffffff", 0.25, 0.26);
    var colCore = color;
    for (var i = 0; i < segCount; i++) {
      if (i % 2 === 1) continue;
      var y1 = (i / segCount) * yTop;
      var y2 = Math.min(yTop, ((i + 0.72) / segCount) * yTop);
      var pa = this.proj([x, y1, z]);
      var pb = this.proj([x, y2, z]);
      if (pa && pb) {
        (function (p1, p2) {
          this.queue.push({
            z: (p1.z + p2.z) * 0.5 - 1,
            draw: function (ctx) {
              ctx.save();
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = colGlow;
              ctx.lineWidth = 5.0;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = colCore;
              ctx.lineWidth = 2.3;
              ctx.stroke();
              ctx.restore();
            },
          });
        }).call(this, pa, pb);
      }
      var refAlpha = clamp(Math.exp(-Math.max(0, (y1 + y2) * 0.5) / 62) * 0.26, 0, 0.26);
      if (refAlpha >= 0.015) {
        var ra = this.proj([x, -y1 * 0.78, z]);
        var rb = this.proj([x, -y2 * 0.78, z]);
        if (ra && rb) {
          (function (p1, p2, col) {
            this.floorQueue.push({
              z: (p1.z + p2.z) * 0.5,
              draw: function (ctx) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = col;
                ctx.lineWidth = 2.2;
                ctx.lineCap = "round";
                ctx.stroke();
                ctx.restore();
              },
            });
          }).call(this, ra, rb, mixHex(color, "#ffffff", 0.14, refAlpha));
        }
      }
    }
    this.addRing([x, 0.32, z], 8.8, mixHex(color, "#ffffff", 0.1, 0.65), 1.8, true);
    this.addRing([x, 0.32, z], 3.8, mixHex(color, "#ffffff", 0.45, 0.9), 1.6, true);
  };

  // Extruded 3D cylinder shaft + crisp 3D cone arrowhead
  SceneRenderer.prototype.addArrow = function (a, b, r, color) {
    var d = sub3(b, a);
    var len = Math.hypot(d[0], d[1], d[2]);
    if (len < 2) return;
    var rr = r || 2.3;
    var tipLen = Math.min(len * 0.36, rr * 3.8);
    var ratio = (len - tipLen) / len;
    var mid = [a[0] + d[0] * ratio, a[1] + d[1] * ratio, a[2] + d[2] * ratio];
    this.addCylinder(a, mid, rr, rr, color, 1, 7, false, false, false);
    this.addCone(mid, b, rr * 2.15, color, 1, 8, false, false);
  };

  // True 3D helical spring coil with end-leads and metallic half-turn shading
  SceneRenderer.prototype.addSpring3D = function (p0, p1, radius, coils, wireR, color) {
    var d = sub3(p1, p0);
    var len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1) return;
    var rad = radius || 10;
    var turns = Math.max(2, coils || 7);
    var wR = wireR || 2.1;
    var col = color || this.pal.metalLight;
    var axis = [d[0] / len, d[1] / len, d[2] / len];
    var up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm3(cross3(up, axis));
    var v = norm3(cross3(axis, u));

    var stepsPerTurn = 14;
    var totalSteps = turns * stepsPerTurn;
    var pts = [p0];
    var lead = Math.min(0.08, 2.2 / len);
    for (var i = 0; i <= totalSteps; i++) {
      var frac = i / totalSteps;
      var axial = lead + frac * (1 - 2 * lead);
      var th = frac * turns * Math.PI * 2;
      var ox = (u[0] * Math.cos(th) + v[0] * Math.sin(th)) * rad;
      var oy = (u[1] * Math.cos(th) + v[1] * Math.sin(th)) * rad;
      var oz = (u[2] * Math.cos(th) + v[2] * Math.sin(th)) * rad;
      pts.push([p0[0] + d[0] * axial + ox, p0[1] + d[1] * axial + oy, p0[2] + d[2] * axial + oz]);
    }
    pts.push(p1);

    var chunk = 7;
    for (var sIdx = 0; sIdx < pts.length - 1; sIdx += chunk) {
      var eIdx = Math.min(pts.length - 1, sIdx + chunk);
      var sps = [];
      var sumZ = 0;
      var ok = true;
      for (var k = sIdx; k <= eIdx; k++) {
        var pr = this.proj(pts[k]);
        if (!pr) {
          ok = false;
          break;
        }
        sps.push(pr);
        sumZ += pr.z;
      }
      if (!ok || sps.length < 2) continue;
      var midPt = pts[Math.floor((sIdx + eIdx) * 0.5)];
      var centerAxisPt = [
        p0[0] + d[0] * ((sIdx + eIdx) / (2 * pts.length)),
        p0[1] + d[1] * ((sIdx + eIdx) / (2 * pts.length)),
        p0[2] + d[2] * ((sIdx + eIdx) / (2 * pts.length)),
      ];
      var outDir = norm3(sub3(midPt, centerAxisPt));
      var lDot = clamp(dot3(outDir, this.lightDir), 0, 1);
      var baseCol = shadeColor(col, 0.62 + 0.54 * lDot, 1, lDot * 0.14);
      var darkCol = shadeColor(col, 0.34 + 0.25 * lDot, 1);
      var specCol = mixHex(col, "#ffffff", 0.78, 0.85);
      var pxWire = Math.max(1.6, wR * sps[0].s);

      (function (list, zVal, cDark, cBase, cSpec, lw) {
        this.queue.push({
          z: zVal,
          draw: function (ctx) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(list[0].x, list[0].y);
            for (var m = 1; m < list.length; m++) ctx.lineTo(list[m].x, list[m].y);
            ctx.strokeStyle = cDark;
            ctx.lineWidth = lw * 1.28;
            ctx.stroke();

            ctx.strokeStyle = cBase;
            ctx.lineWidth = lw * 0.92;
            ctx.stroke();

            ctx.translate(-0.5, -0.65);
            ctx.strokeStyle = cSpec;
            ctx.lineWidth = Math.max(0.85, lw * 0.32);
            ctx.stroke();
            ctx.restore();
          },
        });
      }).call(this, sps, sumZ / sps.length, darkCol, baseCol, specCol, pxWire);
    }
  };

  SceneRenderer.prototype.addHelix = function (a, b, radius, turns, color) {
    this.addSpring3D(a, b, radius, turns, 1.9, color);
  };

  // 3D Circular Analog Lab Meter (bezel + dial face + ticks + center cap + rotating needle)
  SceneRenderer.prototype.addGauge3D = function (center, radius, frac, color, normalAxis) {
    var pal = this.pal;
    var n = norm3(normalAxis || [0, 0, 1]);
    var up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, -1];
    var u = norm3(cross3(up, n));
    var v = norm3(cross3(n, u));
    var R = radius || 13;
    var f = clamp(frac !== undefined ? frac : 0.5, 0, 1);
    var col = color || pal.danger;

    // Chrome housing barrel
    this.addCylinder(
      sub3(center, mul3(n, 2.6)),
      add3(center, mul3(n, 0.5)),
      R * 1.12,
      R * 1.06,
      pal.metalLight,
      1,
      20,
      true,
      false,
      false
    );

    // Dial face disc slightly proud of bezel back
    var faceCenter = add3(center, mul3(n, 0.7));
    var N = 32;
    var facePts = [];
    for (var i = 0; i < N; i++) {
      var th = (i / N) * Math.PI * 2;
      var off = add3(mul3(u, Math.cos(th) * R * 0.92), mul3(v, Math.sin(th) * R * 0.92));
      facePts.push(add3(faceCenter, off));
    }
    this.addPoly(facePts, pal.dialFace, 1, pal.metalDark, true, false, n);
    this.addArc3D(add3(center, mul3(n, 0.88)), R * 0.78, -0.75, 0.75, v, u, mixHex(pal.glass, "#ffffff", 0.55, 0.35), 2.2);

    // 9 radial dial tick marks (-125 deg to +125 deg)
    var tickCenter = add3(center, mul3(n, 0.95));
    for (var t = 0; t <= 8; t++) {
      var ang = ((-125 + (t / 8) * 250) * Math.PI) / 180;
      var dir = add3(mul3(u, Math.sin(ang)), mul3(v, Math.cos(ang)));
      var innerR = t % 2 === 0 ? R * 0.66 : R * 0.74;
      var outerR = R * 0.87;
      var tCol = t >= 7 ? col : "#334155";
      this.addLine(add3(tickCenter, mul3(dir, innerR)), add3(tickCenter, mul3(dir, outerR)), tCol, t % 2 === 0 ? 1.8 : 1.1, false, -1);
    }

    // Dynamic needle + center hub cap
    var nAng = ((-125 + f * 250) * Math.PI) / 180;
    var nDir = add3(mul3(u, Math.sin(nAng)), mul3(v, Math.cos(nAng)));
    var nBase = add3(center, mul3(n, 1.25));
    this.addLine(
      sub3(nBase, mul3(nDir, R * 0.16)),
      add3(nBase, mul3(nDir, R * 0.78)),
      col,
      2.3,
      false,
      -1.5
    );
    this.addSphere(add3(center, mul3(n, 1.45)), Math.max(1.8, R * 0.14), pal.metalDark, 1, false);
  };

  // Zero floating rectangular text boxes blocking 3D models
  SceneRenderer.prototype.addLabel = function () {};

  SceneRenderer.prototype.end = function () {
    var ctx = this.ctx;
    if (this.hasFloor) {
      this.drawStudioFloor(ctx);
    }
    this.queue.sort(function (a, b) {
      return b.z - a.z;
    });
    for (var i = 0; i < this.queue.length; i++) {
      this.queue[i].draw(ctx);
    }
    this.canvas.setAttribute("data-cam-yaw", this.cam.yaw.toFixed(2));
    this.canvas.setAttribute("data-cam-pitch", this.cam.pitch.toFixed(2));
    this.canvas.setAttribute("data-cam-zoom", this.cam.zoom.toFixed(2));
    this.canvas.setAttribute("data-meshes-count", String(this.queue.length));
  };

  // ------------------------------------------------------------------ 15 ฉากจำลอง Studio 3D
  var SCENES = {};

  // 1. PROJECTILE — Ultra Industrial Studio Launcher & Ballistic Trajectory
  SCENES.projectile = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var angleDeg = clamp(st.angle !== undefined ? st.angle : 45, 5, 85);
    var speed = clamp(st.speed !== undefined ? st.speed : 25, 5, 50);
    var angleRad = (angleDeg * Math.PI) / 180;
    var G = 9.8;
    var vx = st.vx !== undefined ? st.vx : speed * Math.cos(angleRad);
    var vy = st.vy !== undefined ? st.vy : speed * Math.sin(angleRad);
    var T = st.T > 0 ? st.T : Math.max(0.4, (2 * vy) / G);
    var R = st.R !== undefined && st.R > 0 ? st.R : vx * T;
    var H = st.H !== undefined && st.H > 0 ? st.H : (vy * vy) / (2 * G);

    var targetDist = st.targetDist > 0 ? st.targetDist : st.targetXt > 0 ? st.targetXt : st.targetX > 0 ? st.targetX : 0;
    var baseScale = 1.72;
    var fit = Math.min(1, 162 / Math.max(162, R * baseScale, (targetDist || 0) * baseScale), 68 / Math.max(68, (H + 6) * baseScale));
    var scale = baseScale * fit;
    var ox = -80;

    var ca = Math.cos(angleRad);
    var sa = Math.sin(angleRad);
    var pivotY = 14;
    var barrelLen = 32;
    var muzzle = [ox + barrelLen * ca, pivotY + barrelLen * sa, 0];

    // Wide brushed-titanium stepped base plinth with chamfered octagonal corners
    r.addOctaPlinth(ox - 2, 2.8, 0, 44, 5.6, 30, 4.5, pal.titanium, 1, true);
    r.addChamferBox(ox - 3, 8.2, 0, 34, 5.4, 21, pal.metalDark, 1, null, false, false);

    // Angled machined trunnion side gussets + bronze axle pins
    for (var side = -1; side <= 1; side += 2) {
      var gz = side * 9.2;
      r.addPoly(
        [
          [ox - 12, 10.8, gz],
          [ox + 9, 10.8, gz],
          [ox + 4, pivotY + 3, gz],
          [ox - 5, pivotY + 3, gz],
        ],
        pal.graphite,
        1,
        null,
        true,
        false
      );
    }
    r.addCylinder([ox, pivotY, -11.4], [ox, pivotY, 11.4], 3.4, 3.4, pal.bronze, 1, 14, true, false, false);
    r.addCylinder([ox, pivotY, -12.1], [ox, pivotY, 12.1], 1.8, 1.8, pal.metalLight, 1, 12, true, false, false);

    // Sleek dark-anodized tilted barrel shroud + rear breech + recessed glowing viewport slot
    var bMidX = ox + (barrelLen * 0.44) * ca;
    var bMidY = pivotY + (barrelLen * 0.44) * sa;
    r.addRotatedChamferBox(bMidX, bMidY, 0, 32, 14.2, 15.2, angleRad, pal.graphite, 1, null, false);
    r.addRotatedChamferBox(ox - 4.5 * ca, pivotY - 4.5 * sa, 0, 8, 13.4, 14.4, angleRad, pal.metalDark, 1, null, false);
    for (var rSide = -1; rSide <= 1; rSide += 2) {
      var rz = rSide * 8.5;
      var rOffX = 3.8 * sa;
      var rOffY = -3.8 * ca;
      r.addCylinder(
        [ox + 2 * ca + rOffX, pivotY + 2 * sa + rOffY, rz],
        [ox + 12 * ca + rOffX, pivotY + 12 * sa + rOffY, rz],
        1.8,
        1.8,
        pal.metalLight,
        1,
        14,
        true,
        false,
        false
      );
      r.addCylinder(
        [ox + 12 * ca + rOffX, pivotY + 12 * sa + rOffY, rz],
        [ox + 18 * ca + rOffX, pivotY + 18 * sa + rOffY, rz],
        1.1,
        1.1,
        pal.brass,
        1,
        12,
        true,
        false,
        false
      );
    }

    // Recessed glowing sight viewport slot on upper barrel shroud
    var slotDist = barrelLen * 0.62;
    var slotX = ox + slotDist * ca - 5.6 * sa;
    var slotY = pivotY + slotDist * sa + 5.6 * ca;
    r.addRotatedBox(slotX, slotY, 0, 8.5, 2.2, 5.6, angleRad, pal.metalDark, 1, null, false);
    r.addRotatedBox(slotX + 0.3 * sa, slotY + 0.3 * ca, 0, 6.2, 1.4, 3.8, angleRad, pal.glass, 0.9, null, false);

    // Chrome muzzle collar & dark bore lip
    r.addCylinder(
      [ox + (barrelLen - 4.5) * ca, pivotY + (barrelLen - 4.5) * sa, 0],
      [ox + (barrelLen + 0.8) * ca, pivotY + (barrelLen + 0.8) * sa, 0],
      8.0,
      7.6,
      pal.metalLight,
      1,
      20,
      true,
      false,
      false
    );
    r.addCylinder(
      [ox + (barrelLen - 0.2) * ca, pivotY + (barrelLen - 0.2) * sa, 0],
      [ox + (barrelLen + 1.2) * ca, pivotY + (barrelLen + 1.2) * sa, 0],
      5.8,
      5.8,
      pal.metalDark,
      1,
      16,
      true,
      false,
      false
    );

    // Machined elevation protractor quadrant arc on front cheek
    var pCenter = [ox, pivotY, 10.6];
    r.addArc3D(pCenter, 17.5, 0, Math.PI * 0.5, [1, 0, 0], [0, 1, 0], pal.metalLight, 1.9);
    for (var degTick = 15; degTick <= 75; degTick += 15) {
      var tr = (degTick * Math.PI) / 180;
      r.addLine(
        [ox + 15.2 * Math.cos(tr), pivotY + 15.2 * Math.sin(tr), 10.6],
        [ox + 18.4 * Math.cos(tr), pivotY + 18.4 * Math.sin(tr), 10.6],
        pal.metalLight,
        1.2,
        false,
        -1
      );
    }
    r.addLine(pCenter, [ox + 16.5 * ca, pivotY + 16.5 * sa, 10.7], pal.cyan, 2.0, false, -1.2);

    // Game target zone & marker flag
    if (targetDist > 0) {
      var tx = muzzle[0] + targetDist * scale;
      var tolPx = clamp((st.tolerance || st.targetTol || 4) * scale, 9, 24);
      r.addChamferBox(tx, 1.8, 0, tolPx * 1.9, 3.6, 24, pal.gold, 0.92, null, true, true);
      r.addRing([tx, 4.2, 0], tolPx, pal.danger, 2.4, false);
      r.addRing([tx, 0.35, 0], tolPx * 1.28, pal.orange, 1.8, true);
      r.addCylinder([tx, 3.6, 12], [tx, 46, 12], 1.6, 1.3, pal.metalDark, 1, 10, true, true, false);
      r.addPoly([[tx, 45.5, 12], [tx + 18, 38.5, 12], [tx, 31.5, 12]], pal.danger, 1, null, true, false);
    }

    // Smooth kink-free 64-sample parabolic trajectory from muzzle down to resting ball (y=ballR)
    var isHiddenGame = !!st.isGame && !st.revealed;
    var maxFrac = isHiddenGame ? 0.24 : st.animFrac !== undefined ? clamp(st.animFrac, 0.05, 1) : 1;
    var ballR = 7.6;
    var landY = ballR;
    var hRise = H * scale;
    var dropH = muzzle[1] - landY;
    var pts = [];
    var segs = 48;
    for (var i = 0; i <= segs; i++) {
      var f = (i / segs) * maxFrac;
      var px = muzzle[0] + R * scale * f;
      var py = landY + dropH * (1 - f) + 4 * hRise * f * (1 - f);
      pts.push([px, Math.max(ballR, py), 0]);
    }
    r.addTube3D(pts, pal.cobalt, isHiddenGame ? 2.6 : 3.7, isHiddenGame, true);

    // Single clean projectile sphere (idle at muzzle, flying along trajectory, resting at bullseye when landed)
    var bf = 0;
    var bx = muzzle[0];
    var by = muzzle[1];
    if (!isHiddenGame && (st.projX !== undefined || st.projY !== undefined)) {
      bx = muzzle[0] + (st.projX || 0) * scale;
      by = Math.max(ballR, muzzle[1] + (st.projY || 0) * scale);
      bf = st.ballT !== undefined && T > 0 ? clamp(st.ballT / T, 0, 1) : R > 0 ? clamp((st.projX || 0) / R, 0, 1) : 0;
    } else {
      var ballT = st.ballT !== undefined ? st.ballT : 0;
      bf = !isHiddenGame && T > 0 ? clamp(ballT / T, 0, 1) : 0;
      bx = muzzle[0] + R * scale * bf;
      by = Math.max(ballR, landY + dropH * (1 - bf) + 4 * hRise * bf * (1 - bf));
    }

    if (!isHiddenGame) {
      // Crisp floor bullseye target rings at landing point
      var landX = muzzle[0] + R * scale;
      r.addRing([landX, 0.32, 0], 13.0, mixHex(pal.cobalt, "#ffffff", 0.2, 0.45), 1.6, true);
      r.addRing([landX, 0.32, 0], 6.5, mixHex(pal.cobalt, "#ffffff", 0.08, 0.7), 1.5, true);
      r.addRing([landX, 0.32, 0], 1.6, pal.cobalt, 2.2, true);
    }

    r.addSphere([bx, by, 0], ballR, pal.cobalt, 1, true);

    if (!isHiddenGame && bf < 0.99) {
      var vyInst = vy - G * bf * T;
      var vMag = Math.hypot(vx, vyInst);
      if (vMag > 1.0) {
        var vLen = clamp(ballR * 0.75 + vMag * 0.65, 11, 29);
        var ux = vx / vMag;
        var uy = vyInst / vMag;
        if (bf > 0.04 && bf < 0.96) {
          r.addArc3D(
            [bx - ux * 5.2, by - uy * 5.2, 0],
            ballR * 0.88,
            0,
            Math.PI * 2,
            [-uy, ux, 0],
            [0, 0, 1],
            mixHex(pal.cyan, "#ffffff", 0.35, 0.58),
            1.7
          );
        }
        if (uy < 0 && by + uy * vLen < 1.8) {
          vLen = Math.max(0, (by - 1.8) / -uy);
        }
        if (vLen >= ballR + 2.5) {
          r.addArrow([bx, by, 0], [bx + ux * vLen, by + uy * vLen, 0], 1.8, pal.emerald);
        }
      }
    }

    if (pulse && pulse.active) {
      var pAge = (performance.now() - pulse.started) / 1000;
      if (pAge < 0.85 && R > 0) {
        r.addRing([muzzle[0] + R * scale, 1.0, 0], 11 + pAge * 36, pal.emerald, 2.5, false);
      }
    }
  };

  // 2. NEWTON-FORCE — Precision Dynamics Track, Pulley, Brass Drive Weight & 3D Vectors
  SCENES["newton-force"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var F = st.F !== undefined ? st.F : st.force !== undefined ? st.force : 40;
    var m = st.m !== undefined ? st.m : st.mass !== undefined ? st.mass : 4;
    var mu = st.mu !== undefined ? st.mu : 0.2;
    var G = 9.8;
    var N = m * G;
    var maxFric = mu * N;
    var acc = st.acc !== undefined ? st.acc : st.accel !== undefined ? st.accel : F > maxFric ? (F - maxFric) / m : 0;

    // Adjustable leveling feet + precision anodized-aluminum optical/dynamics track
    var footXs = [-74, 70];
    var footZs = [-15, 15];
    for (var fi = 0; fi < footXs.length; fi++) {
      for (var fj = 0; fj < footZs.length; fj++) {
        r.addCylinder([footXs[fi], 0, footZs[fj]], [footXs[fi], 4.8, footZs[fj]], 4.0, 2.2, pal.metalDark, 1, 6, false, true, true);
      }
    }
    r.addChamferBox(-5, 7.2, 0, 174, 5.2, 38, pal.metalDark, 1, null, true, false);
    r.addBox(-5, 10.4, 13, 170, 1.8, 3.2, pal.metalLight, 1, null, false, false);
    r.addBox(-5, 10.4, -13, 170, 1.8, 3.2, pal.metalLight, 1, null, false, false);

    // End-stop left bumper & metric scale tick marks along front rail
    r.addChamferBox(-89, 13.5, 0, 7, 10, 38, pal.graphite, 1, null, false, false);
    r.addBox(-84.5, 14, 0, 2.5, 6, 22, pal.danger, 1, null, false, false);
    for (var tx = -72; tx <= 72; tx += 24) {
      var isMajor = tx % 48 === 0;
      r.addLine([tx, 10.1, 14.8], [tx, 10.1, isMajor ? 18.6 : 17.2], pal.metalLight, isMajor ? 1.8 : 1.1, false, -0.5);
    }

    // Cart motion state (reactive to st.animX, pulse, or continuous motion when acc > 0)
    var animFrac = 0;
    if (st.animX !== undefined && st.animX > 0.001) {
      animFrac = clamp(st.animX, 0, 1);
    } else if (acc > 0 && !st.isGame) {
      animFrac = (time * (0.18 + acc * 0.06)) % 1;
    }
    if (pulse && pulse.active) {
      var pT = Math.min(1, (performance.now() - pulse.started) / 900);
      animFrac = acc > 0 ? pT * pT : Math.sin(pT * Math.PI * 3) * 0.025;
    }

    var cx = -62 + animFrac * 112;
    var wheelY = 14.0;
    var chassisY = 18.2;

    // Friction pad beneath cart reflecting st.mu (ice cyan -> amber -> high-friction crimson)
    var padCol = mu <= 0.05 ? pal.cyan : mu < 0.35 ? pal.gold : pal.danger;
    r.addBox(cx, 11.2, 0, 32, 2.2, 22, padCol, 0.95, null, false, false);

    // 4 machined wheels + 2 bronze axles + chamfered dynamics cart chassis
    var wxOff = [-14, 14];
    var wzOff = [-13.5, 13.5];
    for (var wi = 0; wi < wxOff.length; wi++) {
      r.addCylinder([cx + wxOff[wi], wheelY, -15.5], [cx + wxOff[wi], wheelY, 15.5], 1.6, 1.6, pal.bronze, 1, 6, false, false, false);
      for (var wj = 0; wj < wzOff.length; wj++) {
        r.addCylinder(
          [cx + wxOff[wi], wheelY, wzOff[wj] - 1.5],
          [cx + wxOff[wi], wheelY, wzOff[wj] + 1.5],
          4.2,
          4.2,
          pal.metalDark,
          1,
          8,
          true,
          false,
          false
        );
        r.addSphere([cx + wxOff[wi], wheelY, wzOff[wj] + (wzOff[wj] > 0 ? 1.8 : -1.8)], 1.7, pal.metalLight, 1, false);
      }
    }
    r.addChamferBox(cx, chassisY, 0, 42, 5.2, 28, pal.graphite, 1, null, false, false);

    // Stacked chamfered calibration mass blocks scaling smoothly with st.m
    var blockCol = st.isGame && !st.revealed ? pal.cobalt : pal.gold;
    var plates = clamp(Math.ceil(m / 6), 1, 3);
    var baseW = clamp(22 + m * 0.85, 23, 36);
    var plateH = clamp(6.5 + (m / plates) * 1.15, 7, 13);
    var curY = chassisY + 2.6;
    for (var pi = 0; pi < plates; pi++) {
      var pw = baseW * (1 - pi * 0.14);
      var pCol = pi % 2 === 0 ? blockCol : mixHex(blockCol, pal.bronze, 0.35);
      r.addChamferBox(cx, curY + plateH * 0.5, 0, pw, plateH, pw * 0.88, pCol, 1, null, false, false);
      curY += plateH;
    }
    r.addCylinder([cx, curY, 0], [cx, curY + 3.2, 0], 4.2, 3.2, pal.metalLight, 1, 10, true, false, false);

    // End-pulley wheel + tension cord + hanging brass drive weight reflecting st.F
    var px = 85;
    var py = 18.5;
    r.addBox(px - 2, 12.5, 4.5, 8, 9, 2.2, pal.graphite, 1, null, false, false);
    r.addBox(px - 2, 12.5, -4.5, 8, 9, 2.2, pal.graphite, 1, null, false, false);
    r.addCylinder([px, py, -2.5], [px, py, -1.5], 6.6, 6.6, pal.brass, 1, 22, true, false, false);
    r.addCylinder([px, py, -1.5], [px, py, 1.5], 5.6, 5.6, pal.metalDark, 1, 20, false, false, false);
    r.addCylinder([px, py, 1.5], [px, py, 2.5], 6.6, 6.6, pal.brass, 1, 22, true, false, false);
    r.addCylinder([px, py, -3.2], [px, py, 3.2], 2.0, 2.0, pal.metalLight, 1, 12, true, false, false);

    var cordY = chassisY + 1.2;
    r.addLine([cx + 21, cordY, 0], [px, py + 6.0, 0], pal.ivory, 1.6, false, -1);
    r.addArc3D([px, py, 0], 6.0, 0, Math.PI * 0.5, [1, 0, 0], [0, 1, 0], pal.ivory, 1.6);
    var dropBottom = clamp(15 - animFrac * 8, 5, 16);
    var wtX = px + 6.0;
    if (F > 0) {
      r.addLine([px + 6.0, py, 0], [wtX, dropBottom + 9, 0], pal.ivory, 1.6, false, -1);
      var wtH = clamp(5 + F * 0.11, 6, 15);
      var wtR = clamp(4.2 + F * 0.04, 4.5, 7.8);
      r.addCylinder([wtX, Math.max(2, dropBottom - wtH * 0.3), 0], [wtX, Math.max(2, dropBottom - wtH * 0.3) + wtH, 0], wtR, wtR * 0.94, pal.brass, 1, 12, true, true, true);
    }

    // 4 Crisp 3D Extruded Vector Arrows: F (+X), f (-X), N (+Y), mg (-Y)
    if (F > 0) {
      var fLen = clamp(16 + F * 0.56, 18, 64);
      r.addArrow([cx + 22, chassisY + 4, 0], [cx + 22 + fLen, chassisY + 4, 0], 2.5, pal.emerald);
    }
    var frLen = clamp(Math.min(F, maxFric) * 0.56, 9, 48);
    if (mu > 0 && frLen > 4) {
      r.addArrow([cx - 22, 13.5, 0], [cx - 22 - frLen, 13.5, 0], 2.2, pal.danger);
    }
    var normLen = clamp(18 + m * 1.1, 20, 34);
    r.addArrow([cx, curY + 4, 0], [cx, curY + 4 + normLen, 0], 2.2, pal.cyan);
    r.addLine([cx, chassisY, 14], [cx, chassisY, 21], pal.orange, 1.2, true, 0);
    r.addArrow([cx, chassisY + 2, 21], [cx, Math.max(2, chassisY + 2 - normLen * 0.72), 21], 2.1, pal.orange);
  };

  // 3. LINEAR-MOTION — Dual-Lane Timing Track, Photogate Bridges, Wedge Sled & Strobe Trail
  SCENES["linear-motion"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    // Dual-lane polished laboratory timing track on 4 leveling feet
    var footXs = [-80, 80];
    var footZs = [-16, 16];
    for (var fi = 0; fi < footXs.length; fi++) {
      for (var fj = 0; fj < footZs.length; fj++) {
        r.addCylinder([footXs[fi], 0, footZs[fj]], [footXs[fi], 4.2, footZs[fj]], 3.6, 2.4, pal.metalDark, 1, 10, true, true, true);
      }
    }
    r.addChamferBox(0, 6.8, 0, 188, 5.4, 42, pal.metal, 1, null, true, false);
    // Dual polished chrome rail lanes
    var railZs = [-11.5, -4.5, 4.5, 11.5];
    for (var ri = 0; ri < railZs.length; ri++) {
      r.addBox(0, 10.2, railZs[ri], 184, 1.6, 2.2, pal.metalLight, 1, null, false, false);
    }
    r.addChamferBox(-92, 12.5, 0, 5, 8, 40, pal.graphite, 1, null, false, false);
    r.addChamferBox(92, 12.5, 0, 5, 8, 40, pal.graphite, 1, null, false, false);

    // Kinematic state & sled displacement
    var u = st.u !== undefined ? st.u : 4;
    var a = st.a !== undefined ? st.a : 2;
    var T = Math.max(0.5, st.t || 4);
    var phaseT = (time * 0.82) % T;
    if (pulse && pulse.active) {
      var elap = (performance.now() - pulse.started) / 1000;
      phaseT = clamp(elap * (T / 1.4), 0, T);
    }
    var sTotal = u * T + 0.5 * a * T * T;
    var sMax = Math.max(8, Math.abs(sTotal), Math.abs(u * T * 0.5));
    var sCur = u * phaseT + 0.5 * a * phaseT * phaseT;
    var cx = clamp(-74 + (sCur / sMax) * 144, -76, 76);

    // 3 Arched overhead optical photogate bridges with glowing cyan/emerald LED status lenses
    var gateXs = [-56, 0, 56];
    for (var gi = 0; gi < gateXs.length; gi++) {
      var gx = gateXs[gi];
      var triggered = cx >= gx - 6;
      var ledCol = triggered ? pal.emerald : pal.cyan;
      r.addCylinder([gx, 9.5, -19], [gx, 34, -19], 2.2, 2.0, pal.metalDark, 1, 10, false, false, false);
      r.addCylinder([gx, 9.5, 19], [gx, 34, 19], 2.2, 2.0, pal.metalDark, 1, 10, false, false, false);
      r.addChamferBox(gx, 35.5, 0, 8, 5, 42, pal.graphite, 1, null, false, false);
      r.addBox(gx, 32, 0, 5, 2.5, 8, pal.metalDark, 1, null, false, false);
      r.addLine([gx, 10.5, 0], [gx, 31, 0], mixHex(ledCol, "#ffffff", 0.25, 0.55), 1.4, true, 0);
      r.addSphere([gx + 4.2, 35.8, 12], 2.6, ledCol, 1, false);
    }

    // Glowing trail & stroboscopic position trail spheres along the run
    r.addTube3D([[-74, 13.0, 0], [cx, 13.0, 0]], pal.cyan, 2.4, false, false);
    var strobeSteps = 6;
    for (var k = 0; k < strobeSteps; k++) {
      var tk = (phaseT * k) / strobeSteps;
      var sk = u * tk + 0.5 * a * tk * tk;
      var sxk = clamp(-74 + (sk / sMax) * 144, -76, 76);
      if (Math.abs(sxk - cx) > 14) {
        r.addSphere([sxk, 13.0, 0], 2.8, pal.cyan, 0.72, false);
        r.addRing([sxk, 11.4, 0], 3.4, pal.cyan, 1.2, false);
      }
    }

    // Sleek wedge-shaped aerodynamic test sled with 4 machined wheels & vertical tail fin
    var sledDir = u + a * phaseT >= 0 ? 1 : -1;
    var wy = 13.8;
    r.addSphere([cx - 11, wy, 12.2], 4.2, pal.metalDark, 1, false);
    r.addSphere([cx + 11, wy, 12.2], 4.2, pal.metalDark, 1, false);
    r.addSphere([cx - 11, wy, -12.2], 4.2, pal.metalDark, 1, false);
    r.addSphere([cx + 11, wy, -12.2], 4.2, pal.metalDark, 1, false);
    r.addChamferBox(cx - sledDir * 4, 19.5, 0, 26, 7.5, 20, pal.cobalt, 1, null, false, false);
    // Sloped aerodynamic nose wedge
    var nBack = cx + sledDir * 9;
    var nTip = cx + sledDir * 22;
    r.addPoly([[nBack, 16, -9.5], [nTip, 16, -8], [nTip, 16, 8], [nBack, 16, 9.5]], pal.cobalt, 1, null, true, false);
    r.addPoly([[nBack, 23.2, -8.5], [nTip, 17.5, -7], [nTip, 17.5, 7], [nBack, 23.2, 8.5]], pal.cobalt, 1, null, true, false);
    r.addPoly([[nBack, 16, 9.5], [nTip, 16, 8], [nTip, 17.5, 7], [nBack, 23.2, 8.5]], pal.cobalt, 1, null, true, false);
    r.addPoly([[nBack, 16, -9.5], [nTip, 16, -8], [nTip, 17.5, -7], [nBack, 23.2, -8.5]], pal.cobalt, 1, null, true, false);
    // Translucent canopy + rear vertical aerodynamic stabilizer fin
    r.addChamferBox(cx - sledDir * 2, 25.2, 0, 14, 4.8, 13, pal.glass, 0.85, null, false, false);
    r.addPoly(
      [
        [cx - sledDir * 15, 23, 0],
        [cx - sledDir * 6, 23, 0],
        [cx - sledDir * 14, 33, 0],
        [cx - sledDir * 17, 33, 0],
      ],
      pal.titanium,
      1,
      null,
      true,
      false
    );

    // 3D Velocity (v) & Acceleration (a) vectors
    var curV = u + a * phaseT;
    if (Math.abs(curV) > 0.25) {
      var vSign = curV >= 0 ? 1 : -1;
      var vLen = clamp(Math.abs(curV) * 2.1, 14, 48);
      r.addArrow([cx + vSign * 22, 21.5, 9], [cx + vSign * (22 + vLen), 21.5, 9], 2.2, pal.emerald);
    }
    if (Math.abs(a) > 0.15) {
      var aSign = a >= 0 ? 1 : -1;
      var aLen = clamp(Math.abs(a) * 4.5, 14, 40);
      r.addArrow([cx, 35, 0], [cx + aSign * aLen, 35, 0], 2.0, pal.gold);
    }
  };

  // 4. MOMENTUM-COLLISION — Stainless Linear Air Track, Blower Manifold & Compressing Bumper Spring
  SCENES["momentum-collision"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    // Heavy cast-iron pedestals + machined stainless-steel linear air track
    r.addChamferBox(-58, 4.5, 0, 22, 9, 34, pal.metalDark, 1, null, true, true);
    r.addChamferBox(58, 4.5, 0, 22, 9, 34, pal.metalDark, 1, null, true, true);
    r.addChamferBox(0, 12.5, 0, 184, 7.2, 34, pal.titanium, 1, null, true, false);
    r.addBox(0, 16.8, 0, 180, 1.8, 20, pal.metalLight, 1, null, false, false);

    // Blower end-manifold on left + intake grill + brass air supply tube
    r.addCylinder([-96, 13, 0], [-86, 13, 0], 9.5, 9.5, pal.graphite, 1, 18, true, true, true);
    r.addCylinder([-97.5, 13, 0], [-95.5, 13, 0], 7.4, 7.4, pal.metalDark, 1, 14, true, false, false);
    r.addCylinder([-86, 13, 0], [-82, 13, 0], 4.2, 4.2, pal.bronze, 1, 12, true, false, false);

    // Air-track pinhole deck perforation pattern
    for (var px = -68; px <= 68; px += 14) {
      r.addLine([px, 18.0, -5], [px + 1.6, 18.0, -5], pal.metalDark, 1.6, false, -0.5);
      r.addLine([px, 18.0, 5], [px + 1.6, 18.0, 5], pal.metalDark, 1.6, false, -0.5);
    }

    // Cushioned helical spring end-stops at both ends
    r.addChamferBox(-83, 21, 0, 4, 10, 22, pal.graphite, 1, null, false, false);
    r.addSpring3D([-81, 22, 0], [-74, 22, 0], 3.2, 4, 1.1, pal.gold);
    r.addChamferBox(89, 21, 0, 4, 10, 22, pal.graphite, 1, null, false, false);
    r.addSpring3D([87, 22, 0], [80, 22, 0], 3.2, 4, 1.1, pal.gold);

    var m1 = st.m1 || 4;
    var u1 = st.u1 !== undefined ? st.u1 : 6;
    var m2 = st.m2 || 2;
    var u2 = st.u2 !== undefined ? st.u2 : 0;
    var elastic = st.elastic !== false;
    var rad1 = clamp(10 + m1 * 1.1, 11, 19);
    var rad2 = clamp(10 + m2 * 1.1, 11, 19);

    var v1 = st.v1 !== undefined ? st.v1 : elastic ? ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2) : (m1 * u1 + m2 * u2) / (m1 + m2);
    var v2 = st.v2 !== undefined ? st.v2 : elastic ? ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2) : v1;

    var cyc = (time * 0.44) % 1;
    if (pulse && pulse.active) {
      cyc = clamp((performance.now() - pulse.started) / 1800, 0, 0.99);
    }

    var springRest = 14;
    var x1, x2, curV1, curV2, springComp = 0;
    if (cyc < 0.44) {
      var fPre = cyc / 0.44;
      var c1 = -rad1 - springRest * 0.5;
      var c2 = rad2 + springRest * 0.5;
      x1 = -62 + (c1 + 62) * fPre;
      x2 = 52 + (c2 - 52) * fPre;
      curV1 = u1;
      curV2 = u2;
    } else if (cyc <= 0.56) {
      // Peak helical bumper compression phase
      var fHit = (cyc - 0.44) / 0.12;
      springComp = Math.sin(fHit * Math.PI);
      var gap = springRest * (1 - 0.68 * springComp);
      x1 = -rad1 - gap * 0.5;
      x2 = rad2 + gap * 0.5;
      curV1 = u1 * (1 - fHit) + v1 * fHit;
      curV2 = u2 * (1 - fHit) + v2 * fHit;
      // Radial impulse rings at collision
      r.addRing([0, 0.35, 0], 12 + fHit * 44, mixHex(pal.gold, "#ffffff", 0.2, 0.72 * (1 - fHit * 0.5)), 2.2, true);
      r.addRing([0, 26, 0], 10 + fHit * 36, pal.gold, 2.4, false);
    } else {
      var fPost = (cyc - 0.56) / 0.44;
      var startGap = elastic ? springRest : 4;
      x1 = -rad1 - startGap * 0.5 + v1 * 7.2 * fPost;
      x2 = rad2 + startGap * 0.5 + v2 * 7.2 * fPost;
      curV1 = v1;
      curV2 = v2;
      if (cyc < 0.70) {
        var ringAge = (cyc - 0.56) / 0.14;
        r.addRing([0, 0.35, 0], 30 + ringAge * 34, mixHex(pal.orange, "#ffffff", 0.1, 0.5 * (1 - ringAge)), 1.8, true);
      }
    }

    var sx1 = clamp(x1, -68 + rad1, 68 - rad2 - 12);
    var sx2 = clamp(x2, sx1 + rad1 + rad2 + 4, 72 - rad2);

    // Anodized air-glider saddles + machined brass end-caps + color-coded mass bands + PBR spheres
    var w1 = rad1 * 1.75;
    var w2 = rad2 * 1.75;
    r.addChamferBox(sx1, 19.8, 0, w1, 4.2, 24, pal.graphite, 1, null, false, false);
    r.addBox(sx1 - w1 * 0.5, 19.8, 0, 1.8, 4.0, 23.6, pal.brass, 1, null, false, false);
    r.addBox(sx1 + w1 * 0.5, 19.8, 0, 1.8, 4.0, 23.6, pal.brass, 1, null, false, false);
    r.addBox(sx1, 20.0, 12.1, w1 * 0.76, 1.6, 0.8, pal.cobalt, 1, null, false, false);

    r.addChamferBox(sx2, 19.8, 0, w2, 4.2, 24, pal.graphite, 1, null, false, false);
    r.addBox(sx2 - w2 * 0.5, 19.8, 0, 1.8, 4.0, 23.6, pal.brass, 1, null, false, false);
    r.addBox(sx2 + w2 * 0.5, 19.8, 0, 1.8, 4.0, 23.6, pal.brass, 1, null, false, false);
    r.addBox(sx2, 20.0, 12.1, w2 * 0.76, 1.6, 0.8, pal.gold, 1, null, false, false);
    var sp1Y = 22 + rad1;
    var sp2Y = 22 + rad2;
    r.addSphere([sx1, sp1Y, 0], rad1, pal.cobalt, 1, true);
    r.addSphere([sx2, sp2Y, 0], rad2, pal.ivory, 1, true);

    // Central 3D helical bumper spring attached between colliding gliders
    var springL = sx1 + rad1 * 0.88;
    var springR = sx2 - rad2 * 0.88;
    if (springR - springL < 22) {
      r.addSpring3D(
        [springL, 21.5, 0],
        [springR, 21.5, 0],
        4.4,
        5,
        1.5,
        springComp > 0.25 ? pal.gold : pal.metalLight
      );
    } else {
      r.addSpring3D([sx1 + rad1 * 0.88, 21.5, 0], [sx1 + rad1 * 0.88 + 9, 21.5, 0], 4.0, 4, 1.4, pal.metalLight);
      r.addSpring3D([sx2 - rad2 * 0.88, 21.5, 0], [sx2 - rad2 * 0.88 - 9, 21.5, 0], 4.0, 4, 1.4, pal.metalLight);
    }

    // Opposing 3D momentum vector arrows (p = m*v)
    var p1 = m1 * curV1;
    var p2 = m2 * curV2;
    if (Math.abs(p1) > 0.4) {
      var d1 = p1 > 0 ? 1 : -1;
      r.addArrow([sx1, sp1Y + rad1 + 7, 0], [sx1 + d1 * clamp(Math.abs(p1) * 1.8, 12, 42), sp1Y + rad1 + 7, 0], 2.1, pal.emerald);
    }
    if (Math.abs(p2) > 0.4) {
      var d2 = p2 > 0 ? 1 : -1;
      r.addArrow([sx2, sp2Y + rad2 + 7, 0], [sx2 + d2 * clamp(Math.abs(p2) * 1.8, 12, 42), sp2Y + rad2 + 7, 0], 2.1, pal.orange);
    }
  };

  // 5. CIRCULAR-SHM — Cast-Iron Rotor Pedestal, 3D Tachometer, & Overhead Helical SHM Gantry
  SCENES["circular-shm"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var m = st.m !== undefined ? st.m : st.mass !== undefined ? st.mass : 2;
    var rVal = st.r !== undefined ? st.r : st.radius !== undefined ? st.radius : 2;
    var k = st.k !== undefined ? st.k : 20;
    var omega = st.omega !== undefined ? st.omega : Math.sqrt(k / Math.max(0.2, m));
    var ang = time * omega;

    var showShm = st.shmMode !== false && st.shmMode !== "circular";
    var showCirc = st.shmMode !== "shm" && st.shmMode !== "shm-only";

    var amp = clamp(rVal * 10.5, 18, 40);
    var discCx = showShm && showCirc ? -46 : 0;
    var shmX = showShm && showCirc ? 54 : 0;

    var bx = discCx;
    var bz = 0;
    var bobY = 30;
    var massY = 42 + amp * 0.46 * Math.sin(ang);

    if (showCirc) {
      // Heavy cast-iron & brushed-steel circular laboratory pedestal
      r.addCylinder([discCx, 0, 0], [discCx, 5.5, 0], amp + 14, amp + 12, pal.metalDark, 1, 18, true, true, true);
      r.addCylinder([discCx, 5.5, 0], [discCx, 9.0, 0], amp + 10, amp + 9, pal.titanium, 1, 18, true, false, false);

      // 3D Analog Tachometer / Frequency Gauge mounted on front face of pedestal
      r.addGauge3D([discCx, 13.5, amp + 10.5], 10.5, clamp(omega / 11, 0.08, 0.96), pal.danger, [0, 0.25, 0.97]);

      // Central chrome vertical rotor shaft & machined bronze bearing collar
      r.addCylinder([discCx, 9, 0], [discCx, 42, 0], 4.2, 4.0, pal.metalLight, 1, 12, true, false, false);
      r.addCylinder([discCx, 26.5, 0], [discCx, 33.5, 0], 6.8, 6.8, pal.bronze, 1, 12, true, false, false);

      // Glowing 64-sample circular orbit path tube
      var orbitPts = [];
      for (var oi = 0; oi <= 36; oi++) {
        var oa = (oi / 36) * Math.PI * 2;
        orbitPts.push([discCx + amp * Math.cos(oa), bobY, amp * Math.sin(oa)]);
      }
      r.addTube3D(orbitPts, pal.cobalt, 2.6, false, true);

      // Balanced aluminum torque arm + counterweight + spinning cobalt/brass bob
      var ca = Math.cos(ang);
      var sa = Math.sin(ang);
      bx = discCx + amp * ca;
      bz = amp * sa;
      r.addCylinder([discCx - amp * 0.34 * ca, bobY, -amp * 0.34 * sa], [bx, bobY, bz], 2.0, 1.8, pal.metalLight, 1, 8, false, false, false);
      r.addCylinder([discCx - amp * 0.36 * ca, bobY - 2, -amp * 0.36 * sa], [discCx - amp * 0.36 * ca, bobY + 2, -amp * 0.36 * sa], 4.2, 4.2, pal.brass, 1, 10, true, false, false);

      var bobR = clamp(6.2 + m * 0.45, 6.5, 10.5);
      r.addSphere([bx, bobY, bz], bobR, pal.cobalt, 1, true);

      // Centripetal Fc (radial inward) & Tangential v 3D arrows
      r.addArrow([bx, bobY, bz], [discCx + (bx - discCx) * 0.28, bobY, bz * 0.28], 1.9, pal.emerald);
      var tanLen = clamp(omega * 4.8, 12, 26);
      r.addArrow([bx, bobY, bz], [bx - sa * tanLen, bobY, bz + ca * tanLen], 1.8, pal.orange);
    }

    if (showShm) {
      // Heavy cast-iron base plinth + rigid overhead steel gantry frame
      r.addChamferBox(shmX, 2.8, 0, 52, 5.6, 32, pal.metalDark, 1, null, true, true);
      r.addCylinder([shmX - 20, 5.5, -10], [shmX - 20, 82, -10], 2.6, 2.4, pal.titanium, 1, 8, false, false, false);
      r.addCylinder([shmX + 20, 5.5, -10], [shmX + 20, 82, -10], 2.6, 2.4, pal.titanium, 1, 8, false, false, false);
      r.addChamferBox(shmX, 82, -3, 52, 5.5, 22, pal.graphite, 1, null, false, false);
      r.addCylinder([shmX, 78, 0], [shmX, 79.5, 0], 4.8, 4.8, pal.bronze, 1, 10, true, false, false);

      // True 3D helical coil spring + cylindrical slotted brass mass hanger
      var hangerTop = massY + 11;
      r.addSpring3D([shmX, 78, 0], [shmX, hangerTop, 0], 8.5, 7, 1.8, pal.metalLight);
      var massRad = clamp(8.5 + m * 0.55, 9, 13.5);
      r.addCylinder([shmX, massY - 8, 0], [shmX, massY - 5, 0], massRad * 1.15, massRad * 1.15, pal.graphite, 1, 14, true, true, true);
      r.addCylinder([shmX, massY - 5, 0], [shmX, massY + 8, 0], massRad, massRad, pal.brass, 1, 16, true, false, false);
      r.addCylinder([shmX, massY + 8, 0], [shmX, hangerTop, 0], 2.0, 2.0, pal.metalLight, 1, 8, false, false, false);

      // Floor phase projection ring + displacement amplitude scale bar + pointer rod
      var phaseR = 11 + 4 * Math.abs(Math.cos(ang));
      r.addRing([shmX, 0.35, 0], phaseR, mixHex(pal.cobalt, pal.gold, 0.5 + 0.5 * Math.sin(ang), 0.72), 1.8, true);
      var barX = shmX + 20;
      r.addLine([barX, 20, 0], [barX, 64, 0], pal.metalLight, 1.8, false, 0);
      r.addLine([barX - 3, 42, 0], [barX + 3, 42, 0], pal.emerald, 2.0, false, -0.5);
      r.addLine([barX - 2.5, 42 + amp * 0.46, 0], [barX + 2.5, 42 + amp * 0.46, 0], pal.orange, 1.8, false, -0.5);
      r.addLine([barX - 2.5, 42 - amp * 0.46, 0], [barX + 2.5, 42 - amp * 0.46, 0], pal.orange, 1.8, false, -0.5);
      r.addCylinder([shmX + massRad, massY, 0], [barX - 2, massY, 0], 1.3, 0.9, pal.brass, 1, 10, true, false, false);
      r.addSphere([barX - 1.8, massY, 0], 1.6, pal.emerald, 1, false);
    }

    if (showCirc && showShm) {
      // Synchronized phase projection beam linking circular bob and SHM hanger
      r.addLine([bx, bobY, bz], [shmX - 13, massY, 0], pal.glass, 1.6, true, -1);
      r.addSphere([shmX - 13, massY, 0], 2.8, pal.cyan, 1, false);
    }
  };

  // 6. COULOMB — Dielectric Test Bench, Van de Graaff Columns, Force Gauge & Dipole Flux
  SCENES.coulomb = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var q1 = st.q1 !== undefined ? st.q1 : 4;
    var q2 = st.q2 !== undefined ? st.q2 : -4;
    var dist = clamp(st.r !== undefined ? st.r : 0.3, 0.1, 4.0);
    var opp = q1 * q2 < 0;

    var r1 = clamp(9.2 + Math.abs(q1) * 0.7, 9.8, 16.0);
    var r2 = clamp(9.2 + Math.abs(q2) * 0.7, 9.8, 16.0);
    var rawSpan = dist <= 1.0 ? 48 + ((dist - 0.1) / 0.9) * 82 : 130 + (dist - 1.0) * 8;
    var span = clamp(Math.max(rawSpan, r1 + r2 + 14), 48, 142);
    var x1 = -span * 0.5;
    var x2 = span * 0.5;

    // Insulated phenolic & anodized dielectric laboratory test bench with rubber isolation feet
    var footXs = [-76, 76];
    var footZs = [-19, 19];
    for (var fi = 0; fi < footXs.length; fi++) {
      for (var fj = 0; fj < footZs.length; fj++) {
        r.addCylinder([footXs[fi], 0, footZs[fj]], [footXs[fi], 3.4, footZs[fj]], 3.4, 2.2, pal.metalDark, 1, 5, false, true, true);
      }
    }
    r.addChamferBox(0, 6.0, 0, 178, 5.0, 52, pal.metalDark, 1, null, true, false);
    r.addBox(0, 9.3, 0, 168, 1.6, 44, pal.graphite, 1, null, false, false);

    // Translucent glass dielectric safety barrier skirt (back + left/right wings)
    r.addPoly([[-84, 10.1, -22], [84, 10.1, -22], [84, 21.5, -22], [-84, 21.5, -22]], pal.glass, 0.22, pal.metalLight, true, false);
    r.addPoly([[-84, 10.1, -22], [-84, 10.1, 14], [-84, 21.5, 14], [-84, 21.5, -22]], pal.glass, 0.18, pal.metalLight, true, false);
    r.addPoly([[84, 10.1, -22], [84, 10.1, 14], [84, 21.5, 14], [84, 21.5, -22]], pal.glass, 0.18, pal.metalLight, true, false);

    // Precision metric separation scale rail & dynamic r ruler bar along front deck
    r.addLine([-70, 10.6, 15], [70, 10.6, 15], pal.metalLight, 1.5, false, -0.5);
    for (var tx = -70; tx <= 70; tx += 14) {
      var maj = tx % 28 === 0;
      r.addLine([tx, 10.6, 15], [tx, 10.6, maj ? 18.8 : 17.2], pal.metalLight, maj ? 1.5 : 1.0, false, -0.5);
    }
    r.addLine([x1, 11.4, 12], [x2, 11.4, 12], pal.cyan, 2.2, false, -0.8);
    r.addLine([x1, 10.5, 9.5], [x1, 12.6, 14.5], pal.cyan, 1.6, false, -0.8);
    r.addLine([x2, 10.5, 9.5], [x2, 12.6, 14.5], pal.cyan, 1.6, false, -0.8);

    // Twin scaled Van de Graaff electrostatic generator columns on chamfered pedestals
    var cols = [
      { x: x1, q: q1, rad: r1 },
      { x: x2, q: q2, rad: r2 },
    ];
    for (var ci = 0; ci < 2; ci++) {
      var c = cols[ci];
      var qCol = c.q >= 0 ? (Math.abs(c.q) >= 7 ? pal.danger : mixHex(pal.danger, pal.orange, 0.28)) : pal.cobalt;
      r.addChamferBox(c.x, 12.8, 0, 26, 5.2, 24, pal.titanium, 1, null, false, false);
      // Fluted polycarbonate insulating pillar + rib rings
      r.addCylinder([c.x, 15.4, 0], [c.x, 39, 0], 5.2, 4.8, pal.glass, 0.42, 10, true, false, false);
      r.addRing([c.x, 21, 0], 6.4, pal.metalLight, 1.5, false);
      r.addRing([c.x, 27.5, 0], 6.2, pal.metalLight, 1.5, false);
      r.addRing([c.x, 34, 0], 6.0, pal.metalLight, 1.5, false);
      // Spun metallic corona shield collar + high-gloss PBR charge sphere
      r.addCylinder([c.x, 38.5, 0], [c.x, 43.0, 0], 8.8, 7.2, pal.metalLight, 1, 10, true, false, false);
      var sy = 43.0 + c.rad * 0.72;
      r.addSphere([c.x, sy, 0], c.rad, qCol, 1, true);
      r.addRing([c.x, 10.4, 0], c.rad * 0.92, mixHex(qCol, "#ffffff", 0.2, 0.55), 1.5, false);
    }

    var y1 = 43.0 + r1 * 0.72;
    var y2 = 43.0 + r2 * 0.72;

    // 3D dipole electric field flux tubes + animated charge-carrier tracer beads
    for (var ring = 0; ring < 6; ring++) {
      var phi = (ring / 6) * Math.PI * 2 + time * 0.28;
      var cPhi = Math.cos(phi);
      var sPhi = Math.sin(phi);
      var tRaw = (time * 0.55 + ring / 6) % 1;
      if (opp) {
        var arc = [];
        var lobeAmp = 18 + (ring % 2) * 12;
        for (var k = 0; k <= 16; k++) {
          var f = k / 16;
          var xx = x1 + (x2 - x1) * f;
          var yy = y1 + (y2 - y1) * f;
          var bulge = Math.sin(f * Math.PI) * lobeAmp;
          arc.push([xx, yy + bulge * cPhi, bulge * sPhi]);
        }
        r.addGlowCurve(arc, pal.cyan, 1.5, true, false);
        var tf = q1 >= 0 ? tRaw : 1 - tRaw;
        var txB = x1 + (x2 - x1) * tf;
        var tyB = y1 + (y2 - y1) * tf;
        var tBulge = Math.sin(tf * Math.PI) * lobeAmp;
        r.addSphere([txB, tyB + tBulge * cPhi, tBulge * sPhi], 2.3, pal.cyan, 1, false);
      } else {
        var isLeft = ring % 2 === 0;
        var sx = isLeft ? x1 : x2;
        var syStart = isLeft ? y1 : y2;
        var dirOut = isLeft ? -1 : 1;
        var flare = [];
        var fPhi = (Math.floor(ring / 2) / 3) * Math.PI * 2 + time * 0.28;
        for (var kf = 0; kf <= 12; kf++) {
          var ff = kf / 12;
          var fx = sx + dirOut * ff * 28;
          var radF = 9 + Math.pow(ff, 0.75) * 26;
          flare.push([fx, syStart + radF * Math.cos(fPhi), radF * Math.sin(fPhi)]);
        }
        r.addGlowCurve(flare, pal.gold, 1.5, true, false);
        var tff = q1 >= 0 ? tRaw : 1 - tRaw;
        var tfx = sx + dirOut * tff * 28;
        var tRadF = 9 + Math.pow(tff, 0.75) * 26;
        r.addSphere([tfx, syStart + tRadF * Math.cos(fPhi), tRadF * Math.sin(fPhi)], 2.3, pal.gold, 1, false);
      }
    }

    // Mounted 3D analog electrostatic force gauge on front pedestal console deflecting with |F|
    var forceN = (0.009 * Math.abs(q1) * Math.abs(q2)) / Math.max(0.01, dist * dist);
    var gaugeFrac = clamp(Math.log10(1 + 100 * forceN) / Math.log10(9001), 0.04, 0.98);
    r.addChamferBox(0, 12.8, 20.5, 24, 11.2, 9.5, pal.graphite, 1, null, false, false);
    r.addGauge3D([0, 15.8, 23.8], 8.0, gaugeFrac, opp ? pal.emerald : pal.danger, [0, 0.28, 0.96]);

    // Vivid 3D extruded attraction/repulsion force vector arrows clear of spheres
    var fLen = clamp(15 + 9.5 * Math.log10(1 + 100 * forceN), 15, 36);
    var arrowY = Math.max(y1 + r1, y2 + r2) + 6;
    if (opp) {
      var maxOpp = Math.max(11, span * 0.44 - 3);
      var effLen = Math.min(fLen, maxOpp);
      r.addArrow([x1, arrowY, 0], [x1 + effLen, arrowY, 0], 2.2, pal.emerald);
      r.addArrow([x2, arrowY, 0], [x2 - effLen, arrowY, 0], 2.2, pal.emerald);
    } else {
      r.addArrow([x1 - 3, arrowY, 0], [x1 - 3 - fLen, arrowY, 0], 2.2, pal.danger);
      r.addArrow([x2 + 3, arrowY, 0], [x2 + 3 + fLen, arrowY, 0], 2.2, pal.danger);
    }
  };

  // 7. REFLECTION — Optical Breadboard, Gimbal Mirror, Protractor & Pivoting HeNe Laser
  SCENES.reflection = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    // Precision anodized optical breadboard table with rubber isolation feet & mounting holes
    var footXs = [-72, 72];
    var footZs = [-20, 20];
    for (var fi = 0; fi < footXs.length; fi++) {
      for (var fj = 0; fj < footZs.length; fj++) {
        r.addCylinder([footXs[fi], 0, footZs[fj]], [footXs[fi], 3.4, footZs[fj]], 3.6, 2.2, pal.metalDark, 1, 5, false, true, true);
      }
    }
    r.addChamferBox(0, 6.2, 0, 170, 5.4, 54, pal.metalDark, 1, null, true, false);
    r.addBox(0, 9.7, 0, 160, 1.5, 46, pal.graphite, 1, null, false, false);
    for (var hx = -56; hx <= 56; hx += 28) {
      r.addLine([hx - 1.5, 10.6, 16], [hx + 1.5, 10.6, 16], pal.metalLight, 1.4, false, -0.5);
      r.addLine([hx - 1.5, 10.6, -16], [hx + 1.5, 10.6, -16], pal.metalLight, 1.4, false, -0.5);
    }

    // Gimbal-mounted silvered bevelled glass mirror on sturdy pedestal post with lock knobs
    var vy = 18.5;
    r.addCylinder([0, 10.5, 0], [0, 15.5, 0], 7.6, 6.2, pal.titanium, 1, 10, true, false, false);
    r.addBox(-34, 15.6, 0, 4.0, 8.6, 11, pal.metalLight, 1, null, false, false);
    r.addBox(34, 15.6, 0, 4.0, 8.6, 11, pal.metalLight, 1, null, false, false);
    r.addCylinder([-39.5, 17.0, 0], [-35.5, 17.0, 0], 3.0, 3.0, pal.brass, 1, 8, true, false, false);
    r.addCylinder([35.5, 17.0, 0], [39.5, 17.0, 0], 3.0, 3.0, pal.brass, 1, 8, true, false, false);
    r.addChamferBox(0, 16.8, 0, 64, 3.0, 30, pal.metalLight, 1, null, false, false);
    r.addBox(0, 18.3, 0, 58, 1.1, 25, pal.cyan, 0.78, pal.glass, false, false);
    r.addPoly([[-20, 19.0, -8], [-6, 19.0, -8], [16, 19.0, 8], [2, 19.0, 8]], pal.ivory, 0.24, null, true, false);

    // 3D semicircular protractor / angle scale centered behind the reflection vertex
    var pZ = -13;
    var pR = 38;
    for (var s = 0; s < 6; s++) {
      var aA = (s / 6) * Math.PI;
      var aB = ((s + 1) / 6) * Math.PI;
      r.addPoly(
        [
          [0, vy, pZ],
          [pR * Math.cos(aA), vy + pR * Math.sin(aA), pZ],
          [pR * Math.cos(aB), vy + pR * Math.sin(aB), pZ],
        ],
        pal.glass,
        0.18,
        null,
        true,
        false
      );
    }
    r.addArc3D([0, vy, pZ], pR, 0, Math.PI, [1, 0, 0], [0, 1, 0], pal.metalLight, 2.0);
    r.addArc3D([0, vy, pZ], pR - 6, 0, Math.PI, [1, 0, 0], [0, 1, 0], pal.titanium, 1.3);
    for (var tk = -75; tk <= 75; tk += 15) {
      var tRad = (tk * Math.PI) / 180;
      var inR = tk % 30 === 0 ? pR - 6 : pR - 3.5;
      r.addLine(
        [-inR * Math.sin(tRad), vy + inR * Math.cos(tRad), pZ + 0.3],
        [-pR * Math.sin(tRad), vy + pR * Math.cos(tRad), pZ + 0.3],
        tk === 0 ? pal.cyan : pal.metalLight,
        tk % 30 === 0 ? 1.7 : 1.0,
        false,
        -0.5
      );
    }

    // Dashed vertical normal pillar rising cleanly through vertex
    r.addPillar(0, 74, 0, pal.cyan);

    var deg = clamp(st.angle !== undefined ? st.angle : 40, 0, 82);
    var rad = (deg * Math.PI) / 180;
    var sAng = Math.sin(rad);
    var cAng = Math.cos(rad);
    var L = 56;
    var muz = [-(L - 12) * sAng, vy + (L - 12) * cAng, 0];
    var rear = [-L * sAng, vy + L * cAng, 0];
    var dst = [L * sAng, vy + L * cAng, 0];

    // Pivoting optical arm & finned brushed-metal HeNe laser housing
    r.addCylinder([0, vy, pZ], [muz[0] * 0.94, vy + (muz[1] - vy) * 0.94, pZ], 1.8, 1.6, pal.metal, 1, 6, false, false, false);
    r.addCylinder([muz[0] * 0.94, vy + (muz[1] - vy) * 0.94, pZ], [muz[0] * 0.94, vy + (muz[1] - vy) * 0.94, 0], 1.6, 1.6, pal.titanium, 1, 6, false, false, false);
    r.addCylinder(rear, muz, 5.0, 4.6, pal.graphite, 1, 8, true, false, false);
    for (var fin = 0; fin < 2; fin++) {
      var f1 = 0.25 + fin * 0.34;
      var f2 = f1 + 0.14;
      r.addCylinder(
        [rear[0] + (muz[0] - rear[0]) * f1, rear[1] + (muz[1] - rear[1]) * f1, 0],
        [rear[0] + (muz[0] - rear[0]) * f2, rear[1] + (muz[1] - rear[1]) * f2, 0],
        5.9,
        5.9,
        pal.metalLight,
        1,
        8,
        false,
        false,
        false
      );
    }
    var tip = [muz[0] + sAng * 4.5, muz[1] - cAng * 4.5, 0];
    r.addCone(muz, tip, 4.0, pal.metalLight, 1, 8, false, false);
    r.addSphere(rear, 2.8, pal.emerald, 1, false);

    // Vivid 3-pass glowing incident & reflected laser tubes + angle arcs
    r.addGlowCurve([tip, [0, vy, 0]], pal.danger, 3.0, false, false);
    r.addGlowCurve([[0, vy, 0], dst], pal.gold, 3.0, false, false);
    if (deg >= 2) {
      r.addArc3D([0, vy, 0], 22, Math.PI * 0.5, Math.PI * 0.5 + rad, [1, 0, 0], [0, 1, 0], pal.danger, 1.9);
      r.addArc3D([0, vy, 0], 22, Math.PI * 0.5 - rad, Math.PI * 0.5, [1, 0, 0], [0, 1, 0], pal.gold, 1.9);
    }

    // Specular hit spark at mirror contact vertex & traveling photon pulse
    r.addSphere([0, vy + 0.4, 0], 3.8, pal.ivory, 1, false);
    r.addRing([0, vy + 0.5, 0], 7.6, pal.danger, 1.8, false);
    r.addRing([0, vy + 0.5, 0], 12.0, pal.gold, 1.3, false);

    for (var pi = 0; pi < 2; pi++) {
      var p = (time * 0.78 + pi * 0.5) % 1;
      var px = p < 0.5 ? tip[0] * (1 - p * 2) : dst[0] * ((p - 0.5) * 2);
      var py = p < 0.5 ? tip[1] + (vy - tip[1]) * (p * 2) : vy + (dst[1] - vy) * ((p - 0.5) * 2);
      r.addSphere([px, py, 0], 3.8, p < 0.5 ? pal.danger : pal.gold, 1, false);
    }

    // Front-right 3D angle readout gauge on breadboard apron
    r.addGauge3D([56, 15.2, 18.5], 7.6, clamp(deg / 85, 0.02, 0.98), pal.danger, [0, 0.3, 0.95]);
  };

  // 8. SNELL-LAW — Borosilicate Refraction Tank, Submerged Prism, TIR & Caustic Spot
  SCENES["snell-law"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var deg1 = clamp(st.angle !== undefined ? st.angle : 35, 0, 82);
    var n1 = clamp(st.n1 !== undefined ? st.n1 : 1.0, 1.0, 2.2);
    var n2 = clamp(st.n2 !== undefined ? st.n2 : 1.33, 1.0, 2.2);
    var hy = 44;

    // Chamfered base tray, rubber feet, anodized corner pillars & top frame rim
    var footXs = [-72, 72];
    var footZs = [-20, 20];
    for (var fi = 0; fi < footXs.length; fi++) {
      for (var fj = 0; fj < footZs.length; fj++) {
        r.addCylinder([footXs[fi], 0, footZs[fj]], [footXs[fi], 3.2, footZs[fj]], 3.4, 2.2, pal.metalDark, 1, 5, false, true, true);
      }
    }
    r.addChamferBox(0, 5.4, 0, 166, 4.6, 56, pal.metalDark, 1, null, true, false);
    var colXs = [-78, 78];
    var colZs = [-24, 24];
    for (var ci = 0; ci < 2; ci++) {
      for (var cj = 0; cj < 2; cj++) {
        r.addCylinder([colXs[ci], 7.6, colZs[cj]], [colXs[ci], 60, colZs[cj]], 2.0, 2.0, pal.graphite, 1, 6, false, false, false);
      }
    }
    r.addBox(0, 60.5, -24, 158, 2.0, 2.8, pal.graphite, 1, null, false, false);
    r.addBox(0, 60.5, 24, 158, 2.0, 2.8, pal.graphite, 1, null, false, false);
    r.addBox(-78, 60.5, 0, 2.8, 2.0, 50, pal.graphite, 1, null, false, false);
    r.addBox(78, 60.5, 0, 2.8, 2.0, 50, pal.graphite, 1, null, false, false);

    // Translucent teal-blue water/lower medium reacting to n2 + submerged bevelled crown-glass prism
    var waterCol = n2 > 1.38 ? mixHex(pal.cyan, pal.cobalt, clamp((n2 - 1.38) / 0.62, 0, 0.55)) : pal.glass;
    var waterAlpha = clamp(0.20 + (n2 - 1.0) * 0.16, 0.18, 0.38);
    r.addBox(0, 25.8, 0, 152, 36.4, 46, waterCol, waterAlpha, pal.cobalt, false, false);
    var prismCol = mixHex(pal.cyan, pal.ivory, 0.22);
    r.addOctaPlinth(0, 12.6, 0, 112, 9.8, 32, 6.5, prismCol, clamp(0.26 + (n2 - 1.0) * 0.16, 0.22, 0.46), false);

    // Optional upper optical medium enclosure tint when n1 > 1.04
    if (n1 > 1.04) {
      r.addBox(0, 52, 0, 152, 16, 46, pal.glass, clamp((n1 - 1.0) * 0.16, 0.05, 0.22), pal.glass, false, false);
    }

    // Surface meniscus rings & semicircular goniometer protractor arch behind vertex
    r.addRing([0, hy + 0.3, 0], 14.5, pal.glass, 1.7, false);
    r.addRing([0, hy + 0.3, 0], 6.5, pal.ivory, 1.3, false);
    var pZ = -14;
    r.addArc3D([0, hy, pZ], 32, 0, Math.PI, [1, 0, 0], [0, 1, 0], pal.metalLight, 1.7);
    r.addArc3D([0, hy, pZ], 26, Math.PI, Math.PI * 2, [1, 0, 0], [0, 1, 0], pal.cyan, 1.4);
    for (var tk = -60; tk <= 60; tk += 30) {
      var tr = (tk * Math.PI) / 180;
      r.addLine([-27.5 * Math.sin(tr), hy + 27.5 * Math.cos(tr), pZ], [-32 * Math.sin(tr), hy + 32 * Math.cos(tr), pZ], pal.metalLight, 1.3, false, -0.5);
    }

    // Dashed vertical normal pillar
    r.addPillar(0, 76, 0, pal.metalLight);

    // Overhead pivoting laser emitter housing tracking st.angle
    var a1 = (deg1 * Math.PI) / 180;
    var s1 = Math.sin(a1);
    var c1 = Math.cos(a1);
    var muz = [-25 * s1, hy + 25 * c1, 0];
    var rear = [-35 * s1, hy + 35 * c1, 0];
    var tip = [-21.5 * s1, hy + 21.5 * c1, 0];
    r.addCylinder([0, hy, pZ], [muz[0], muz[1], pZ], 1.6, 1.5, pal.metal, 1, 6, false, false, false);
    r.addCylinder([muz[0], muz[1], pZ], muz, 1.5, 1.5, pal.titanium, 1, 6, false, false, false);
    r.addCylinder(rear, muz, 4.6, 4.2, pal.graphite, 1, 8, true, false, false);
    r.addCylinder(
      [rear[0] + (muz[0] - rear[0]) * 0.35, rear[1] + (muz[1] - rear[1]) * 0.35, 0],
      [rear[0] + (muz[0] - rear[0]) * 0.65, rear[1] + (muz[1] - rear[1]) * 0.65, 0],
      5.5,
      5.5,
      pal.metalLight,
      1,
      8,
      false,
      false,
      false
    );
    r.addCone(muz, tip, 3.8, pal.metalLight, 1, 8, false, false);

    // Incident beam & interface spark
    r.addGlowCurve([tip, [0, hy, 0]], pal.danger, 2.8, false, false);
    r.addSphere([0, hy, 0], 3.5, pal.ivory, 1, false);
    if (deg1 >= 2) {
      r.addArc3D([0, hy, 0], 16, Math.PI * 0.5, Math.PI * 0.5 + a1, [1, 0, 0], [0, 1, 0], pal.danger, 1.9);
    }

    var sinB = (n1 * s1) / Math.max(0.05, n2);
    if (sinB >= 0.9999) {
      // Total Internal Reflection (TIR)
      var tirEnd = [36 * s1, hy + 36 * c1, 0];
      r.addGlowCurve([[0, hy, 0], tirEnd], pal.gold, 3.0, false, false);
      if (deg1 >= 2) {
        r.addArc3D([0, hy, 0], 16, Math.PI * 0.5 - a1, Math.PI * 0.5, [1, 0, 0], [0, 1, 0], pal.gold, 1.9);
      }
      r.addRing([0, hy + 0.4, 0], 10.5, pal.gold, 1.9, false);
      r.addSphere([0, hy - 3.5, 0], 2.2, pal.cyan, 0.45, false);
      for (var piT = 0; piT < 2; piT++) {
        var pT = (time * 0.78 + piT * 0.5) % 1;
        var pt = pT < 0.5 ? pT * 2 : (pT - 0.5) * 2;
        var pxT = pT < 0.5 ? tip[0] * (1 - pt) : tirEnd[0] * pt;
        var pyT = pT < 0.5 ? tip[1] + (hy - tip[1]) * pt : hy + (tirEnd[1] - hy) * pt;
        r.addSphere([pxT, pyT, 0], 3.6, pT < 0.5 ? pal.danger : pal.gold, 1, false);
      }
    } else {
      var b = Math.asin(sinB);
      // Faint partial surface reflection in upper medium
      if (deg1 >= 3) {
        r.addGlowCurve([[0, hy, 0], [31 * s1, hy + 31 * c1, 0]], mixHex(pal.danger, pal.ivory, 0.35, 0.42), 1.4, false, false);
      }
      if (b >= 0.03) {
        r.addArc3D([0, hy, 0], 16, -Math.PI * 0.5, -Math.PI * 0.5 + b, [1, 0, 0], [0, 1, 0], pal.cyan, 1.9);
      }
      // Refracted beam terminating cleanly at tank floor or side wall + caustic glow
      var sinBabs = Math.max(1e-5, Math.abs(Math.sin(b)));
      var cosBabs = Math.max(1e-5, Math.cos(b));
      var tHit = Math.min((hy - 8.2) / cosBabs, 72 / sinBabs);
      var hitPt = [tHit * Math.sin(b), hy - tHit * Math.cos(b), 0];
      r.addGlowCurve([[0, hy, 0], hitPt], pal.cyan, 2.8, false, false);
      r.addSphere(hitPt, 3.5, pal.cyan, 1, false);
      r.addRing([hitPt[0], 8.0, 0], 7.0, pal.cyan, 1.7, false);
      r.addRing([hitPt[0], 0.35, 0], 9.5, pal.glass, 1.3, true);

      for (var piR = 0; piR < 2; piR++) {
        var pR = (time * 0.78 + piR * 0.5) % 1;
        var pr = pR < 0.5 ? pR * 2 : (pR - 0.5) * 2;
        var pxR = pR < 0.5 ? tip[0] * (1 - pr) : hitPt[0] * pr;
        var pyR = pR < 0.5 ? tip[1] + (hy - tip[1]) * pr : hy + (hitPt[1] - hy) * pr;
        r.addSphere([pxR, pyR, 0], 3.6, pR < 0.5 ? pal.danger : pal.cyan, 1, false);
      }
    }
  };

  // 9. OHM-LAW — Lab Bench, PCB Deck, DC Supply w/ Dual Gauges, Resistor & Helical Load
  SCENES["ohm-law"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var V = clamp(st.V !== undefined ? st.V : 12, 0.5, 30);
    var R = clamp(st.R !== undefined ? st.R : 6, 0.5, 30);
    var I = st.I !== undefined ? st.I : V / R;
    var P = V * I;
    var isHidden = !!st.isGame && !st.revealed;
    var pulsing = !!(pulse && pulse.active && performance.now() - pulse.started < 1200);

    // 4 rubber dome feet + chamfered phenolic laboratory circuit bench
    var footXs = [-80, 80];
    var footZs = [-36, 36];
    for (var fi = 0; fi < 2; fi++) {
      for (var fj = 0; fj < 2; fj++) {
        r.addSphere([footXs[fi], 2.2, footZs[fj]], 3.2, pal.metalDark, 1, true);
      }
    }
    r.addChamferBox(0, 6.8, 0, 184, 5.2, 88, pal.metalDark, 1, null, true, true);

    // Dual brass mounting rails + elevated translucent PCB deck
    r.addBox(0, 11.2, -32, 162, 3.6, 4.0, pal.brass, 1, null, false, false);
    r.addBox(0, 11.2, 32, 162, 3.6, 4.0, pal.brass, 1, null, false, false);
    r.addChamferBox(0, 14.3, 0, 170, 2.6, 78, pal.graphite, 1, null, false, false);
    r.addPoly(
      [[-81, 15.8, -36], [81, 15.8, -36], [81, 15.8, 36], [-81, 15.8, 36]],
      pal.emerald,
      0.26,
      pal.cyan,
      true,
      false,
      [0, 1, 0]
    );
    r.addLine([-34, 15.9, -20], [72, 15.9, -20], mixHex(pal.gold, pal.emerald, 0.35, 0.55), 1.3, false, -0.5);
    r.addLine([-34, 15.9, 20], [72, 15.9, 20], mixHex(pal.gold, pal.emerald, 0.35, 0.55), 1.3, false, -0.5);
    r.addLine([70, 15.9, -20], [70, 15.9, 20], mixHex(pal.gold, pal.emerald, 0.35, 0.55), 1.3, false, -0.5);

    // Left benchtop DC Power Supply chassis w/ ventilation slots, binding posts, slider & dual gauges
    r.addChamferBox(-58, 30.5, 0, 44, 30, 56, pal.graphite, 1, null, false, false);
    r.addPoly(
      [[-78, 18, 28.4], [-38, 18, 28.4], [-38, 43, 28.4], [-78, 43, 28.4]],
      pal.metalDark,
      1,
      pal.metalLight,
      true,
      false,
      [0, 0, 1]
    );
    // Side ventilation louvers on left cheek
    for (var vi = 0; vi < 4; vi++) {
      var vy = 22 + vi * 4.5;
      r.addLine([-80.4, vy, -14], [-80.4, vy, 14], pal.metalDark, 2.0, false, -0.4);
    }
    // Red (+) and Black (-) brass binding posts on right side feeding the circuit busbars
    r.addCylinder([-36, 20.5, -28], [-30, 20.5, -28], 3.2, 2.6, pal.danger, 1, 5, false, false, false);
    r.addSphere([-29.5, 20.5, -28], 2.5, pal.brass, 1, false);
    r.addCylinder([-36, 20.5, 28], [-30, 20.5, 28], 3.2, 2.6, pal.metalDark, 1, 5, false, false, false);
    r.addSphere([-29.5, 20.5, 28], 2.5, pal.brass, 1, false);

    // Live voltage slider bar on front lower bezel
    var vFrac = clamp((V - 1) / 23, 0, 1);
    var knobX = -73 + vFrac * 30;
    r.addLine([-73, 21, 29.0], [-43, 21, 29.0], pal.metal, 2.6, false, -0.8);
    r.addLine([-73, 21, 29.2], [knobX, 21, 29.2], pal.cobalt, 2.8, false, -1.0);
    r.addSphere([knobX, 21, 29.6], 2.6, pal.gold, 1, false);

    // Dual 3D analog gauges on DC Power Supply front panel: Voltage V & Current I
    var iFrac = isHidden && !pulsing ? 0.02 : clamp(I / 12, 0.02, 0.98);
    r.addGauge3D([-68.5, 34, 29.5], 7.8, clamp(V / 24, 0.02, 0.98), pal.gold, [0, 0.14, 0.99]);
    r.addGauge3D([-47.5, 34, 29.5], 7.8, iFrac, isHidden && !pulsing ? pal.orange : pal.cyan, [0, 0.14, 0.99]);

    // Thick solid copper circuit busbars routing around the PCB deck
    var wireY = 20.5;
    r.addCylinder([-30, wireY, -28], [76, wireY, -28], 2.4, 2.4, pal.bronze, 1, 5, false, false, false);
    r.addCylinder([76, wireY, -28], [76, wireY, 28], 2.4, 2.4, pal.bronze, 1, 5, false, false, false);
    r.addCylinder([76, wireY, 28], [-30, wireY, 28], 2.4, 2.4, pal.bronze, 1, 5, false, false, false);
    r.addSphere([-30, wireY, -28], 3.0, pal.brass, 1, false);
    r.addSphere([-30, wireY, 28], 3.0, pal.brass, 1, false);
    r.addSphere([76, wireY, -28], 3.1, pal.brass, 1, false);
    r.addSphere([76, wireY, 28], 3.1, pal.brass, 1, false);

    // 3D ceramic axial resistor on rear busbar (z = -28) w/ end caps, color bands & thermal glow
    var powerNorm = isHidden && !pulsing ? 0 : clamp(P / 120, 0, 1);
    var resCol = powerNorm > 0.55
      ? mixHex(pal.orange, pal.danger, (powerNorm - 0.55) / 0.45)
      : mixHex(pal.ivory, pal.orange, powerNorm / 0.55);
    r.addCylinder([-4, wireY + 1.5, -28], [4, wireY + 1.5, -28], 8.2, 8.2, pal.metalLight, 1, 24, true, false, false);
    r.addCylinder([40, wireY + 1.5, -28], [48, wireY + 1.5, -28], 8.2, 8.2, pal.metalLight, 1, 24, true, false, false);
    r.addCylinder([4, wireY + 1.5, -28], [40, wireY + 1.5, -28], 7.4, 7.4, resCol, 1, 24, false, false, false);
    var bandCols = [pal.cobalt, R >= 10 ? pal.danger : pal.emerald, pal.gold];
    var bandXs = [11, 21, 31];
    for (var bi = 0; bi < 3; bi++) {
      r.addCylinder([bandXs[bi], wireY + 1.5, -28], [bandXs[bi] + 3.0, wireY + 1.5, -28], 7.9, 7.9, bandCols[bi], 1, 24, false, false, false);
    }
    if (powerNorm > 0.08) {
      var glowCol = powerNorm > 0.5 ? pal.danger : pal.orange;
      r.addCylinder([2, wireY + 1.5, -28], [42, wireY + 1.5, -28], 10.6, 10.6, glowCol, clamp(0.14 + powerNorm * 0.34, 0.14, 0.48), 24, false, false, false);
    }

    // 3D helical load resistor coil on front busbar (z = +28) w/ mounting insulators
    r.addCylinder([2, 15.8, 28], [2, wireY, 28], 2.8, 2.4, pal.ivory, 1, 4, false, false, false);
    r.addCylinder([44, 15.8, 28], [44, wireY, 28], 2.8, 2.4, pal.ivory, 1, 4, false, false, false);
    r.addSpring3D([4, wireY, 28], [42, wireY, 28], 6.4, 4, 1.9, powerNorm > 0.6 ? pal.orange : pal.brass);

    // Illuminated current direction arrows (clockwise around circuit)
    var arrowCol = isHidden && !pulsing ? pal.orange : pal.cyan;
    r.addArrow([-20, wireY + 9, -28], [-6, wireY + 9, -28], 1.9, arrowCol);
    r.addArrow([52, wireY + 9, 28], [38, wireY + 9, 28], 1.9, arrowCol);

    // 16 glowing PBR electron spheres circulating at speed proportional to I
    if (!isHidden || pulsing) {
      var speed = clamp(I * 0.28, 0.16, 2.4);
      var count = 16;
      var eCol = pulsing ? pal.emerald : pal.cyan;
      for (var e = 0; e < count; e++) {
        var frac = (e / count + time * speed * 0.22) % 1;
        var pos;
        if (frac < 0.395) {
          pos = [-30 + 106 * (frac / 0.395), wireY, -28];
        } else if (frac < 0.605) {
          pos = [76, wireY, -28 + 56 * ((frac - 0.395) / 0.21)];
        } else {
          pos = [76 - 106 * ((frac - 0.605) / 0.395), wireY, 28];
        }
        r.addSphere(pos, 3.6, eCol, 1, false);
      }
      if (pulsing) {
        var pAge = clamp((performance.now() - pulse.started) / 1200, 0, 1);
        r.addRing([-47.5, 34, 31], 8 + pAge * 10, pal.emerald, 2.0, false);
      }
    }
  };

  // 10. HARMONIC-WAVE — Dual Acoustic Bridge Towers, Cam Motor, 34 Coupled Rods & Ribbon
  SCENES["harmonic-wave"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var freq = clamp(st.f || 2.5, 0.5, 12);
    var lam = clamp(st.lambda || 4.0, 0.5, 12);
    var amp = clamp((st.amp || 1.5) * 9.5, 7, 23);
    var isHidden = !!st.isGame && !st.revealed;
    var revealPulse = pulse && pulse.active && performance.now() - pulse.started < 1200;
    var drawAll = !isHidden || revealPulse;

    var eqY = 43;
    var leftX = -80;
    var rightX = 80;

    // Dual brushed-steel & charcoal optical/acoustic bridge towers with side gussets
    var towerXs = [leftX, rightX];
    for (var ti = 0; ti < towerXs.length; ti++) {
      var tx = towerXs[ti];
      r.addChamferBox(tx, 3.0, 0, 22, 6.0, 26, pal.metalDark, 1, null, true, false);
      r.addCylinder([tx, 6.0, -8.5], [tx, 73, -8.5], 2.2, 1.9, pal.titanium, 1, 6, false, false, false);
      r.addCylinder([tx, 6.0, 8.5], [tx, 73, 8.5], 2.2, 1.9, pal.titanium, 1, 6, false, false, false);
      r.addPoly([[tx - 8, 6.0, -8.5], [tx + 8, 6.0, -8.5], [tx + 3.5, 26, -8.5], [tx - 3.5, 26, -8.5]], pal.graphite, 1, null, true, false);
      r.addPoly([[tx - 8, 6.0, 8.5], [tx + 8, 6.0, 8.5], [tx + 3.5, 26, 8.5], [tx - 3.5, 26, 8.5]], pal.graphite, 1, null, true, false);
      r.addChamferBox(tx, 74, 0, 15, 4.0, 22, pal.graphite, 1, null, false, false);
    }

    // Horizontal equilibrium axis rod & structural lower tie bar
    r.addCylinder([leftX + 2, eqY, 0], [rightX - 2, eqY, 0], 1.4, 1.4, pal.metalLight, 1, 6, false, false, false);
    r.addCylinder([leftX + 2, 12, 0], [rightX - 2, 12, 0], 1.7, 1.7, pal.metalDark, 1, 6, false, false, false);

    // Knurled brass tension adjuster knob on right tower
    r.addCylinder([rightX + 3, eqY, 0], [rightX + 10.5, eqY, 0], 4.4, 4.4, pal.brass, 1, 8, true, false, false);
    r.addCylinder([rightX + 1, eqY, 0], [rightX + 3.2, eqY, 0], 5.8, 5.8, pal.metalLight, 1, 8, true, false, false);

    // Wave calculation across 45 coupled vertical stainless oscillator rods (x in -68..+68)
    var segs = 44;
    var spanW = 136;
    var startX = -spanW * 0.5;
    var lamPx = clamp(lam * 16, 22, 126);
    var kWave = (2 * Math.PI) / lamPx;
    var phase = drawAll ? time * freq * 1.8 : 0;

    // End-drive harmonic oscillator cam motor + translucent enclosure housing on left tower
    r.addCylinder([leftX - 9.5, eqY, 0], [leftX - 1.5, eqY, 0], 5.8, 5.5, pal.graphite, 1, 8, true, false, false);
    r.addBox(leftX + 1, eqY, 0, 15, 21, 20, pal.glass, 0.24, pal.metalLight, false, false);
    var firstY = eqY + amp * Math.sin(-phase);
    var camAngle = -phase;
    var camPin = [leftX + 2 + 4.8 * Math.cos(camAngle), eqY + 4.8 * Math.sin(camAngle), 0];
    r.addCylinder([leftX + 2, eqY, -1.2], [leftX + 2, eqY, 1.2], 6.0, 6.0, pal.brass, 1, 24, true, false, false);
    r.addSphere([leftX + 2, eqY, 4.8], 4.2, pal.metalLight, 1, false);
    r.addCylinder(camPin, [startX, firstY, 0], 1.5, 1.5, pal.gold, 1, 6, false, false, false);

    var pts = [];
    var floorPts = [];
    for (var i = 0; i <= segs; i++) {
      var x = startX + (i / segs) * spanW;
      var y = eqY + amp * Math.sin(kWave * (x - startX) - phase);
      pts.push([x, y, 0]);
      floorPts.push([x, 0.45, clamp((y - eqY) * 0.42, -13, 13)]);
      var normY = (y - eqY) / Math.max(1, amp);
      var beadCol = normY >= 0 ? mixHex(pal.gold, pal.danger, normY) : mixHex(pal.gold, pal.cobalt, -normY);
      r.addLine([x, eqY, 0], [x, y, 0], pal.metalLight, 1.9, false, -0.5);
      r.addSphere([x, y, 0], 2.9, beadCol, 1, false);
    }

    // Continuous 64-pt glowing 3D wave ribbon along bead tips & floor shadow projection trace
    r.addTube3D(pts, pal.cyan, 3.0, !drawAll, true);
    r.addTube3D(floorPts, mixHex(pal.cobalt, "#1e293b", 0.42, 0.45), 1.9, true, false);

    // Overhead wavelength span indicator bar
    var lamEnd = Math.min(startX + lamPx, -startX);
    r.addLine([startX, 74, 0], [lamEnd, 74, 0], pal.gold, 1.9, false, -1);
    r.addLine([startX, 71, 0], [startX, 77, 0], pal.gold, 1.7, false, -1);
    r.addLine([lamEnd, 71, 0], [lamEnd, 77, 0], pal.gold, 1.7, false, -1);
  };

  // 11. FLUID-PRESSURE — Flanged Borosilicate Chamber, Hydraulic Press, Bathysphere, U-Tube & Gauge
  SCENES["fluid-pressure"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var rho = clamp(st.rho !== undefined ? st.rho : 1000, 400, 2000);
    var hDepth = clamp(st.h !== undefined ? st.h : 3, 0.5, 20);
    var rhoObj = clamp(st.rhoObj !== undefined ? st.rhoObj : 800, 200, 2200);
    var Pgauge = (rho * 9.8 * hDepth) / 1000;
    var cx = -12;

    // Stepped octagonal base plinth + bolted brushed-steel bottom chamber flange
    r.addOctaPlinth(cx, 3.1, 0, 114, 6.2, 98, 4.5, pal.metalDark, 1, true);
    r.addCylinder([cx, 6.2, 0], [cx, 10.0, 0], 45, 45, pal.titanium, 1, 32, false, false, false);
    var rodAngs = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    for (var ri = 0; ri < 4; ri++) {
      var rx = cx + Math.cos(rodAngs[ri]) * 42.5;
      var rz = Math.sin(rodAngs[ri]) * 42.5;
      r.addSphere([rx, 10.8, rz], 2.0, pal.brass, 1, false);
      r.addCylinder([rx, 10.0, rz], [rx, 61, rz], 1.5, 1.5, pal.metalLight, 1, 4, false, false, false);
    }

    // Thick-walled flanged borosilicate chamber + upper steel flange ring
    r.addCylinder([cx, 10.0, 0], [cx, 61, 0], 39, 39, pal.glass, 0.18, 32, false, false, false);
    r.addCylinder([cx, 60, 0], [cx, 63.2, 0], 44, 44, pal.titanium, 1, 32, false, false, false);

    // Translucent glowing teal liquid column reactive to fluid density rho & depth h
    var hNorm = hDepth <= 8 ? clamp(hDepth / 8, 0.06, 1) : clamp(hDepth / 20, 0.4, 1);
    var rhoNorm = clamp((rho - 600) / 800, 0, 1);
    var liqTop = clamp(43 + hNorm * 11 - rhoNorm * 3.0, 40, 56);
    var liqCol = mixHex(pal.glass, pal.cyan, 0.35 + rhoNorm * 0.55);
    var liqAlpha = clamp(0.24 + rhoNorm * 0.22, 0.24, 0.46);
    r.addCylinder([cx, 10.6, 0], [cx, liqTop, 0], 37, 37, liqCol, liqAlpha, 32, true, false, false);
    r.addRing([cx, liqTop, 0], 37.2, pal.cyan, 1.9, false);

    // Compact hydraulic press gantry columns + top load bridge + motor cap (clear of toolbar)
    r.addCylinder([cx - 42, 10.0, 0], [cx - 42, 72.5, 0], 2.6, 2.6, pal.metalDark, 1, 4, false, false, false);
    r.addCylinder([cx + 42, 10.0, 0], [cx + 42, 72.5, 0], 2.6, 2.6, pal.metalDark, 1, 4, false, false, false);
    r.addBox(cx, 73.8, 0, 96, 4.6, 18, pal.graphite, 1, null, false, false);
    r.addCylinder([cx - 8, 76.1, 0], [cx - 8, 81.5, 0], 9.0, 8.0, pal.cobalt, 1, 6, true, false, false);

    // Sealing O-ring piston collar + slotted brass weight + 3D compression spring under press head
    var pX = cx - 8;
    var pZ = -6;
    r.addRing([cx, liqTop - 0.8, 0], 36.8, pal.metalDark, 2.3, false);
    r.addCylinder([pX, liqTop - 1.5, pZ], [pX, liqTop + 2.5, pZ], 14, 14, pal.brass, 0.96, 10, true, false, false);
    r.addCylinder([pX, liqTop + 2.5, pZ], [pX, liqTop + 6.5, pZ], 11, 11, pal.gold, 1, 7, true, false, false);
    r.addSpring3D([pX, liqTop + 6.5, pZ], [pX, 71.5, pZ], 7.5, 4, 1.7, pal.metalLight);

    // Submerged brass Bathysphere depth sensor suspended at depth h + concentric turquoise rings
    var bx = cx - 18;
    var bz = 14;
    var sensorY = clamp(liqTop - 5 - hNorm * (liqTop - 19), 15, liqTop - 5);
    r.addCylinder([bx, liqTop + 2.5, bz], [bx, sensorY + 5, bz], 1.1, 1.1, pal.metalLight, 1, 4, false, false, false);
    r.addSphere([bx, sensorY, bz], 5.2, pal.brass, 1, false);
    r.addSphere([bx, sensorY, bz + 4.6], 1.9, pal.danger, 1, false);
    var pulseR = 1.0 + 0.14 * Math.sin(time * 2.8);
    r.addRing([bx, sensorY, bz], 9.0 * pulseR, pal.cyan, 1.8, false);
    r.addRing([bx, sensorY, bz], 13.5 * pulseR, mixHex(pal.cyan, "#ffffff", 0.25, 0.58), 1.3, false);

    // Buoyancy / Archimedes test block (floats when rhoObj <= rho, sinks when rhoObj > rho)
    var floats = rhoObj <= rho;
    var bob = floats ? Math.sin(time * 2.2) * 1.6 : 0;
    var subFrac = clamp(rhoObj / rho, 0.2, 1);
    var objX = cx + 17;
    var objZ = 10;
    var objY = floats ? liqTop + 3 - subFrac * 12 + bob : 18.0;
    r.addBox(objX, objY, objZ, 15, 14, 15, pal.gold, 0.95, pal.metalDark, false, false);
    r.addArrow([objX, objY + 7, objZ], [objX, objY + 21, objZ], 1.7, pal.emerald);
    r.addArrow([objX, objY - 7, objZ], [objX, Math.max(11, objY - 20), objZ], 1.7, pal.danger);

    // External tall side U-tube glass manometer column (right side x = 58..74)
    r.addBox(66, 4.5, 0, 38, 9, 32, pal.metalDark, 1, null, true, false);
    r.addCylinder([cx + 38, 15, 0], [58, 15, 0], 2.2, 2.2, pal.brass, 1, 4, false, false, false);
    r.addCylinder([58, 13, 0], [58, 68, 0], 4.2, 4.2, pal.glass, 0.26, 18, false, false, false);
    r.addCylinder([74, 13, 0], [74, 68, 0], 4.2, 4.2, pal.glass, 0.26, 18, false, false, false);
    r.addArc3D([66, 13.5, 0], 8.0, Math.PI, Math.PI * 2, [1, 0, 0], [0, 1, 0], pal.cyan, 4.2);
    var manDiff = clamp(Pgauge / 110, 0.05, 1) * 17;
    r.addCylinder([58, 13, 0], [58, clamp(38 - manDiff, 17, 40), 0], 2.7, 2.7, pal.cyan, 0.9, 18, false, false, false);
    r.addCylinder([74, 13, 0], [74, clamp(38 + manDiff, 36, 64), 0], 2.7, 2.7, pal.cyan, 0.9, 18, false, false, false);

    // Mounted 3D analog pressure dial gauge on front-right manifold deflecting with P = P0 + rho*g*h
    r.addCylinder([cx + 36, 24, 12], [44, 24, 20], 2.2, 2.2, pal.brass, 1, 4, false, false, false);
    r.addCylinder([44, 24, 20], [44, 39, 20], 2.2, 2.2, pal.brass, 1, 4, false, false, false);
    var pFrac = clamp(Pgauge / 115, 0.04, 0.98);
    r.addGauge3D([44, 49, 21], 11.2, pFrac, pal.danger, [0.16, 0.16, 0.97]);
  };

  // 12. IDEAL-GAS — Quartz Chamber, Induction Heater Coil, Dual-Ring Piston, Dual Gauges & 27 Molecules
  SCENES["ideal-gas"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var T = clamp(st.T !== undefined ? st.T : 300, 150, 700);
    var V = clamp(st.V !== undefined ? st.V : 5, 1.5, 12);
    var n = clamp(st.n !== undefined ? st.n : 1, 0.5, 4);
    var P = st.P !== undefined ? st.P : (n * 8.314 * T) / Math.max(0.5, V);
    var isHidden = !!st.isGame && !st.revealed;
    var pulsing = !!(pulse && pulse.active && performance.now() - pulse.started < 700);

    var pisH = clamp(24 + ((V - 2) / 8) * 34, 24, 58);
    if (pulsing) {
      pisH = clamp(pisH - Math.sin(((performance.now() - pulse.started) / 700) * Math.PI) * 4.5, 22.5, 59);
    }

    var cx = -10;
    // Octagonal pedestal + lower bolted steel flange + 4 tie-bolts
    r.addOctaPlinth(cx, 3.2, 0, 118, 6.4, 94, 4.5, pal.metalDark, 1, true);
    r.addCylinder([cx, 6.4, 0], [cx, 12.0, 0], 45, 45, pal.titanium, 1, 32, true, false, false);
    var bAngs = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    for (var bi = 0; bi < 4; bi++) {
      var bx = cx + Math.cos(bAngs[bi]) * 42;
      var bz = Math.sin(bAngs[bi]) * 42;
      r.addSphere([bx, 12.6, bz], 1.9, pal.brass, 1, false);
      r.addCylinder([bx, 12.0, bz], [bx, 66.5, bz], 1.4, 1.4, pal.metalLight, 1, 5, false, false, false);
    }

    // Bottom copper induction heating coil glowing cobalt -> orange -> crimson with T
    var tNorm = clamp((T - 200) / 400, 0, 1);
    var coilCol = tNorm < 0.35
      ? mixHex(pal.cobalt, pal.bronze, tNorm / 0.35)
      : tNorm < 0.7
      ? mixHex(pal.bronze, pal.orange, (tNorm - 0.35) / 0.35)
      : mixHex(pal.orange, pal.danger, (tNorm - 0.7) / 0.3);
    r.addSpring3D([cx, 11.4, 0], [cx, 17.2, 0], 39, 3, 2.2, coilCol);
    r.addCylinder([cx, 12.0, 0], [cx, 14.0, 0], 35, 35, coilCol, clamp(0.32 + tNorm * 0.56, 0.32, 0.88), 32, true, false, false);

    // Compacted quartz glass chamber + top bolted steel retaining collar (clear of toolbar)
    r.addCylinder([cx, 13.5, 0], [cx, 66.0, 0], 38, 38, pal.glass, 0.18, 32, false, false, false);
    r.addCylinder([cx, 65.0, 0], [cx, 68.4, 0], 44, 44, pal.titanium, 1, 32, true, false, false);

    // Dual-ring sealed brass movable piston head + slotted pressure weights + chrome plunger rod
    r.addCylinder([cx, pisH, 0], [cx, pisH + 6.0, 0], 35.5, 35.5, pal.brass, 0.96, 32, true, false, false);
    r.addRing([cx, pisH + 1.2, 0], 36.4, pal.metalDark, 2.2, false);
    r.addRing([cx, pisH + 4.5, 0], 36.4, pal.metalDark, 2.2, false);
    r.addCylinder([cx, pisH + 6.0, 0], [cx, pisH + 10.5, 0], 17, 17, pal.graphite, 1, 8, true, false, false);
    r.addCylinder([cx, pisH + 10.5, 0], [cx, pisH + 20.5, 0], 4.2, 4.2, pal.metalLight, 1, 6, true, false, false);
    r.addCylinder([cx - 14, pisH + 20.5, 0], [cx + 14, pisH + 20.5, 0], 2.8, 2.8, pal.metalDark, 1, 6, true, false, false);

    // Exterior dual analog gauges console (top: Pressure P, bottom: Temperature T)
    r.addChamferBox(64, 9.5, 0, 32, 13, 22, pal.graphite, 1, null, false, false);
    r.addBox(64, 36, 4, 8, 30, 6, pal.metalDark, 1, null, false, false);
    r.addCylinder([28, 21, 0], [50, 21, 0], 2.2, 2.2, pal.brass, 1, 5, false, false, false);
    r.addCylinder([28, 36, 0], [50, 36, 0], 2.2, 2.2, pal.brass, 1, 5, false, false, false);

    var pFrac = isHidden && !pulsing ? 0.03 : clamp(Math.pow(clamp(P / 2400, 0, 1), 0.65), 0.04, 0.98);
    r.addGauge3D([64, 50, 9], 11.2, pFrac, pal.danger, [0.16, 0.14, 0.98]);
    r.addGauge3D([64, 24, 11.5], 9.8, clamp(tNorm, 0.04, 0.98), pal.orange, [0.16, 0.14, 0.98]);

    // 26-28 animated glowing PBR gas spheres colliding strictly inside [base..pisH] & r <= 30
    var speedScale = Math.sqrt(T / 300) * 1.45;
    var molCount = Math.round(clamp(25 + n * 1.5, 26, 28));
    var molR = clamp(2.6 + (n - 1) * 0.22, 2.6, 3.2);
    var molCol = tNorm < 0.35
      ? mixHex(pal.cyan, pal.emerald, tNorm / 0.35)
      : tNorm < 0.7
      ? mixHex(pal.gold, pal.orange, (tNorm - 0.35) / 0.35)
      : mixHex(pal.orange, pal.danger, (tNorm - 0.7) / 0.3);
    var yLo = 14.8 + molR;
    var yHi = Math.max(yLo + 1.2, pisH - molR - 0.6);
    for (var i = 0; i < molCount; i++) {
      var s1 = Math.sin(i * 12.9898 + 1.1) * 43758.5453;
      var s2 = Math.cos(i * 78.233 + 2.3) * 19341.12;
      var s3 = Math.sin(i * 45.164 + 3.7) * 28411.71;
      var phX = Math.abs((s1 - Math.floor(s1)) * 2 + time * speedScale * (0.7 + (i % 4) * 0.18));
      var phZ = Math.abs((s2 - Math.floor(s2)) * 2 + time * speedScale * (0.65 + (i % 3) * 0.22));
      var phY = Math.abs((s3 - Math.floor(s3)) * 2 + time * speedScale * (0.8 + (i % 5) * 0.16));
      var tx = 1 - Math.abs((phX % 2) - 1);
      var tz = 1 - Math.abs((phZ % 2) - 1);
      var ty = 1 - Math.abs((phY % 2) - 1);
      var dx = (tx * 2 - 1) * 28.5;
      var dz = (tz * 2 - 1) * 28.5;
      var radD = Math.hypot(dx, dz);
      if (radD > 29.5) {
        dx = (dx / radD) * 29.5;
        dz = (dz / radD) * 29.5;
      }
      var py = yLo + ty * (yHi - yLo);
      if (T >= 360) {
        var dirX = (phX % 2) < 1 ? 1 : -1;
        var dirY = (phY % 2) < 1 ? 1 : -1;
        var dirZ = (phZ % 2) < 1 ? 1 : -1;
        var trailLen = clamp((T - 340) * 0.014, 1.8, 5.2);
        r.addLine(
          [cx + dx - dirX * trailLen, clamp(py - dirY * trailLen * 0.65, yLo, yHi), dz - dirZ * trailLen * 0.6],
          [cx + dx, py, dz],
          mixHex(molCol, "#ffffff", 0.35, 0.48),
          1.4,
          false,
          -0.3
        );
      }
      r.addSphere([cx + dx, py, dz], molR, molCol, 1, false);
    }
  };

  // 13. THIN-LENS — Twin-Rail Optical Bench, Biconvex/Biconcave Lens, 3 Sliders & Principal Rays
  SCENES["thin-lens"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    // Precision twin-rail machined optical bench with leveling feet & metric scale ticks
    var footXs = [-76, 76];
    var footZs = [-12, 12];
    for (var fi = 0; fi < footXs.length; fi++) {
      for (var fj = 0; fj < footZs.length; fj++) {
        r.addCylinder([footXs[fi], 0, footZs[fj]], [footXs[fi], 3.6, footZs[fj]], 3.4, 2.1, pal.metalDark, 1, 5, false, true, true);
      }
    }
    r.addChamferBox(0, 6.0, 0, 184, 4.8, 30, pal.metalDark, 1, null, true, false);
    r.addBox(0, 9.4, 9.5, 178, 1.6, 2.6, pal.metalLight, 1, null, false, false);
    r.addBox(0, 9.4, -9.5, 178, 1.6, 2.6, pal.metalLight, 1, null, false, false);
    r.addBox(-90, 10.2, 0, 4.5, 6.8, 30, pal.graphite, 1, null, false, false);
    r.addBox(90, 10.2, 0, 4.5, 6.8, 30, pal.graphite, 1, null, false, false);
    for (var tx = -72; tx <= 72; tx += 18) {
      var maj = tx % 36 === 0;
      r.addLine([tx, 9.0, 11.0], [tx, 9.0, maj ? 14.5 : 13.2], pal.metalLight, maj ? 1.5 : 1.0, false, -0.5);
    }

    var axY = 42;
    r.addLine([-86, axY, 0], [86, axY, 0], pal.floorAxis, 1.4, true, -0.5);

    var scale = 1.42;
    var f = clamp(st.f || 15, 6, 30);
    var s = clamp(st.s || 30, 6, 65);
    var isConcave = !!st.isConcave;
    var objX = clamp(-s * scale, -84, -10);
    var fX = clamp(f * scale, 9, 44);
    var isHidden = !!st.isGame && !st.revealed;
    var firing = pulse && pulse.active && performance.now() - pulse.started < 1100;

    // Center rider: brass & chrome precision lens mount holding sculpted biconvex or biconcave lens
    r.addChamferBox(0, 12.6, 0, 18, 4.6, 25, pal.graphite, 1, null, false, false);
    r.addCylinder([0, 14.9, 0], [0, 18.8, 0], 3.8, 3.2, pal.brass, 1, 8, true, false, false);
    r.addBox(0, axY, -24.5, 4.0, 7.5, 3.5, pal.brass, 1, null, false, false);
    r.addBox(0, axY, 24.5, 4.0, 7.5, 3.5, pal.brass, 1, null, false, false);
    if (isConcave) {
      r.addCylinder([-6.0, axY, 0], [6.0, axY, 0], 24, 24, pal.glass, 0.28, 36, false, false, false);
      r.addCylinder([6.0, axY, 0], [1.4, axY, 0], 24, 10.5, pal.glass, 0.42, 36, true, false, false);
      r.addCylinder([-6.0, axY, 0], [-1.4, axY, 0], 24, 10.5, pal.glass, 0.42, 36, true, false, false);
      r.addArc3D([-6.0, axY, 0], 24.4, 0, Math.PI * 2, [0, 1, 0], [0, 0, 1], pal.metalLight, 1.9);
      r.addArc3D([6.0, axY, 0], 24.4, 0, Math.PI * 2, [0, 1, 0], [0, 0, 1], pal.metalLight, 1.9);
    } else {
      r.addCylinder([-2.0, axY, 0], [2.0, axY, 0], 24, 24, pal.glass, 0.38, 36, false, false, false);
      r.addCylinder([2.0, axY, 0], [7.0, axY, 0], 24, 9.0, pal.glass, 0.36, 36, true, false, false);
      r.addCylinder([-2.0, axY, 0], [-7.0, axY, 0], 24, 9.0, pal.glass, 0.36, 36, true, false, false);
      r.addArc3D([0, axY, 0], 24.6, 0, Math.PI * 2, [0, 1, 0], [0, 0, 1], pal.cyan, 2.0);
    }

    // Twin golden focal spheres (F front & back) on tiny posts
    var focalXs = [-fX, fX];
    for (var fi2 = 0; fi2 < 2; fi2++) {
      r.addCylinder([focalXs[fi2], 10.2, 0], [focalXs[fi2], 16.0, 0], 1.3, 1.3, pal.metalLight, 1, 5, false, false, false);
      r.addSphere([focalXs[fi2], 17.4, 0], 3.2, pal.gold, 1, false);
      r.addLine([focalXs[fi2], 20.6, 0], [focalXs[fi2], axY, 0], pal.gold, 1.2, true, -0.5);
    }

    // Left rider: illuminated vertical 3D object arrow beacon on collimated holder
    var objH = 22;
    var objTipY = axY + objH;
    r.addBox(objX, 12.2, 0, 14, 4.2, 23, pal.graphite, 1, null, false, false);
    r.addCylinder([objX, 14.3, 0], [objX, axY, 0], 1.6, 1.5, pal.metalLight, 1, 6, false, false, false);
    r.addCylinder([objX, axY - 2, 0], [objX, axY + 0.6, 0], 3.8, 3.8, pal.brass, 1, 8, true, false, false);
    r.addArrow([objX, axY, 0], [objX, objTipY, 0], 2.3, pal.danger);
    r.addSphere([objX, objTipY, 0], 2.8, pal.ivory, 1, false);

    // Optional target projection screen carriage in game mode
    if (st.targetDist) {
      var tx = clamp(st.targetDist * scale, 15, 84);
      r.addBox(tx, 12.2, 0, 14, 4.2, 25, pal.graphite, 1, null, false, false);
      r.addCylinder([tx, 14.3, -14], [tx, 65, -14], 1.3, 1.3, pal.metalLight, 1, 5, false, false, false);
      r.addCylinder([tx, 14.3, 14], [tx, 65, 14], 1.3, 1.3, pal.metalLight, 1, 5, false, false, false);
      r.addBox(tx, axY, 0, 2.4, 44, 28, pal.gold, 0.34, pal.gold, false, false);
      r.addArc3D([tx, axY, 0], 8.0, 0, Math.PI * 2, [0, 1, 0], [0, 0, 1], pal.gold, 1.7);
    }

    // Right rider & 3-pass principal optical ray tubes
    if (!isHidden || firing) {
      var F = isConcave ? -f : f;
      if (!isConcave && Math.abs(s - f) <= 0.35) {
        // Object at focal point -> outgoing parallel beam to infinity
        var slopeInf = -objH / Math.max(8, -objX);
        r.addStraightTube3D([[objX, objTipY, 0], [0, objTipY, 0], [82, clamp(objTipY + slopeInf * 82, 14, 78), 0]], pal.danger, 2.0, false, false);
        r.addStraightTube3D([[objX, objTipY, 0], [0, axY, 0], [82, clamp(axY + slopeInf * 82, 12, 76), 0]], pal.gold, 1.8, false, false);
      } else {
        var sp = (s * F) / (s - F);
        if (sp > 0) {
          var m = -sp / s;
          var rawX = sp * scale;
          var rawDY = m * objH;
          var fitR = Math.min(1, 84 / Math.max(14, rawX), 28 / Math.max(1, Math.abs(rawDY)));
          var imgX = clamp(rawX * fitR, 14, 84);
          var imgTipY = axY + rawDY * fitR;
          if (!st.targetDist) {
            r.addBox(imgX, 12.2, 0, 14, 4.2, 25, pal.graphite, 1, null, false, false);
            r.addCylinder([imgX, 14.3, -14], [imgX, 65, -14], 1.3, 1.3, pal.metalLight, 1, 5, false, false, false);
            r.addCylinder([imgX, 14.3, 14], [imgX, 65, 14], 1.3, 1.3, pal.metalLight, 1, 5, false, false, false);
            r.addBox(imgX, axY, 0, 2.2, 44, 28, pal.glass, 0.24, pal.metalLight, false, false);
          }
          r.addArrow([imgX, axY, 0], [imgX, imgTipY, 0], 2.2, pal.emerald);
          r.addSphere([imgX, imgTipY, 0], 3.0, pal.emerald, 1, false);
          var parRayPts = fitR === 1
            ? [[objX, objTipY, 0], [0, objTipY, 0], [fX, axY, 0], [imgX, imgTipY, 0]]
            : [[objX, objTipY, 0], [0, objTipY, 0], [imgX, imgTipY, 0]];
          r.addStraightTube3D(parRayPts, pal.danger, 2.0, false, false);
          r.addStraightTube3D([[objX, objTipY, 0], [0, axY, 0], [imgX, imgTipY, 0]], pal.gold, 1.8, false, false);
          if (Math.abs(imgTipY - axY) <= 23) {
            r.addStraightTube3D([[objX, objTipY, 0], [0, imgTipY, 0], [imgX, imgTipY, 0]], pal.orange, 1.5, false, false);
          }
        } else {
          var vImgX = clamp(sp * scale, -84, -8);
          var vm = -sp / s;
          var vTipY = clamp(axY + vm * objH, 46, 76);
          r.addArrow([vImgX, axY, 0], [vImgX, vTipY, 0], 2.0, pal.cyan);
          var divSlope = (objTipY - vTipY) / Math.max(8, -vImgX);
          var cenSlope = -objH / Math.max(8, -objX);
          r.addStraightTube3D([[objX, objTipY, 0], [0, objTipY, 0], [74, clamp(objTipY + divSlope * 74, 16, 80), 0]], pal.danger, 1.9, false, false);
          r.addStraightTube3D([[objX, objTipY, 0], [0, axY, 0], [74, clamp(axY + cenSlope * 74, 14, 42), 0]], pal.gold, 1.7, false, false);
          r.addStraightTube3D([[0, objTipY, 0], [vImgX, vTipY, 0]], pal.cyan, 1.4, true, false);
          r.addStraightTube3D([[0, axY, 0], [vImgX, vTipY, 0]], pal.glass, 1.3, true, false);
        }
      }
    } else {
      r.addStraightTube3D([[objX, objTipY, 0], [0, objTipY, 0]], pal.danger, 1.9, true, false);
      r.addStraightTube3D([[objX, objTipY, 0], [0, axY, 0]], pal.gold, 1.7, true, false);
    }
  };

  // 14. MAGNETIC-INDUCTION — AlNiCo Magnet + Solenoid/Galvanometer + Lorentz Ring / Faraday Rails
  SCENES["magnetic-induction"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 38);

    var B = clamp(st.B !== undefined ? st.B : 0.8, 0.1, 3.0);
    var v = clamp(st.v !== undefined ? st.v : 10, 0.5, 30);
    var turns = clamp(st.turns !== undefined ? st.turns : 7, 3, 12);
    var wireMode = !!st.wireMode;

    // Precision electromagnetism bench w/ 4 rubber feet & phenolic isolation rails
    var fXs = [-78, 78];
    var fZs = [-35, 35];
    for (var fi = 0; fi < 2; fi++) {
      for (var fj = 0; fj < 2; fj++) {
        r.addSphere([fXs[fi], 2.2, fZs[fj]], 3.0, pal.metalDark, 1, true);
      }
    }
    r.addChamferBox(0, 6.2, 0, 182, 5.0, 84, pal.metalDark, 1, null, true, true);
    r.addChamferBox(0, 9.8, -32, 168, 2.2, 6.5, pal.graphite, 1, null, false, false);
    r.addChamferBox(0, 9.8, 32, 168, 2.2, 6.5, pal.graphite, 1, null, false, false);

    // Front benchtop center-zero analog galvanometer console
    r.addChamferBox(0, 15.8, 33, 34, 13, 14, pal.graphite, 1, null, false, false);

    if (wireMode) {
      var railPhase = time * clamp(0.75 + v * 0.12, 0.9, 3.4);
      var railX = Math.sin(railPhase) * 44;
      var vInst = Math.cos(railPhase);
      var galvFrac = clamp(0.5 + 0.44 * clamp((B * v) / 30, 0.2, 1.0) * vInst, 0.04, 0.96);
      r.addGauge3D([0, 21.5, 39], 10.2, galvFrac, pal.emerald, [0, 0.24, 0.97]);

      // Pole base plate + 6 vertical B-field flux arrows rising through rails
      r.addChamferBox(0, 10.4, 0, 126, 3.2, 48, pal.cobalt, 0.72, null, false, false);
      var bCount = B >= 1.3 ? 6 : 4;
      for (var bi = 0; bi < bCount; bi++) {
        var bx = -44 + (bi / Math.max(1, bCount - 1)) * 88;
        var bz = bi % 2 === 0 ? -11 : 11;
        r.addLine([bx, 12, bz], [bx, 76, bz], pal.cyan, 1.8, false, -0.5);
        r.addCone([bx, 74, bz], [bx, 82, bz], 2.8, pal.cyan, 1, 6, false, false);
      }

      // 4 ceramic insulator pillars + elevated twin brass conductor rails + end resistor load
      var pXs = [-66, 66];
      var pZs = [-20, 20];
      for (var pi = 0; pi < 2; pi++) {
        for (var pj = 0; pj < 2; pj++) {
          r.addCylinder([pXs[pi], 10.8, pZs[pj]], [pXs[pi], 48, pZs[pj]], 2.5, 2.1, pal.ivory, 1, 6, false, false, false);
        }
      }
      r.addChamferBox(0, 50, -20, 146, 4.0, 4.6, pal.brass, 1, null, false, false);
      r.addChamferBox(0, 50, 20, 146, 4.0, 4.6, pal.brass, 1, null, false, false);
      r.addCylinder([-70, 50, -20], [-70, 50, 20], 2.4, 2.4, pal.bronze, 1, 6, false, false, false);
      r.addCylinder([-70, 50, -9], [-70, 50, 9], 5.4, 5.4, pal.orange, 1, 8, true, false, false);
      r.addRing([-70, 50, -4], 5.6, pal.gold, 1.5, false);
      r.addRing([-70, 50, 4], 5.6, pal.cobalt, 1.5, false);

      // Copper return leads to front galvanometer
      r.addCylinder([-66, 10.8, 20], [-16, 16, 30], 1.6, 1.6, pal.bronze, 1, 5, false, false, false);
      r.addCylinder([66, 10.8, 20], [16, 16, 30], 1.6, 1.6, pal.bronze, 1, 5, false, false, false);

      // Sliding brass conductor rod sweeping back & forth + velocity & induced force arrows
      r.addCylinder([railX, 50, -24], [railX, 50, 24], 3.8, 3.8, pal.gold, 1, 10, true, false, false);
      r.addSphere([railX, 50, -20], 4.6, pal.brass, 1, false);
      r.addSphere([railX, 50, 20], 4.6, pal.brass, 1, false);
      var vDir = vInst >= 0 ? 1 : -1;
      var vLen = clamp(12 + Math.abs(vInst) * v * 0.9, 12, 28);
      r.addArrow([railX, 58, 0], [railX + vDir * vLen, 58, 0], 2.0, pal.emerald);
      r.addArrow([railX, 50, 0], [railX, 50, vDir * -18], 1.9, pal.danger);
      if (railX > -62) {
        var iShift = Math.sin(railPhase) * clamp((B * v) / 14, 0.25, 1.8);
        for (var ec = 0; ec < 8; ec++) {
          var lFrac = (((ec / 8 + iShift) % 1) + 1) % 1;
          var ePos;
          if (lFrac < 0.30) {
            ePos = [-70 + (railX + 70) * (lFrac / 0.30), 50, -20];
          } else if (lFrac < 0.50) {
            ePos = [railX, 50, -20 + 40 * ((lFrac - 0.30) / 0.20)];
          } else if (lFrac < 0.80) {
            ePos = [railX - (railX + 70) * ((lFrac - 0.50) / 0.30), 50, 20];
          } else {
            ePos = [-70, 50, 20 - 40 * ((lFrac - 0.80) / 0.20)];
          }
          r.addSphere(ePos, 2.6, pal.cyan, 1, false);
        }
      }
    } else {
      var emfPhase = time * clamp(1.0 + v * 0.14, 1.2, 3.8);
      var emfAmp = clamp((B / 1.8) * (v / 18) * (turns / 7), 0.18, 1.0);
      var galvFracL = clamp(0.5 + 0.44 * emfAmp * Math.cos(emfPhase), 0.04, 0.96);
      r.addGauge3D([0, 21.5, 39], 10.2, galvFracL, pal.emerald, [0, 0.24, 0.97]);

      // Heavy chamfered red-North / cobalt-South AlNiCo magnet assembly w/ yoke & pole faces
      r.addChamferBox(0, 19, -22, 130, 15, 13, pal.titanium, 1, null, false, false);
      r.addChamferBox(-48, 21, -3, 34, 19, 34, pal.danger, 1, null, true, false);
      r.addBox(-29.5, 21, -3, 3.6, 18, 32, pal.metalLight, 1, null, false, false);
      r.addChamferBox(48, 21, -3, 34, 19, 34, pal.cobalt, 1, null, true, false);
      r.addBox(29.5, 21, -3, 3.6, 18, 32, pal.metalLight, 1, null, false, false);

      // Multi-turn wound thick copper solenoid bobbin + leads to galvanometer
      r.addCylinder([-18, 24, -3], [18, 24, -3], 9.8, 9.8, pal.glass, 0.34, 10, true, false, false);
      r.addRing([-17, 24, -3], 10.6, pal.brass, 1.8, false);
      r.addRing([17, 24, -3], 10.6, pal.brass, 1.8, false);
      r.addSpring3D([-16, 24, -3], [16, 24, -3], 12.2, Math.round(clamp(turns, 4, 9)), 2.0, pal.bronze);
      r.addCylinder([-16, 16, 6], [-13, 16, 29], 1.6, 1.6, pal.bronze, 1, 5, false, false, false);
      r.addCylinder([16, 16, 6], [13, 16, 29], 1.6, 1.6, pal.bronze, 1, 5, false, false, false);

      // 3D glowing cyan magnetic flux loops arching between N and S poles + tracer beads
      for (var az = -2; az <= 2; az++) {
        var ang = az * 0.42;
        var arc = [];
        for (var k = 0; k <= 16; k++) {
          var f = k / 16;
          var lx = -30 + f * 60;
          var bulge = Math.sin(f * Math.PI) * (26 + Math.abs(az) * 10);
          arc.push([lx, 24 + bulge * Math.cos(ang), -3 + bulge * Math.sin(ang)]);
        }
        r.addGlowCurve(arc, pal.cyan, 1.5, true, false);
        var bf = (time * clamp(0.45 + B * 0.22, 0.5, 1.2) + (az + 2) * 0.2) % 1;
        var blx = -30 + bf * 60;
        var bBulge = Math.sin(bf * Math.PI) * (26 + Math.abs(az) * 10);
        r.addSphere([blx, 24 + bBulge * Math.cos(ang), -3 + bBulge * Math.sin(ang)], 2.1, pal.cyan, 1, false);
      }

      // Orbiting charge ring showing Lorentz circular motion (r = mv/qB)
      var orbR = clamp(14 + (v / Math.max(0.25, B)) * 1.1, 15, 34);
      var theta = time * clamp(0.8 + B * 0.9, 0.6, 4.0);
      var ox = orbR * Math.cos(theta);
      var oz = -3 + orbR * Math.sin(theta);
      r.addRing([0, 68, -3], orbR, pal.emerald, 2.0, false);
      r.addLine([0, 42, -3], [0, 84, -3], mixHex(pal.cyan, "#ffffff", 0.2, 0.65), 1.4, true, -0.5);
      r.addSphere([ox, 68, oz], 5.6, pal.danger, 1, false);
      r.addArrow([ox, 68, oz], [ox * 0.32, 68, -3 + (oz + 3) * 0.32], 1.8, pal.emerald);
      var tx = -Math.sin(theta) * 18;
      var tz = Math.cos(theta) * 18;
      r.addArrow([ox, 68, oz], [ox + tx, 68, oz + tz], 1.7, pal.gold);
    }
  };

  // 15. MODERN-QUANTUM — Photoelectric Vacuum Tube, Nuclear Decay Bell Jar & Relativistic Maglev Clocks
  SCENES["modern-quantum"] = function (r, st, time, pulse) {
    var pal = r.pal;
    var mode = st.mode || "photoelectric";
    r.addFloorGrid(240, 160, 38);

    if (mode === "decay") {
      var frac = clamp(st.remainFrac !== undefined ? st.remainFrac : 0.5, 0.0, 1.0);
      var cx = -16;

      // Lead-lined heavy octagonal nuclear containment pedestal + yellow/amber trefoil rim accent
      r.addOctaPlinth(cx, 4.5, 0, 106, 9, 106, 12, pal.graphite, 1, true);
      r.addOctaPlinth(cx, 10.6, 0, 88, 3.2, 88, 10, pal.gold, 1, false);
      for (var ti = 0; ti < 3; ti++) {
        var tAng = (ti / 3) * Math.PI * 2 + 0.3;
        r.addArc3D([cx, 12.6, 0], 35, tAng, tAng + 0.72, [1, 0, 0], [0, 0, 1], pal.metalDark, 2.4);
      }
      r.addCylinder([cx, 12.2, 0], [cx, 16.5, 0], 33, 31, pal.metalDark, 1, 14, true, false, false);

      // Borosilicate dome bell jar covering the radioactive cluster
      r.addCylinder([cx, 16.5, 0], [cx, 52, 0], 35, 35, pal.glass, 0.16, 16, false, false, false);
      r.addCylinder([cx, 52, 0], [cx, 68, 0], 35, 22, pal.glass, 0.16, 16, false, false, false);
      r.addCylinder([cx, 68, 0], [cx, 76.5, 0], 22, 8, pal.glass, 0.18, 16, true, false, false);
      r.addSphere([cx, 79, 0], 4.0, pal.brass, 1, false);

      // Clustered 3D radioactive nucleus (27 nucleons: golden parents & cobalt/slate daughters)
      var total = 27;
      var activeCount = Math.round(total * frac);
      var daughterCol = mixHex(pal.cobalt, pal.metal, 0.42);
      var idx = 0;
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = -1; iy <= 1; iy++) {
          for (var iz = -1; iz <= 1; iz++) {
            var active = idx < activeCount;
            var jx = active ? Math.sin(time * 5.2 + idx * 1.7) * 0.9 : 0;
            var jy = active ? Math.cos(time * 4.7 + idx * 2.3) * 0.9 : 0;
            r.addSphere(
              [cx + ix * 7.6 + jx, 38 + iy * 7.6 + jy, iz * 7.6],
              4.6,
              active ? pal.gold : daughterCol,
              active ? 1 : 0.72,
              false
            );
            idx++;
          }
        }
      }

      // Radiating alpha, beta & gamma emission rays toward side Geiger-Muller detector
      if (frac > 0.02) {
        var rayF = (time * 0.85) % 1;
        var aPos;
        if (rayF <= 0.45) {
          var u1 = rayF / 0.45;
          aPos = [cx + 12 + 18 * u1, 43 + 4 * u1, -4];
        } else {
          var u2 = (rayF - 0.45) / 0.55;
          aPos = [cx + 30 + 22 * u2, 47 - 7 * u2, -4 + 2 * u2];
        }
        r.addGlowCurve([[cx + 12, 43, -4], [cx + 30, 47, -4], [cx + 52, 40, -2]], pal.orange, 1.8, true, false);
        r.addSphere(aPos, 3.0, pal.gold, 1, false);
        r.addGlowCurve([[cx + 12, 33, 5], [cx + 32, 29, 7], [cx + 52, 36, 2]], pal.cyan, 1.5, true, false);
        var betaF = (time * 1.15 + 0.35) % 1;
        var bPos = betaF <= 0.5
          ? [cx + 12 + 20 * (betaF * 2), 33 - 4 * (betaF * 2), 5 + 2 * (betaF * 2)]
          : [cx + 32 + 20 * ((betaF - 0.5) * 2), 29 + 7 * ((betaF - 0.5) * 2), 7 - 5 * ((betaF - 0.5) * 2)];
        r.addSphere(bPos, 2.5, pal.cyan, 1, false);
        r.addSpring3D([cx + 14, 38, 0], [cx + 52, 38, 0], 3.2, 4, 1.2, pal.violet);
      }

      // Side cylindrical Geiger-Muller detector tube & radiation count-rate analog gauge
      var gx = 64;
      r.addChamferBox(gx, 6.2, 0, 34, 12.4, 38, pal.metalDark, 1, null, true, true);
      r.addCylinder([gx, 12.4, 0], [gx, 34, 0], 4.2, 4.2, pal.titanium, 1, 8, false, false, false);
      r.addCylinder([gx - 18, 38, 0], [gx + 16, 38, 0], 10.5, 10.5, pal.titanium, 1, 14, true, false, false);
      r.addCylinder([gx - 22, 38, 0], [gx - 18, 38, 0], 9.2, 10.2, pal.danger, 0.92, 12, true, false, false);
      r.addTube3D([[gx + 16, 38, 0], [gx + 22, 26, 6], [gx + 12, 14, 16]], pal.graphite, 2.2, false, false);
      r.addGauge3D([gx, 21, 20.5], 10.2, clamp(frac, 0.03, 0.98), pal.danger, [0.12, 0.22, 0.97]);
      return;
    }

    if (mode === "relativity") {
      var beta = clamp(st.beta !== undefined ? st.beta : 0.6, 0, 0.98);
      var gamma = 1 / Math.sqrt(Math.max(0.001, 1 - beta * beta));
      function triWave(p) {
        var m = ((p % 2) + 2) % 2;
        return m <= 1 ? m : 2 - m;
      }

      // Optical-maglev lab bench + twin parallel tracks (rear stationary, front relativistic)
      r.addChamferBox(0, 4.2, 0, 184, 4.4, 74, pal.metalDark, 1, null, true, true);
      r.addCylinder([-84, 7.6, -21], [84, 7.6, -21], 1.3, 1.3, pal.metalLight, 1, 6, false, false, false);
      r.addCylinder([-84, 7.6, -13], [84, 7.6, -13], 1.3, 1.3, pal.metalLight, 1, 6, false, false, false);
      r.addCylinder([-84, 7.6, 8], [84, 7.6, 8], 1.5, 1.5, pal.cyan, 1, 6, false, false, false);
      r.addCylinder([-84, 7.6, 16], [84, 7.6, 16], 1.5, 1.5, pal.cyan, 1, 6, false, false, false);
      for (var si = -72; si <= 72; si += 24) {
        r.addLine([si, 6.7, -22], [si, 6.7, -12], pal.metal, 1.4, false, -0.4);
      }

      // Background stationary twin vertical photon clock frame clearly on left-rear platform (L0 = 54)
      var refX = -58;
      var refZ = -18;
      r.addChamferBox(refX, 11.5, refZ, 50, 5.6, 15, pal.titanium, 1, null, false, false);
      r.addBox(refX, 12.2, refZ + 8.6, 50, 2.2, 2.4, pal.emerald, 0.92, null, false, false);
      r.addCylinder([refX - 20, 14.3, refZ], [refX - 20, 74, refZ], 1.5, 1.5, pal.metalLight, 1, 6, false, false, false);
      r.addCylinder([refX + 20, 14.3, refZ], [refX + 20, 74, refZ], 1.5, 1.5, pal.metalLight, 1, 6, false, false, false);
      r.addChamferBox(refX, 18, refZ, 28, 3.4, 12, pal.metalLight, 1, null, false, false);
      r.addChamferBox(refX, 74, refZ, 28, 3.4, 12, pal.metalLight, 1, null, false, false);
      r.addStraightTube3D([[refX, 20, refZ], [refX, 72, refZ]], pal.emerald, 2.1, false, false);
      var yStat = 22 + 48 * triWave(time * 1.4);
      r.addSphere([refX, yStat, refZ], 4.0, pal.emerald, 1, false);

      // Foreground moving relativistic maglev sled clock strictly on right half so both read side-by-side
      var relZ = 12;
      var xPos = beta > 0.01 ? 22 + (0.5 - 0.5 * Math.cos(time * (0.55 + beta * 1.35))) * 38 : 34;
      var lenCon = clamp(50 / gamma, 13, 50);
      var mWidth = Math.max(11, lenCon * 0.65);
      var strutOff = Math.max(4.8, lenCon * 0.39);
      r.addChamferBox(xPos, 11.5, relZ, lenCon, 5.6, 15, pal.cobalt, 1, null, true, false);
      r.addBox(xPos, 12.2, relZ + 8.6, lenCon, 2.2, 2.4, pal.cyan, 0.95, null, false, false);
      r.addCylinder([xPos - strutOff, 14.3, relZ], [xPos - strutOff, 74, relZ], 1.5, 1.5, pal.metalLight, 1, 6, false, false, false);
      r.addCylinder([xPos + strutOff, 14.3, relZ], [xPos + strutOff, 74, relZ], 1.5, 1.5, pal.metalLight, 1, 6, false, false, false);
      r.addChamferBox(xPos, 18, relZ, mWidth, 3.4, 12, pal.metalLight, 1, null, false, false);
      r.addChamferBox(xPos, 74, relZ, mWidth, 3.4, 12, pal.metalLight, 1, null, false, false);

      // Dilated diagonal zig-zag light-clock path + time-dilated bouncing photon sphere
      var diagW = clamp(beta * 24, 0, 23);
      if (diagW >= 1.8) {
        r.addStraightTube3D(
          [
            [xPos - diagW, 20, relZ],
            [xPos - diagW * 0.5, 72, relZ],
            [xPos, 20, relZ],
            [xPos + diagW * 0.5, 72, relZ],
            [xPos + diagW, 20, relZ],
          ],
          pal.gold,
          2.0,
          false,
          false
        );
      } else {
        r.addStraightTube3D([[xPos, 20, relZ], [xPos, 72, relZ]], pal.gold, 2.0, false, false);
      }
      if (diagW >= 1.8) {
        var uRel = triWave((time * 0.35) / gamma);
        var xRel = xPos - diagW + 2 * diagW * uRel;
        var segPos = uRel * 4;
        var segIdx = Math.min(3, Math.floor(segPos));
        var segU = segPos - segIdx;
        var yRelDiag = segIdx % 2 === 0 ? 20 + 52 * segU : 72 - 52 * segU;
        r.addSphere([xRel, yRelDiag, relZ], 4.2, pal.gold, 1, false);
      } else {
        var yRel = 20 + 52 * triWave((time * 1.4) / gamma);
        r.addSphere([xPos, yRel, relZ], 4.2, pal.gold, 1, false);
      }

      // Front 3D relativistic Lorentz factor (gamma) dial gauge centered cleanly between tracks
      r.addChamferBox(-8, 9.8, 32, 28, 11, 10, pal.graphite, 1, null, false, false);
      r.addGauge3D([-8, 15.2, 37.5], 9.0, clamp((gamma - 1) / 4, 0.03, 0.98), pal.violet, [0, 0.28, 0.96]);
      return;
    }

    // Mode "photoelectric": Blown quartz vacuum tube, stepped collar rings, grounded UV emitter & microammeter
    var W0 = clamp(st.W0 !== undefined ? st.W0 : 2.2, 0.8, 6.0);
    var freq = clamp(st.f !== undefined ? st.f : st.freq !== undefined ? st.freq : 10, 2, 20);
    var Ek = st.Ek !== undefined ? st.Ek : Math.max(0, 0.4136 * freq - W0);
    var isHidden = !!st.isGame && !st.revealed;
    var firing = !!(pulse && pulse.active && performance.now() - pulse.started < 1200);

    // Base bench w/ rubber dome feet & insulated ceramic saddle mounts gripping collar rings cleanly
    var pFxs = [-78, 78];
    var pFzs = [-28, 28];
    for (var fi = 0; fi < 2; fi++) {
      for (var fj = 0; fj < 2; fj++) {
        r.addSphere([pFxs[fi], 2.2, pFzs[fj]], 3.0, pal.metalDark, 1, true);
      }
    }
    r.addChamferBox(0, 5.8, 0, 182, 5.0, 74, pal.metalDark, 1, null, true, true);
    r.addChamferBox(-52, 13.8, 0, 14, 11.4, 34, pal.ivory, 1, null, false, false);
    r.addChamferBox(58, 13.8, 0, 14, 11.4, 34, pal.ivory, 1, null, false, false);

    // Evacuated blown quartz vacuum phototube cylinder + slimmer stepped brass/anodized collar rings
    r.addCylinder([-52, 47, 0], [58, 47, 0], 27, 27, pal.glass, 0.17, 32, true, false, false);
    r.addCylinder([-54, 47, 0], [-50, 47, 0], 28.4, 28.4, pal.brass, 1, 32, false, false, false);
    r.addCylinder([-53, 47, 0], [-51, 47, 0], 29.8, 29.8, pal.graphite, 1, 32, false, false, false);
    r.addCylinder([56, 47, 0], [60, 47, 0], 28.4, 28.4, pal.brass, 1, 32, false, false, false);
    r.addCylinder([57, 47, 0], [59, 47, 0], 29.8, 29.8, pal.graphite, 1, 32, false, false, false);
    r.addCylinder([-51, 60.3, 0], [-60, 67.6, 0], 6.4, 7.6, pal.glass, 0.34, 16, false, false, false);

    // Curved metallic photo-emissive cathode plate + fine collector anode rod & ring
    var cathPts = [
      [-31, 33, -12],
      [-37, 40, -12],
      [-37, 54, -12],
      [-31, 61, -12],
    ];
    for (var ci = 0; ci < 3; ci++) {
      var a = cathPts[ci];
      var b = cathPts[ci + 1];
      r.addPoly([a, b, [b[0], b[1], 12], [a[0], a[1], 12]], pal.graphite, 0.96, pal.metalLight, true, false);
    }
    r.addCylinder([40, 27, 0], [40, 66, 0], 1.8, 1.8, pal.gold, 1, 6, false, false, false);
    r.addRing([40, 47, 0], 9.2, pal.gold, 2.0, false);

    // Outer bias circuit loop w/ brass power module & 3D analog microammeter
    r.addChamferBox(-20, 13.5, 22, 26, 10, 14, pal.brass, 1, null, false, false);
    r.addChamferBox(24, 16.5, 21, 26, 15, 10, pal.graphite, 1, null, false, false);
    var ampFrac = (!isHidden || firing) && Ek > 0 ? clamp(0.14 + Ek / 4.2, 0.14, 0.96) : 0.03;
    r.addGauge3D([24, 21.5, 26.5], 10.2, ampFrac, pal.cyan, [0, 0.22, 0.98]);
    r.addStraightTube3D([[-53, 47, 0], [-53, 15, 22], [-33, 15, 22]], pal.bronze, 2.0, false, false);
    r.addStraightTube3D([[-7, 15, 22], [11, 15, 22]], pal.bronze, 2.0, false, false);
    r.addStraightTube3D([[37, 15, 22], [59, 15, 22], [59, 47, 0]], pal.bronze, 2.0, false, false);

    // Grounded UV photon emitter on articulated rear-left support pillar + flush collimator nozzle
    var photCol = freq >= 10.5 ? pal.violet : freq >= 8.0 ? pal.cobalt : freq >= 6.0 ? pal.emerald : pal.gold;
    r.addBox(-78, 10.5, -20, 16, 4.4, 16, pal.titanium, 1, null, false, false);
    r.addCylinder([-78, 12.7, -20], [-78, 79, -20], 2.5, 2.2, pal.metalLight, 1, 6, false, false, false);
    r.addSphere([-78, 80, -20], 3.8, pal.brass, 1, false);
    r.addCylinder([-78, 80, -20], [-75, 80, 0], 2.2, 2.2, pal.metalDark, 1, 5, false, false, false);
    r.addSphere([-75, 80, 0], 3.6, pal.brass, 1, false);
    r.addCylinder([-80, 84, 0], [-68, 74.2, 0], 5.6, 5.4, pal.graphite, 1, 10, true, false, false);
    r.addCylinder([-68, 74.2, 0], [-62.5, 69.7, 0], 4.2, 3.0, pal.brass, 1, 8, true, false, false);
    if (!isHidden || firing) {
      var p1 = (time * 0.9) % 1;
      var p2 = (time * 0.9 + 0.5) % 1;
      var beamStart = [-62.5, 69.7, 0];
      var beamEnd = [-35, 47, 0];
      var bVec = sub3(beamEnd, beamStart);
      var wStart1 = add3(beamStart, mul3(bVec, clamp(p1 * 0.72, 0, 0.72)));
      var wEnd1 = add3(beamStart, mul3(bVec, clamp(p1 * 0.72 + 0.26, 0.26, 0.98)));
      var wStart2 = add3(beamStart, mul3(bVec, clamp(p2 * 0.72, 0, 0.72)));
      var wEnd2 = add3(beamStart, mul3(bVec, clamp(p2 * 0.72 + 0.26, 0.26, 0.98)));
      r.addSpring3D(wStart1, wEnd1, 3.2, 3, 1.3, photCol);
      r.addSpring3D(wStart2, wEnd2, 3.2, 3, 1.3, photCol);
    }

    // Ejected glowing cyan photoelectron spheres w/ faint motion trails when Ek > 0
    if (!isHidden || firing) {
      if (Ek > 0) {
        var eSpd = clamp(0.55 + Ek * 0.5, 0.55, 2.4);
        for (var k = 0; k < 6; k++) {
          var ef = (time * eSpd + k * 0.166) % 1;
          var ex = -32 + 68 * ef;
          var ey = 37 + (k % 3) * 10;
          var ez = ((k % 2) * 2 - 1) * 6;
          var tx0 = Math.max(-32, ex - 10);
          r.addLine([tx0, ey, ez], [ex, ey, ez], mixHex(pal.cyan, "#ffffff", 0.35, 0.45), 1.6, false, -0.5);
          r.addSphere([ex, ey, ez], 3.8, pal.cyan, 1, false);
        }
      } else {
        r.addRing([-32, 48, 0], 8.5, pal.danger, 1.8, false);
      }
    }
  };

  // ------------------------------------------------------------------ Viewport & Overlay Toolbar 3D
  function attach(container, svgEl, opts) {
    opts = opts || {};
    var kind = opts.kind || "projectile";
    if (!container || !svgEl || !svgEl.parentNode) return null;

    var DEFAULT_YAW = 0.44;
    var DEFAULT_PITCH = 0.20;
    var DEFAULT_ZOOM = 1.22;

    var stage = h("div", { class: "lp3d-stage" });
    var is3D = true;
    var cam = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: DEFAULT_ZOOM, targetY: 36 };
    var pulseState = { active: false, started: 0 };

    var mode3Btn = h("button", { type: "button", class: "lp3d-btn active", text: "🌐 โมเดล 3D" });
    var mode2Btn = h("button", { type: "button", class: "lp3d-btn", text: "📐 แผนผัง 2D" });
    var freeBtn = h("button", { type: "button", class: "lp3d-btn", text: "📷 มุมอิสระ" });
    var frontBtn = h("button", { type: "button", class: "lp3d-btn", text: "ด้านหน้า" });
    var topBtn = h("button", { type: "button", class: "lp3d-btn", text: "ด้านบน" });
    var zoomInBtn = h("button", { type: "button", class: "lp3d-btn", text: "➕", title: "ซูมเข้า" });
    var zoomOutBtn = h("button", { type: "button", class: "lp3d-btn", text: "➖", title: "ซูมออก" });
    var resetBtn = h("button", { type: "button", class: "lp3d-btn", text: "🔄 รีเซ็ต" });
    var fsBtn = h("button", { type: "button", class: "lp3d-btn lp3d-fs-btn", text: "⛶ เต็มจอ" });

    var camGroup = h("div", { class: "lp3d-group lp3d-cam-group" }, [freeBtn, frontBtn, topBtn, zoomInBtn, zoomOutBtn, resetBtn]);
    var toolbar = h("div", { class: "lp3d-toolbar" }, [
      h("div", { class: "lp3d-group" }, [mode3Btn, mode2Btn]),
      camGroup,
      h("div", { class: "lp3d-group" }, [fsBtn]),
    ]);

    var canvas = h("canvas", {
      class: "lp3d-canvas",
      role: "img",
      "aria-label": "โมเดลฟิสิกส์ 3 มิติ ลากเพื่อหมุนมุมมองได้รอบทิศ",
    });
    canvas.style.touchAction = "none";

    var hint = h("div", {
      class: "lp3d-hint",
      text: "👆 ลาก 1 นิ้วหมุน 360° • จีบ 2 นิ้วซูม",
    });
    var canvasWrap = h("div", { class: "lp3d-canvas-wrap" }, [toolbar, canvas, hint]);

    var parent = svgEl.parentNode;
    parent.insertBefore(stage, svgEl);
    stage.appendChild(canvasWrap);
    stage.appendChild(svgEl);
    svgEl.classList.add("lp3d-svg-fallback");
    svgEl.style.display = "none";
    svgEl.setAttribute("hidden", "");

    var renderer = new SceneRenderer(canvas, cam);
    var rafId = null;

    function fadeHint() {
      if (!hint.classList.contains("is-faded")) {
        hint.classList.add("is-faded");
      }
    }

    function syncModeUI() {
      mode3Btn.classList.toggle("active", is3D);
      mode2Btn.classList.toggle("active", !is3D);
      camGroup.style.display = is3D ? "" : "none";
      toolbar.scrollLeft = 0;
      if (is3D) {
        if (toolbar.parentNode !== canvasWrap) {
          canvasWrap.insertBefore(toolbar, canvas);
        }
        toolbar.classList.remove("lp3d-toolbar-2d");
        canvasWrap.hidden = false;
        canvasWrap.style.display = "";
        svgEl.style.display = "none";
        svgEl.setAttribute("hidden", "");
        renderNow();
      } else {
        if (toolbar.parentNode !== stage) {
          stage.insertBefore(toolbar, svgEl);
        }
        toolbar.classList.add("lp3d-toolbar-2d");
        canvasWrap.hidden = true;
        canvasWrap.style.display = "none";
        svgEl.style.display = "";
        svgEl.removeAttribute("hidden");
      }
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
      cam.yaw = DEFAULT_YAW;
      cam.pitch = DEFAULT_PITCH;
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
      cam.zoom = clamp(cam.zoom + 0.18, 0.55, 2.6);
      renderNow();
    });
    zoomOutBtn.addEventListener("click", function () {
      cam.zoom = clamp(cam.zoom - 0.18, 0.55, 2.6);
      renderNow();
    });
    resetBtn.addEventListener("click", function () {
      cam.yaw = DEFAULT_YAW;
      cam.pitch = DEFAULT_PITCH;
      cam.zoom = DEFAULT_ZOOM;
      renderNow();
    });

    function toggleFullscreen() {
      var full = stage.classList.toggle("lp3d-fullscreen");
      fsBtn.textContent = full ? "✕ ย่อจอ" : "⛶ เต็มจอ";
      fsBtn.classList.toggle("active", full);
      renderNow();
    }
    fsBtn.addEventListener("click", toggleFullscreen);

    function onKeyDown(e) {
      if (e.key === "Escape" && stage.classList.contains("lp3d-fullscreen")) {
        toggleFullscreen();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    // ลาก 1 นิ้ว / เมาส์เพื่อหมุนกล้อง 360° + จีบ 2 นิ้วซูม (Pinch-to-Zoom) + ล้อเมาส์ซูม
    var dragging = false;
    var pinching = false;
    var pinchStartDist = 0;
    var pinchStartZoom = DEFAULT_ZOOM;
    var lastX = 0;
    var lastY = 0;

    function touchDist(t1, t2) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    canvas.addEventListener("pointerdown", function (e) {
      fadeHint();
      if (pinching) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!dragging || pinching) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cam.yaw += dx * 0.01;
      cam.pitch = clamp(cam.pitch + dy * 0.008, 0.05, 1.45);
      renderNow();
    });

    function stopDrag() {
      dragging = false;
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    canvas.addEventListener(
      "touchstart",
      function (e) {
        fadeHint();
        if (e.touches && e.touches.length === 2) {
          pinching = true;
          dragging = false;
          pinchStartDist = Math.max(10, touchDist(e.touches[0], e.touches[1]));
          pinchStartZoom = cam.zoom;
          e.preventDefault();
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches && e.touches.length === 2) {
          if (!pinching) {
            pinching = true;
            dragging = false;
            pinchStartDist = Math.max(10, touchDist(e.touches[0], e.touches[1]));
            pinchStartZoom = cam.zoom;
          }
          e.preventDefault();
          var curDist = touchDist(e.touches[0], e.touches[1]);
          var ratio = curDist / Math.max(10, pinchStartDist);
          cam.zoom = clamp(pinchStartZoom * ratio, 0.55, 2.6);
          renderNow();
        }
      },
      { passive: false }
    );

    function onTouchEndOrCancel(e) {
      if (!e.touches || e.touches.length < 2) {
        pinching = false;
        if (e.touches && e.touches.length === 1) {
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;
        } else {
          dragging = false;
        }
      }
    }
    canvas.addEventListener("touchend", onTouchEndOrCancel);
    canvas.addEventListener("touchcancel", onTouchEndOrCancel);

    canvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        cam.zoom = clamp(cam.zoom + (e.deltaY < 0 ? 0.1 : -0.1), 0.55, 2.6);
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

    function onResizeOrWake() {
      if (is3D && document.contains(stage)) {
        renderNow();
      }
    }

    var resizeObs = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(function () {
        onResizeOrWake();
      });
      resizeObs.observe(canvasWrap);
    }
    window.addEventListener("resize", onResizeOrWake);
    document.addEventListener("visibilitychange", onResizeOrWake);
    document.addEventListener("lp:tab-changed", onResizeOrWake);

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
        if (resizeObs) resizeObs.disconnect();
        window.removeEventListener("resize", onResizeOrWake);
        document.removeEventListener("visibilitychange", onResizeOrWake);
        document.removeEventListener("lp:tab-changed", onResizeOrWake);
        document.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("pointerup", stopDrag);
        window.removeEventListener("pointercancel", stopDrag);
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
