// ระบบจำลองฟิสิกส์ 3 มิติ (LearnPhysics v5.0.0 Studio PBR 3D Renderer & Camera Controller)
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

  function mixHex(hexA, hexB, t, alpha) {
    var a = parseHexColor(hexA);
    var b = parseHexColor(hexB);
    var f = clamp(t, 0, 1);
    var r = Math.round(a[0] + (b[0] - a[0]) * f);
    var g = Math.round(a[1] + (b[1] - a[1]) * f);
    var bl = Math.round(a[2] + (b[2] - a[2]) * f);
    if (alpha !== undefined && alpha < 0.999) {
      return "rgba(" + r + "," + g + "," + bl + "," + clamp(alpha, 0, 1).toFixed(3) + ")";
    }
    return "rgb(" + r + "," + g + "," + bl + ")";
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
        skyTop: "#070c19",
        skyMid: "#0f1b33",
        skyHor: "#1a2b4c",
        floorNear: "#131f37",
        floorMid: "#1a2a49",
        floorFar: "#24395f",
        floorEdge: "rgba(155, 192, 255, 0.28)",
        floorGrid: "rgba(148, 184, 248, 0.14)",
        floorAxis: "rgba(186, 214, 255, 0.28)",
        metal: "#64748b",
        metalLight: "#94a3b8",
        metalDark: "#242f42",
        graphite: "#334155",
        accent: "#3b82f6",
        cobalt: "#3b82f6",
        orange: "#fb923c",
        gold: "#fbbf24",
        ivory: "#e7dfd0",
        danger: "#fb7185",
        emerald: "#34d399",
        cyan: "#22d3ee",
        glass: "#93c5fd",
        violet: "#a78bfa",
        shadowRgb: "4, 8, 18",
      };
    }
    return {
      isDark: false,
      skyTop: "#7ab3ff",
      skyMid: "#bddaff",
      skyHor: "#f4f8ff",
      floorNear: "#cddbf0",
      floorMid: "#e3ecf9",
      floorFar: "#f8fbff",
      floorEdge: "rgba(255, 255, 255, 0.94)",
      floorGrid: "rgba(74, 104, 158, 0.15)",
      floorAxis: "rgba(54, 82, 136, 0.28)",
      metal: "#4d5b70",
      metalLight: "#8b9bb0",
      metalDark: "#202733",
      graphite: "#2d3646",
      accent: "#2563eb",
      cobalt: "#1d63f2",
      orange: "#f97316",
      gold: "#f59e0b",
      ivory: "#f0e7d8",
      danger: "#e11d48",
      emerald: "#059669",
      cyan: "#0891b2",
      glass: "#60a5fa",
      violet: "#7c3aed",
      shadowRgb: "18, 32, 58",
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

  function clipPolyCam(pts, nearZ) {
    var out = [];
    if (!pts || !pts.length) return out;
    var prev = pts[pts.length - 1];
    var prevIn = prev[2] >= nearZ;
    for (var i = 0; i < pts.length; i++) {
      var cur = pts[i];
      var curIn = cur[2] >= nearZ;
      if (curIn !== prevIn) {
        var denom = cur[2] - prev[2];
        var t = Math.abs(denom) > 1e-6 ? (nearZ - prev[2]) / denom : 0.5;
        out.push([
          prev[0] + (cur[0] - prev[0]) * t,
          prev[1] + (cur[1] - prev[1]) * t,
          nearZ,
        ]);
      }
      if (curIn) out.push(cur);
      prev = cur;
      prevIn = curIn;
    }
    return out;
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

  // ------------------------------------------------------------------ ตัวเรนเดอร์ Studio PBR 3D
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
    this.floorStep = 40;
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
    sky.addColorStop(0.42, pal.skyMid);
    sky.addColorStop(0.76, pal.skyHor);
    sky.addColorStop(1, pal.skyHor);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);

    this.queue = [];
    this.floorQueue = [];
    this.shadowQueue = [];
    this.hasFloor = false;
    this.floorStep = 42;

    this.cosY = Math.cos(this.cam.yaw);
    this.sinY = Math.sin(this.cam.yaw);
    this.cosP = Math.cos(this.cam.pitch);
    this.sinP = Math.sin(this.cam.pitch);
    this.camDist = 560 / clamp(this.cam.zoom, 0.55, 2.6);
    this.fov = Math.min(cssW, cssH) * 1.44;
    var ty = this.cam.targetY !== undefined ? this.cam.targetY : 32;
    this.camPos = [
      this.camDist * this.cosP * this.sinY,
      ty + this.camDist * this.sinP,
      this.camDist * this.cosP * this.cosY,
    ];
  };

  SceneRenderer.prototype.toCam = function (p) {
    var ty = this.cam.targetY !== undefined ? this.cam.targetY : 32;
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
      y: this.h * 0.56 - c[1] * s,
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
    var R = 460;
    var N = 64;
    var discCam = [];
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2;
      discCam.push(this.toCam([R * Math.cos(a), 0, R * Math.sin(a)]));
    }
    var clipped = clipPolyCam(discCam, 28);
    if (clipped.length < 3) return;

    var poly = [];
    var minY = this.h;
    var maxY = 0;
    for (var i = 0; i < clipped.length; i++) {
      var pr = this.projCam(clipped[i]);
      if (!pr) continue;
      poly.push(pr);
      if (pr.y < minY) minY = pr.y;
      if (pr.y > maxY) maxY = pr.y;
    }
    if (poly.length < 3) return;

    var gTop = clamp(minY, 0, this.h);
    var gBot = clamp(Math.max(maxY, gTop + 40), 0, this.h);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (var j = 1; j < poly.length; j++) ctx.lineTo(poly[j].x, poly[j].y);
    ctx.closePath();

    var flGrad = ctx.createLinearGradient(0, gTop, 0, gBot);
    flGrad.addColorStop(0, pal.floorFar);
    flGrad.addColorStop(0.28, pal.floorMid);
    flGrad.addColorStop(1, pal.floorNear);
    ctx.fillStyle = flGrad;
    ctx.fill();

    ctx.clip();

    // Subtle glossy studio bounce sheen under center stage
    var cen = this.proj([0, 0, 0]);
    if (cen) {
      var sheenR = Math.max(120, cen.s * 165);
      var sh = ctx.createRadialGradient(cen.x, cen.y, 10, cen.x, cen.y, sheenR);
      sh.addColorStop(0, pal.isDark ? "rgba(96, 165, 250, 0.08)" : "rgba(255, 255, 255, 0.55)");
      sh.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // Crisp perspective tile lines fading toward horizon
    var st = this.floorStep || 42;
    var span = st * 8;
    var self = this;
    var lineGrad = ctx.createLinearGradient(0, gTop, 0, Math.max(gTop + 60, gBot));
    lineGrad.addColorStop(0, "rgba(120, 150, 200, 0)");
    lineGrad.addColorStop(0.22, pal.floorGrid);
    lineGrad.addColorStop(1, pal.floorGrid);

    function drawTileLine(a3, b3, isAxis) {
      var seg = clipSegCam(self.toCam(a3), self.toCam(b3), 28);
      if (!seg) return;
      var pa = self.projCam(seg[0]);
      var pb = self.projCam(seg[1]);
      if (!pa || !pb) return;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = isAxis ? pal.floorAxis : lineGrad;
      ctx.lineWidth = isAxis ? 1.25 : 0.9;
      ctx.stroke();
    }

    for (var x = -span; x <= span; x += st) {
      drawTileLine([x, 0, -span], [x, 0, span], x === 0);
    }
    for (var z = -span; z <= span; z += st) {
      drawTileLine([-span, 0, z], [span, 0, z], z === 0);
    }

    // Floor reflections (sorted far-to-near)
    this.floorQueue.sort(function (a, b) {
      return b.z - a.z;
    });
    for (var fi = 0; fi < this.floorQueue.length; fi++) {
      this.floorQueue[fi].draw(ctx);
    }

    // Soft multi-stop Gaussian contact shadows
    for (var si = 0; si < this.shadowQueue.length; si++) {
      this.shadowQueue[si].draw(ctx);
    }

    ctx.restore();

    // Subtle crisp horizon rim highlight along the curved floor boundary
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (var k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
    ctx.closePath();
    ctx.strokeStyle = pal.floorEdge;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  };

  SceneRenderer.prototype.addFloorGrid = function (halfW, halfD, step) {
    this.hasFloor = true;
    this.floorStep = step && step >= 34 ? step : 42;
  };

  SceneRenderer.prototype.addContactShadow = function (x, z, rx, rz, strength) {
    var pr = this.proj([x, 0.15, z]);
    if (!pr) return;
    var aspect = clamp(0.28 + 0.66 * this.sinP, 0.28, 0.94);
    var pxRx = Math.max(3, rx * pr.s);
    var pxRz = Math.max(2, (rz || rx) * pr.s * aspect);
    var st = clamp(strength !== undefined ? strength : 0.30, 0.04, 0.55);
    var rgb = this.pal.shadowRgb;
    this.shadowQueue.push({
      z: pr.z,
      draw: function (ctx) {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.scale(1, pxRz / pxRx);
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, pxRx);
        g.addColorStop(0, "rgba(" + rgb + "," + st.toFixed(3) + ")");
        g.addColorStop(0.42, "rgba(" + rgb + "," + (st * 0.55).toFixed(3) + ")");
        g.addColorStop(0.75, "rgba(" + rgb + "," + (st * 0.16).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.beginPath();
        ctx.arc(0, 0, pxRx, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addPoly = function (pts3, color, alpha, strokeColor, forceTwoSided, reflectFloor) {
    var cps = [];
    var sps = [];
    var sumZ = 0;
    var cx = 0;
    var cy = 0;
    var cz = 0;
    for (var i = 0; i < pts3.length; i++) {
      var pr = this.proj(pts3[i]);
      if (!pr) return;
      cps.push(pr.cam);
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

    var wn = norm3(cross3(sub3(pts3[1], pts3[0]), sub3(pts3[2], pts3[0])));
    var viewDir = norm3(sub3(this.camPos, [cx, cy, cz]));
    if (dot3(wn, viewDir) < 0) {
      wn = [-wn[0], -wn[1], -wn[2]];
    }
    var ndotl = clamp(dot3(wn, this.lightDir), 0, 1);
    var hemi = 0.44 + 0.14 * clamp(wn[1], -1, 1);
    var halfV = norm3([
      this.lightDir[0] + viewDir[0],
      this.lightDir[1] + viewDir[1],
      this.lightDir[2] + viewDir[2],
    ]);
    var spec = Math.pow(clamp(dot3(wn, halfV), 0, 1), 24) * 0.22;
    var shade = hemi + 0.56 * ndotl;
    var fill = shadeColor(color, shade, alpha, spec);
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
        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      },
    });

    if (reflectFloor && cy > 0 && cy < 78) {
      var refSps = [];
      var refZ = 0;
      for (var k = 0; k < nPts; k++) {
        var rp = this.proj([pts3[k][0], -Math.max(0, pts3[k][1]) * 0.72, pts3[k][2]]);
        if (!rp) return;
        refSps.push(rp);
        refZ += rp.z;
      }
      var refAlpha = clamp((alpha !== undefined ? alpha : 1) * 0.13 * (1 - cy / 85), 0.02, 0.16);
      var refFill = shadeColor(color, shade * 0.9, refAlpha, 0);
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

  SceneRenderer.prototype.addGlowCurve = function (pts, color, width, dashed, reflectFloor) {
    var baseW = width || 3.4;
    var glowCol = mixHex(color, "#ffffff", 0.15, 0.22);
    var tubeCol = color;
    var coreCol = mixHex(color, "#ffffff", 0.68, 0.95);
    var refCol = mixHex(color, "#ffffff", 0.1, 0.15);

    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i];
      var b = pts[i + 1];
      var seg = clipSegCam(this.toCam(a), this.toCam(b), 28);
      if (!seg) continue;
      var pa = this.projCam(seg[0]);
      var pb = this.projCam(seg[1]);
      if (!pa || !pb) continue;
      var z = (pa.z + pb.z) * 0.5 - 2;
      (function (p1, p2, zVal, idx) {
        this.queue.push({
          z: zVal,
          draw: function (ctx) {
            ctx.save();
            ctx.lineCap = "round";
            if (dashed) {
              if (idx % 2 === 1) {
                ctx.restore();
                return;
              }
            }
            // Pass 1: Soft outer bloom
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = glowCol;
            ctx.lineWidth = baseW * 2.7;
            ctx.stroke();

            // Pass 2: Saturated glowing body
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = tubeCol;
            ctx.lineWidth = baseW * 1.18;
            ctx.stroke();

            // Pass 3: Crisp bright specular core
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = coreCol;
            ctx.lineWidth = Math.max(1.1, baseW * 0.42);
            ctx.stroke();
            ctx.restore();
          },
        });
      }).call(this, pa, pb, z, i);

      if (reflectFloor !== false && (a[1] < 95 || b[1] < 95)) {
        var rSeg = clipSegCam(
          this.toCam([a[0], -a[1] * 0.72, a[2]]),
          this.toCam([b[0], -b[1] * 0.72, b[2]]),
          28
        );
        if (rSeg) {
          var ra = this.projCam(rSeg[0]);
          var rb = this.projCam(rSeg[1]);
          if (ra && rb) {
            (function (p1, p2, idx) {
              this.floorQueue.push({
                z: (p1.z + p2.z) * 0.5,
                draw: function (ctx) {
                  if (dashed && idx % 2 === 1) return;
                  ctx.save();
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.strokeStyle = refCol;
                  ctx.lineWidth = baseW * 1.3;
                  ctx.lineCap = "round";
                  ctx.stroke();
                  ctx.restore();
                },
              });
            }).call(this, ra, rb, i);
          }
        }
      }
    }
  };

  SceneRenderer.prototype.addBox = function (cx, cy, cz, sx, sy, sz, color, alpha, stroke, reflect) {
    var hx = sx * 0.5;
    var hy = sy * 0.5;
    var hz = sz * 0.5;
    var p = [
      [cx - hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy + hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
      [cx - hx, cy - hy, cz + hz],
      [cx + hx, cy - hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
      [cx - hx, cy + hy, cz + hz],
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
    if (reflect && cy - hy <= 12) {
      this.addContactShadow(cx, cz, sx * 0.62, sz * 0.62, 0.25);
    }
  };

  SceneRenderer.prototype.addBevelBox = function (cx, cy, cz, sx, sy, sz, color, alpha, stroke, reflect) {
    var trimH = Math.min(2.6, sy * 0.24);
    this.addBox(cx, cy, cz, sx, sy, sz, color, alpha, stroke, reflect);
    if (sx > 6 && sz > 6 && sy > 4) {
      this.addBox(
        cx,
        cy + sy * 0.5 + trimH * 0.35,
        cz,
        sx - 3.2,
        trimH,
        sz - 3.2,
        mixHex(color, "#ffffff", 0.22),
        alpha,
        null,
        false
      );
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
      this.addPoly([p[f[0]], p[f[1]], p[f[2]], p[f[3]]], color, alpha, stroke, true, true);
    }
  };

  SceneRenderer.prototype.addCylinder = function (a, b, r1, r2, color, alpha, segs, withCaps, reflect) {
    var dir = sub3(b, a);
    var len = Math.hypot(dir[0], dir[1], dir[2]);
    if (len < 0.1) return;
    var axis = [dir[0] / len, dir[1] / len, dir[2] / len];
    var up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm3(cross3(up, axis));
    var v = norm3(cross3(axis, u));
    var N = segs || 14;
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
      this.addPoly([ringA[i], ringA[j], ringB[j], ringB[i]], color, alpha, null, true, reflect && i % 2 === 0);
    }
    if (withCaps !== false && r1 > 0.2) this.addPoly(ringA, color, alpha, null, true, false);
    if (withCaps !== false && r2 > 0.2) this.addPoly(ringB, color, alpha, null, true, false);
  };

  SceneRenderer.prototype.addSphere = function (pos, radius, color, alpha, shadow) {
    var pr = this.proj(pos);
    if (!pr) return;
    var pxR = Math.max(2.2, radius * pr.s);
    var al = alpha !== undefined ? alpha : 1;

    if (shadow !== false) {
      var alt = Math.max(0, pos[1] - radius);
      var shRad = radius * clamp(1.18 - alt / 260, 0.42, 1.25);
      var shAlpha = clamp(0.32 - alt / 320, 0.07, 0.32) * al;
      this.addContactShadow(pos[0], pos[2], shRad, shRad, shAlpha);
    }

    // Inverted glossy floor reflection for spheres near the floor
    if (pos[1] >= 0 && pos[1] < 95) {
      var refPos = [pos[0], -pos[1] * 0.78, pos[2]];
      var rp = this.proj(refPos);
      if (rp) {
        var rPx = Math.max(2, radius * rp.s);
        var refAl = clamp((1 - pos[1] / 95) * 0.20 * al, 0.02, 0.22);
        var refColA = mixHex(color, "#ffffff", 0.25, refAl);
        var refColB = shadeColor(color, 0.7, refAl * 0.55);
        this.floorQueue.push({
          z: rp.z,
          draw: function (ctx) {
            ctx.save();
            var g = ctx.createRadialGradient(rp.x, rp.y - rPx * 0.15, rPx * 0.1, rp.x, rp.y, rPx);
            g.addColorStop(0, refColA);
            g.addColorStop(0.75, refColB);
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

    this.queue.push({
      z: pr.z,
      draw: function (ctx) {
        ctx.save();
        // Smooth 3+ stop PBR radial shader: clearcoat highlight + lit albedo + deep core + floor bounce rim
        var gx = pr.x - pxR * 0.34;
        var gy = pr.y - pxR * 0.34;
        var grad = ctx.createRadialGradient(gx, gy, pxR * 0.06, pr.x, pr.y, pxR);
        grad.addColorStop(0, mixHex(color, "#ffffff", 0.78, al));
        grad.addColorStop(0.24, shadeColor(color, 1.18, al));
        grad.addColorStop(0.62, shadeColor(color, 0.92, al));
        grad.addColorStop(0.90, shadeColor(color, 0.45, al));
        grad.addColorStop(1, shadeColor(color, 0.62, al));
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pxR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Crisp glossy clearcoat specular glint
        if (pxR >= 5.5) {
          var sx = pr.x - pxR * 0.36;
          var sy = pr.y - pxR * 0.36;
          var sr = pxR * 0.30;
          var specG = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          specG.addColorStop(0, "rgba(255,255,255," + (0.68 * al).toFixed(3) + ")");
          specG.addColorStop(1, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fillStyle = specG;
          ctx.fill();
        }
        ctx.restore();
      },
    });
  };

  SceneRenderer.prototype.addRing = function (pos, radius, color, lineW, onFloor) {
    var N = 28;
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

  SceneRenderer.prototype.addPillar = function (x, yTop, z, color) {
    if (yTop < 4) return;
    var segCount = Math.max(4, Math.min(14, Math.round(yTop / 7)));
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
              ctx.lineWidth = 5.5;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = colCore;
              ctx.lineWidth = 2.4;
              ctx.stroke();
              ctx.restore();
            },
          });
        }).call(this, pa, pb);
      }
      // Subtle pillar floor reflection
      if (y1 < 75) {
        var ra = this.proj([x, -y1 * 0.72, z]);
        var rb = this.proj([x, -y2 * 0.72, z]);
        if (ra && rb) {
          (function (p1, p2) {
            this.floorQueue.push({
              z: (p1.z + p2.z) * 0.5,
              draw: function (ctx) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = mixHex(color, "#ffffff", 0.1, 0.16);
                ctx.lineWidth = 2.4;
                ctx.lineCap = "round";
                ctx.stroke();
                ctx.restore();
              },
            });
          }).call(this, ra, rb);
        }
      }
    }
    this.addRing([x, 0.35, z], 9, color, 2.0, true);
    this.addRing([x, 0.35, z], 4, mixHex(color, "#ffffff", 0.45), 1.6, true);
  };

  SceneRenderer.prototype.addArrow = function (a, b, r, color) {
    var d = sub3(b, a);
    var len = Math.hypot(d[0], d[1], d[2]);
    if (len < 2) return;
    var rr = r || 2.5;
    var tipLen = Math.min(len * 0.36, rr * 3.8);
    var ratio = (len - tipLen) / len;
    var mid = [a[0] + d[0] * ratio, a[1] + d[1] * ratio, a[2] + d[2] * ratio];
    this.addCylinder(a, mid, rr, rr, color, 1, 10, false, false);
    this.addCylinder(mid, b, rr * 2.1, 0.15, color, 1, 10, true, false);
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
    this.addGlowCurve(pts, color, 2.4, false, false);
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

  SCENES.projectile = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var scale = 1.68;
    var ox = -112;

    // ฐานและลำกล้องปืนใหญ่โลหะสีกราไฟต์ + ขอบเงินเงา (อิงสไตล์ Studio PBR)
    var angleRad = clamp(((st.angle || 45) * Math.PI) / 180, 0.14, 1.44);
    var ca = Math.cos(angleRad);
    var sa = Math.sin(angleRad);
    var pivotY = 14;
    var barrelLen = 40;
    var muzzle = [ox + barrelLen * ca, pivotY + barrelLen * sa, 0];

    // แท่นฐาน 2 ชั้นแบบ bevel + ยาง/ขอบโลหะ
    r.addBevelBox(ox - 2, 3, 0, 42, 6, 32, pal.metalLight, 1, null, true);
    r.addBevelBox(ox - 4, 9, 0, 34, 8, 24, pal.metalDark, 1, null, false);
    r.addBox(ox + 2, 13, 11, 14, 10, 4, pal.graphite, 1, null, false);
    r.addBox(ox + 2, 13, -11, 14, 10, 4, pal.graphite, 1, null, false);
    // ลำกล้องปืนใหญ่ทรงกระบอก + วงแหวนปากกระบอก
    r.addCylinder([ox - 4 * ca, pivotY - 4 * sa, 0], muzzle, 9.5, 8.2, pal.graphite, 1, 16, true, true);
    r.addCylinder(
      [ox + (barrelLen - 4) * ca, pivotY + (barrelLen - 4) * sa, 0],
      [ox + (barrelLen + 1.5) * ca, pivotY + (barrelLen + 1.5) * sa, 0],
      9.0,
      8.8,
      pal.metalLight,
      1,
      16,
      true,
      false
    );
    r.addSphere([ox, pivotY, 0], 8.5, pal.metalDark, 1, false);

    // เป้าหมาย 3D ในโหมดเกม (รองรับทั้ง targetDist และ targetXt จาก engines.js)
    var targetDist = st.targetDist > 0 ? st.targetDist : st.targetXt > 0 ? st.targetXt : 0;
    if (targetDist > 0) {
      var tx = ox + targetDist * scale;
      var tolPx = clamp((st.tolerance || st.targetTol || 4) * scale, 9, 28);
      r.addBevelBox(tx, 2, 0, tolPx * 2, 4, 28, pal.gold, 0.92, null, true);
      r.addRing([tx, 4.6, 0], tolPx, pal.danger, 2.5, false);
      r.addRing([tx, 0.4, 0], tolPx * 1.25, pal.orange, 1.8, true);
      r.addCylinder([tx, 4, 14], [tx, 54, 14], 1.8, 1.5, pal.metalDark, 1, 10, true, true);
      r.addPoly([[tx, 53, 14], [tx + 22, 45, 14], [tx, 37, 14]], pal.danger, 1, null, true, false);
    }

    var T = st.T || 3.6;
    var vx = st.vx || 18;
    var vy = st.vy || 18;
    var G = 9.8;
    var isHiddenGame = !!st.isGame && !st.revealed;
    var maxFrac = isHiddenGame ? 0.22 : st.animFrac !== undefined ? st.animFrac : 1;

    var pts = [];
    var segs = 40;
    for (var i = 0; i <= segs; i++) {
      var f = (i / segs) * maxFrac;
      var t = f * T;
      var px = muzzle[0] + vx * t * scale;
      var py = Math.max(6.5, muzzle[1] + (vy * t - 0.5 * G * t * t) * scale);
      if (t > T * 0.85 && !isHiddenGame) {
        var landMix = (t - T * 0.85) / (T * 0.15);
        py = py * (1 - landMix) + 8.5 * landMix;
      }
      pts.push([px, py, 0]);
    }
    r.addGlowCurve(pts, pal.cobalt, isHiddenGame ? 2.6 : 3.8, isHiddenGame, true);

    // ลูกแก้วสีน้ำเงินโคบอลต์ที่ปากกระบอก (หรือกำลังลอยกลางอากาศ)
    var ballT = st.ballT !== undefined ? st.ballT : 0;
    if (isHiddenGame) {
      r.addSphere(muzzle, 8.2, pal.cobalt, 1, true);
    } else {
      // แสดง 3 ลูกแก้วหลักสไตล์ Studio (น้ำเงินที่ปากกระบอก + ส้มที่จุดสูงสุด + งาช้างที่จุดตก) + ลูกเคลื่อนไหวตาม ballT
      r.addSphere(muzzle, 8.0, pal.cobalt, 1, true);

      var apexX = muzzle[0] + vx * (T * 0.5) * scale;
      var apexY = muzzle[1] + (st.H > 0 ? st.H : (vy * vy) / (2 * G)) * scale;
      r.addPillar(apexX, apexY - 7, 0, pal.orange);
      r.addSphere([apexX, apexY, 0], 7.4, pal.orange, 1, false);

      var landX = muzzle[0] + (st.R > 0 ? st.R : vx * T) * scale;
      r.addSphere([landX, 8.5, 0], 8.2, pal.ivory, 1, true);

      if (ballT > 0.02 && ballT < T * 0.98) {
        var bx = muzzle[0] + vx * ballT * scale;
        var by = Math.max(8.5, muzzle[1] + (vy * ballT - 0.5 * G * ballT * ballT) * scale);
        r.addSphere([bx, by, 0], 7.2, pal.danger, 1, true);
      }
    }

    if (pulse && pulse.active) {
      var pAge = (performance.now() - pulse.started) / 1000;
      if (pAge < 0.85 && st.R > 0) {
        r.addRing([muzzle[0] + st.R * scale, 1.2, 0], 12 + pAge * 40, pal.emerald, 2.6, false);
      }
    }
  };

  SCENES["newton-force"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var F = st.F !== undefined ? st.F : 40;
    var m = st.m || 4;
    var mu = st.mu !== undefined ? st.mu : 0.2;
    var G = 9.8;
    var N = m * G;
    var maxFric = mu * N;
    var acc = st.acc !== undefined ? st.acc : F > maxFric ? (F - maxFric) / m : 0;

    // รางทดลองอะลูมิเนียมอโนไดซ์พร้อมขาตั้งและตัวกั้นปลายราง
    r.addBevelBox(0, 4, 0, 316, 7, 52, pal.metalDark, 1, null, true);
    r.addBox(0, 8.2, 18, 312, 2.2, 4, pal.metalLight, 1, null, false);
    r.addBox(0, 8.2, -18, 312, 2.2, 4, pal.metalLight, 1, null, false);
    r.addBox(-154, 13, 0, 8, 12, 52, pal.graphite, 1, null, false);
    r.addBox(154, 13, 0, 8, 12, 52, pal.graphite, 1, null, false);
    for (var tx = -120; tx <= 120; tx += 40) {
      r.addBox(tx, 7.8, 0, 1.5, 0.8, 30, pal.metalLight, 0.65, null, false);
    }

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

    var cx = -96 + animFrac * 176;
    var massSize = clamp(22 + m * 2.2, 24, 42);
    var chassisY = 17;

    // รถทดลองมีล้อ 4 ล้อ + โครงโลหะ + มวลบนรถ
    r.addSphere([cx - 17, 12.5, 18], 5.2, pal.metalDark, 1, false);
    r.addSphere([cx + 17, 12.5, 18], 5.2, pal.metalDark, 1, false);
    r.addSphere([cx - 17, 12.5, -18], 5.2, pal.metalDark, 1, false);
    r.addSphere([cx + 17, 12.5, -18], 5.2, pal.metalDark, 1, false);
    r.addCylinder([cx - 17, 12.5, -20], [cx - 17, 12.5, 20], 2.2, 2.2, pal.metalLight, 1, 10);
    r.addCylinder([cx + 17, 12.5, -20], [cx + 17, 12.5, 20], 2.2, 2.2, pal.metalLight, 1, 10);
    r.addBevelBox(cx, chassisY, 0, 52, 9, 34, pal.graphite, 1, null, false);

    var blockCol = st.isGame && !st.revealed ? pal.cobalt : pal.gold;
    var blockCy = chassisY + 5 + massSize * 0.5;
    r.addBevelBox(cx, blockCy, 0, massSize, massSize, massSize * 0.9, blockCol, 1, null, false);
    r.addCylinder([cx, blockCy + massSize * 0.5 + 1, 0], [cx, blockCy + massSize * 0.5 + 4, 0], 6, 5, pal.metalLight, 1, 12);

    // ลูกศรเวกเตอร์แรง 3 มิติ (แรงดึง F, แรงเสียดทาน f, แรงตั้งฉาก N)
    var fArrowLen = clamp(F * 0.72, 18, 76);
    if (F > 0) {
      r.addArrow([cx + 27, chassisY + 8, 0], [cx + 27 + fArrowLen, chassisY + 8, 0], 3.0, pal.emerald);
    }
    var frLen = clamp(Math.min(F, maxFric) * 0.72, 10, 60);
    if (frLen > 4 && mu > 0) {
      r.addArrow([cx - 27, 13, 0], [cx - 27 - frLen, 13, 0], 2.4, pal.danger);
    }
    r.addArrow([cx, blockCy + massSize * 0.5 + 5, 0], [cx, blockCy + massSize * 0.5 + 38, 0], 2.3, pal.cyan);
  };

  SCENES["linear-motion"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    // รางลมกลศาสตร์อะลูมิเนียมพร้อมประตูแสง Photogate 3 จุด
    r.addBevelBox(0, 4, 0, 324, 8, 46, pal.metal, 1, null, true);
    r.addBox(0, 9, 14, 320, 2, 3, pal.metalLight, 1, null, false);
    r.addBox(0, 9, -14, 320, 2, 3, pal.metalLight, 1, null, false);
    for (var mk = -120; mk <= 120; mk += 80) {
      r.addCylinder([mk, 8, -22], [mk, 38, -22], 2.2, 2.2, pal.metalDark, 1, 10);
      r.addCylinder([mk, 8, 22], [mk, 38, 22], 2.2, 2.2, pal.metalDark, 1, 10);
      r.addCylinder([mk, 38, -22], [mk, 38, 22], 2.2, 2.2, pal.cyan, 1, 10);
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
    var cx = clamp(-130 + (s / sMax) * 250, -134, 134);

    // เส้นทางเรืองแสงตามรอยรถ
    r.addGlowCurve([[-132, 11, 0], [cx, 11, 0]], pal.cyan, 2.6, false, false);

    // รถทดลองทรงแอโรไดนามิก + 4 ล้อ
    r.addSphere([cx - 14, 12.5, 15], 5.4, pal.metalDark, 1, false);
    r.addSphere([cx + 14, 12.5, 15], 5.4, pal.metalDark, 1, false);
    r.addSphere([cx - 14, 12.5, -15], 5.4, pal.metalDark, 1, false);
    r.addSphere([cx + 14, 12.5, -15], 5.4, pal.metalDark, 1, false);
    r.addBevelBox(cx, 20, 0, 46, 12, 26, pal.cobalt, 1, null, false);
    r.addBevelBox(cx - 2, 28, 0, 24, 7, 20, pal.glass, 0.85, null, false);

    var curV = u + a * phaseT;
    if (Math.abs(curV) > 0.3) {
      r.addArrow([cx + (curV >= 0 ? 25 : -25), 22, 0], [cx + (curV >= 0 ? 25 : -25) + clamp(curV * 2.2, -56, 56), 22, 0], 2.5, pal.emerald);
    }
  };

  SCENES["momentum-collision"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    // รางชนพร้อมกันชนหัวท้าย
    r.addBevelBox(0, 4, 0, 326, 8, 52, pal.metalDark, 1, null, true);
    r.addBox(0, 8.5, 20, 320, 2, 3, pal.metalLight, 1, null, false);
    r.addBox(0, 8.5, -20, 320, 2, 3, pal.metalLight, 1, null, false);
    r.addRing([0, 9, 0], 22, pal.gold, 2.0, false);

    var m1 = st.m1 || 4;
    var u1 = st.u1 || 6;
    var m2 = st.m2 || 2;
    var u2 = st.u2 !== undefined ? st.u2 : 0;
    var elastic = st.elastic !== false;
    var rad1 = clamp(12 + m1 * 1.4, 14, 24);
    var rad2 = clamp(12 + m2 * 1.4, 14, 24);

    var v1 = elastic ? ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2) : (m1 * u1 + m2 * u2) / (m1 + m2);
    var v2 = elastic ? ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2) : v1;

    var cyc = (time * 0.45) % 1;
    if (pulse && pulse.active) {
      cyc = clamp((performance.now() - pulse.started) / 1800, 0, 0.99);
    }
    var x1, x2, curV1, curV2;
    if (cyc < 0.5) {
      var fPre = cyc * 2;
      x1 = -120 + (120 - rad1) * fPre;
      x2 = 72 + (-72 + rad2) * fPre;
      curV1 = u1;
      curV2 = u2;
    } else {
      var fPost = (cyc - 0.5) * 2;
      x1 = -rad1 + v1 * 9 * fPost;
      x2 = rad2 + v2 * 9 * fPost;
      curV1 = v1;
      curV2 = v2;
      if (cyc < 0.65) {
        r.addRing([0, 24, 0], 14 + (cyc - 0.5) * 190, pal.gold, 2.8, false);
      }
    }

    var sx1 = clamp(x1, -142, 142);
    var sx2 = clamp(x2, -142, 142);
    r.addSphere([sx1, 8 + rad1, 0], rad1, pal.danger, 1, true);
    r.addSphere([sx2, 8 + rad2, 0], rad2, pal.cobalt, 1, true);
    if (Math.abs(curV1) > 0.2) {
      var d1 = curV1 > 0 ? 1 : -1;
      r.addArrow([sx1, 14 + rad1 * 2, 0], [sx1 + d1 * clamp(Math.abs(curV1) * 5, 14, 46), 14 + rad1 * 2, 0], 2.2, pal.emerald);
    }
    if (Math.abs(curV2) > 0.2) {
      var d2 = curV2 > 0 ? 1 : -1;
      r.addArrow([sx2, 14 + rad2 * 2, 0], [sx2 + d2 * clamp(Math.abs(curV2) * 5, 14, 46), 14 + rad2 * 2, 0], 2.2, pal.orange);
    }
  };

  SCENES["circular-shm"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var m = st.m || 2;
    var amp = clamp((st.r || 2) * 16, 18, 56);
    var k = st.k || 20;
    var omega = Math.sqrt(k / Math.max(0.2, m));
    var ang = time * omega;

    // ฝั่งซ้าย: จานหมุนความแม่นยำสูง 3 มิติ + ลูกตุ้มวงกลม
    var discCx = -68;
    r.addCylinder([discCx, 0, 0], [discCx, 7, 0], amp + 18, amp + 16, pal.metalDark, 1, 24, true, true);
    r.addCylinder([discCx, 7, 0], [discCx, 12, 0], amp + 12, amp + 12, pal.glass, 0.36, 24, true, false);
    r.addCylinder([discCx, 0, 0], [discCx, 36, 0], 4.5, 4.5, pal.metalLight, 1, 12, true, false);
    r.addRing([discCx, 13, 0], amp, pal.cobalt, 2.2, false);

    var bx = discCx + amp * Math.cos(ang);
    var bz = amp * Math.sin(ang);
    r.addCylinder([discCx, 18, 0], [bx, 18, bz], 1.8, 1.8, pal.metalLight, 1, 8, false, false);
    r.addSphere([bx, 18, bz], 8.5, pal.danger, 1, true);
    r.addArrow([bx, 18, bz], [discCx + (bx - discCx) * 0.22, 18, bz * 0.22], 2.0, pal.emerald);

    // ฝั่งขวา: โครงเสาสปริง SHM แนวตั้ง 3 มิติ
    var sx = 82;
    r.addBevelBox(sx, 3, 0, 62, 6, 38, pal.metalDark, 1, null, true);
    r.addCylinder([sx - 24, 6, -12], [sx - 24, 122, -12], 3, 3, pal.metalLight, 1, 10, false, false);
    r.addCylinder([sx + 24, 6, -12], [sx + 24, 122, -12], 3, 3, pal.metalLight, 1, 10, false, false);
    r.addBevelBox(sx, 120, -4, 60, 7, 28, pal.graphite, 1, null, false);

    var massY = 58 + amp * 0.62 * Math.sin(ang);
    r.addHelix([sx, 116, 0], [sx, massY + 13, 0], 11, 7, pal.gold);
    r.addBevelBox(sx, massY, 0, 26, 22, 26, pal.cobalt, 1, null, false);

    // เส้นเชื่อมภาพฉายเงาระหว่างวงกลมกับ SHM
    r.addLine([bx, 18, bz], [sx - 15, massY, 0], pal.glass, 1.4, true);
  };

  SCENES.coulomb = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var dist = clamp(st.r || 1, 0.2, 4);
    var span = 38 + dist * 48;
    var x1 = -span * 0.5;
    var x2 = span * 0.5;
    var y = 52;
    var q1 = st.q1 || 4;
    var q2 = st.q2 !== undefined ? st.q2 : -4;
    var opp = q1 * q2 < 0;

    // เสาฉนวนตั้งประจุ + แผ่นฐาน
    r.addBevelBox(x1, 3, 0, 30, 6, 30, pal.metalDark, 1, null, true);
    r.addBevelBox(x2, 3, 0, 30, 6, 30, pal.metalDark, 1, null, true);
    r.addCylinder([x1, 6, 0], [x1, y, 0], 4.5, 3.2, pal.metalLight, 1, 12, true, true);
    r.addCylinder([x2, 6, 0], [x2, y, 0], 4.5, 3.2, pal.metalLight, 1, 12, true, true);
    r.addRing([x1, 18, 0], 7, pal.glass, 1.8, false);
    r.addRing([x2, 18, 0], 7, pal.glass, 1.8, false);

    // เส้นสนามไฟฟ้าเรืองแสง 3 มิติรอบประจุทั้งสอง
    for (var ring = 0; ring < 6; ring++) {
      var phi = (ring / 6) * Math.PI * 2 + time * 0.35;
      var arc = [];
      for (var k = 0; k <= 18; k++) {
        var f = k / 18;
        var xx = x1 + (x2 - x1) * f;
        var bulge = opp ? Math.sin(f * Math.PI) * 32 : Math.sin(f * Math.PI) * 54;
        arc.push([xx, y + bulge * Math.cos(phi), bulge * Math.sin(phi)]);
      }
      r.addGlowCurve(arc, opp ? pal.cyan : pal.gold, 1.6, true, false);
    }

    var r1 = clamp(12 + Math.abs(q1) * 1.1, 14, 23);
    var r2 = clamp(12 + Math.abs(q2) * 1.1, 14, 23);
    r.addSphere([x1, y, 0], r1, q1 >= 0 ? pal.danger : pal.cobalt, 1, true);
    r.addSphere([x2, y, 0], r2, q2 >= 0 ? pal.danger : pal.cobalt, 1, true);

    var dir = opp ? 1 : -1;
    var fLen = 36;
    r.addArrow([x1 + dir * r1, y + 26, 0], [x1 + dir * (r1 + fLen), y + 26, 0], 2.6, pal.emerald);
    r.addArrow([x2 - dir * r2, y + 26, 0], [x2 - dir * (r2 + fLen), y + 26, 0], 2.6, pal.emerald);
    r.addCylinder([x1, 7, 18], [x2, 7, 18], 1.4, 1.4, pal.metalLight, 1, 8, true, false);
  };

  SCENES.reflection = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    // แท่นกระจกเงาราบ 3 มิติพร้อมขอบโลหะและแผ่นแก้วสะท้อนแสง
    r.addBevelBox(0, 5, 0, 234, 8, 96, pal.metalDark, 1, null, true);
    r.addBox(0, 10.8, 0, 224, 3.2, 86, pal.cyan, 0.72, pal.glass, false);
    // เส้นแนวฉาก
    r.addLine([0, 12, 0], [0, 130, 0], pal.metalLight, 2, true);

    var deg = clamp(st.angle !== undefined ? st.angle : 40, 2, 85);
    var rad = (deg * Math.PI) / 180;
    var L = 124;
    var src = [-L * Math.sin(rad), 12 + L * Math.cos(rad), 0];
    var dst = [L * Math.sin(rad), 12 + L * Math.cos(rad), 0];

    // หัวฉายเลเซอร์โลหะ
    r.addCylinder(
      src,
      [src[0] * 0.84, 12 + (src[1] - 12) * 0.84, 0],
      6.2,
      4.8,
      pal.graphite,
      1,
      12,
      true,
      false
    );
    r.addGlowCurve([src, [0, 12, 0]], pal.danger, 3.0, false, false);
    r.addGlowCurve([[0, 12, 0], dst], pal.gold, 3.0, false, false);
    r.addSphere([0, 12, 0], 4.2, pal.ivory, 1, false);

    // อนุภาคโฟตอนวิ่งตามลำแสง
    var p = (time * 0.8) % 1;
    var px = p < 0.5 ? src[0] * (1 - p * 2) : dst[0] * ((p - 0.5) * 2);
    var py = 12 + (p < 0.5 ? (src[1] - 12) * (1 - p * 2) : (dst[1] - 12) * ((p - 0.5) * 2));
    r.addSphere([px, py, 0], 4.5, p < 0.5 ? pal.danger : pal.gold, 1, false);
  };

  SCENES["snell-law"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    // ฐานและบล็อกแก้ว/น้ำโปร่งแสง 3 มิติ
    r.addBevelBox(0, 3, 0, 240, 6, 104, pal.metalDark, 1, null, true);
    r.addBox(0, 36, 0, 230, 60, 96, pal.glass, 0.34, pal.cobalt, false);
    r.addLine([0, 6, 0], [0, 136, 0], pal.metalLight, 2, true);

    var hy = 66;
    var deg1 = clamp(st.angle !== undefined ? st.angle : 35, 0, 85);
    var n1 = st.n1 || 1.0;
    var n2 = st.n2 || 1.33;
    var a1 = (deg1 * Math.PI) / 180;
    var L1 = 80;
    var src = [-L1 * Math.sin(a1), hy + L1 * Math.cos(a1), 0];

    r.addCylinder(src, [src[0] * 0.82, hy + (src[1] - hy) * 0.82, 0], 5.8, 4.6, pal.graphite, 1, 12, true, false);
    r.addGlowCurve([src, [0, hy, 0]], pal.danger, 3.0, false, false);
    r.addSphere([0, hy, 0], 4.0, pal.ivory, 1, false);

    var sinB = (n1 * Math.sin(a1)) / n2;
    if (sinB >= 1) {
      var ref = [L1 * Math.sin(a1), hy + L1 * Math.cos(a1), 0];
      r.addGlowCurve([[0, hy, 0], ref], pal.gold, 3.0, false, false);
    } else {
      var b = Math.asin(sinB);
      var L2 = 58;
      var dst = [L2 * Math.sin(b), hy - L2 * Math.cos(b), 0];
      r.addGlowCurve([[0, hy, 0], dst], pal.cyan, 3.0, false, false);
    }

    var p = (time * 0.75) % 1;
    if (p < 0.5) {
      var k = p * 2;
      r.addSphere([src[0] * (1 - k), src[1] + (hy - src[1]) * k, 0], 4.2, pal.danger, 1, false);
    }
  };

  SCENES["ohm-law"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    // แผงวงจร 3 มิติพร้อมขาตั้ง
    r.addBevelBox(0, 6, 0, 264, 10, 148, pal.metalDark, 1, null, true);
    var V = st.V || 12;
    var R = st.R || 6;
    var I = st.I !== undefined ? st.I : V / Math.max(0.5, R);
    var isHidden = !!st.isGame && !st.revealed;

    // บัสบาร์ทองแดง 3 มิติบนบอร์ด
    var wireY = 18;
    var pts = [[-96, wireY, -46], [96, wireY, -46], [96, wireY, 46], [-96, wireY, 46], [-96, wireY, -46]];
    for (var i = 0; i < 4; i++) {
      r.addCylinder(pts[i], pts[i + 1], 3.2, 3.2, pal.gold, 1, 10, true, false);
    }

    // แบตเตอรี่ทรงกระบอก + ขั้วบวก
    r.addCylinder([-96, 11, -20], [-96, 38, -20], 14, 14, pal.cobalt, 1, 16, true, false);
    r.addCylinder([-96, 38, -20], [-96, 44, -20], 6.5, 6.5, pal.gold, 1, 12, true, false);

    // ตัวต้านทานเซรามิก (ร้อนเรืองแสงตามกำลังไฟ I^2 R)
    var hot = clamp((V * V) / Math.max(1, R) / 60, 0, 1);
    r.addCylinder([-32, 22, -46], [32, 22, -46], 11, 11, hot > 0.45 ? pal.danger : pal.emerald, 1, 14, true, false);
    r.addCylinder([-20, 22, -46], [-16, 22, -46], 11.4, 11.4, pal.gold, 1, 14, false, false);
    r.addCylinder([0, 22, -46], [4, 22, -46], 11.4, 11.4, pal.gold, 1, 14, false, false);

    // แอมมิเตอร์ 3D + เข็มวัดกระแสจริง
    r.addBevelBox(0, 22, 46, 58, 26, 26, pal.graphite, 1, null, false);
    var needleFrac = isHidden ? 0 : clamp(I / 10, 0, 1);
    var nAng = -0.9 + needleFrac * 1.8;
    r.addLine([0, 17, 59], [16 * Math.sin(nAng), 17 + 16 * Math.cos(nAng), 59], pal.danger, 2.5, false);

    // อิเล็กตรอน 3 มิติไหลตามกระแส
    if (!isHidden || (pulse && pulse.active)) {
      var speed = clamp(I * 0.28, 0.15, 2.2);
      var count = 12;
      for (var e = 0; e < count; e++) {
        var frac = (e / count + time * speed * 0.25) % 1;
        var pos;
        if (frac < 0.25) {
          pos = [-96 + 192 * (frac / 0.25), wireY, -46];
        } else if (frac < 0.5) {
          pos = [96, wireY, -46 + 92 * ((frac - 0.25) / 0.25)];
        } else if (frac < 0.75) {
          pos = [96 - 192 * ((frac - 0.5) / 0.25), wireY, 46];
        } else {
          pos = [-96, wireY, 46 - 92 * ((frac - 0.75) / 0.25)];
        }
        r.addSphere(pos, 4.4, pal.cyan, 1, false);
      }
    }
  };

  SCENES["harmonic-wave"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var freq = st.f || 2.5;
    var lam = st.lambda || 4.0;
    var amp = clamp((st.amp || 1.5) * 18, 10, 42);
    var isHidden = !!st.isGame && !st.revealed;
    var revealPulse = pulse && pulse.active && performance.now() - pulse.started < 1200;
    var drawAll = !isHidden || revealPulse;

    // เสาเครื่องกำเนิดคลื่นซ้าย-ขวา
    r.addBevelBox(-148, 3, 0, 22, 6, 24, pal.metalDark, 1, null, true);
    r.addBevelBox(148, 3, 0, 22, 6, 24, pal.metalDark, 1, null, true);
    r.addCylinder([-148, 6, 0], [-148, 96, 0], 4.5, 4, pal.graphite, 1, 12, true, true);
    r.addCylinder([148, 6, 0], [148, 96, 0], 4.5, 4, pal.graphite, 1, 12, true, true);
    r.addLine([-148, 52, 0], [148, 52, 0], pal.floorAxis, 1.5, true);

    var pts = [];
    var segs = 40;
    var phase = drawAll ? time * freq * 1.8 : 0;
    var maxI = drawAll ? segs : 10;
    for (var i = 0; i <= maxI; i++) {
      var x = -140 + (i / segs) * 280;
      var k = (2 * Math.PI) / clamp(lam * 28, 35, 220);
      var y = 52 + amp * Math.sin(k * (x + 140) - phase);
      pts.push([x, y, 0]);
      if (i % 2 === 0) {
        r.addLine([x, 52, 0], [x, y, 0], pal.glass, 1.3, false);
        r.addSphere([x, y, 0], 4.2, i === 0 ? pal.orange : pal.cobalt, 1, false);
      }
    }
    r.addGlowCurve(pts, pal.cobalt, 3.4, !drawAll, true);
  };

  SCENES["fluid-pressure"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var rho = st.rho || 1000;
    var hDepth = clamp(st.h || 5, 0.5, 20);
    var rhoObj = st.rhoObj || 800;

    // ฐานและถังของเหลวแก้วโปร่งใส 3 มิติ
    var tankW = 152;
    var tankH = 108;
    var tankD = 96;
    r.addBevelBox(0, 3, 0, tankW + 14, 6, tankD + 14, pal.metalDark, 1, null, true);
    r.addBox(0, tankH * 0.5 + 6, 0, tankW, tankH, tankD, rho > 1100 ? pal.cyan : pal.glass, 0.28, pal.cobalt, false);

    // หัววัดความดันระดับลึก h
    var sy = clamp(106 - (hDepth / 20) * 86, 18, 102);
    r.addCylinder([-54, 118, 16], [-54, sy, 16], 1.6, 1.6, pal.metalLight, 1, 8, false, false);
    r.addSphere([-54, sy, 16], 6.0, pal.danger, 1, false);
    r.addRing([-54, sy, 16], 11, pal.gold, 1.8, false);

    // วัตถุที่ลอยหรือจม + เวกเตอร์แรงพยุง Fb และน้ำหนัก W
    var floats = rhoObj <= rho;
    var bob = floats ? Math.sin(time * 2.2) * 3.2 : 0;
    var subFrac = clamp(rhoObj / rho, 0.2, 1);
    var objY = floats ? 110 - subFrac * 24 + bob : 22;
    r.addBevelBox(22, objY, 0, 34, 28, 34, pal.gold, 0.96, pal.metalDark, false);
    r.addArrow([22, objY + 15, 0], [22, objY + 46, 0], 2.4, pal.emerald);
    r.addArrow([22, objY - 15, 0], [22, objY - 40, 0], 2.4, pal.danger);
  };

  SCENES["ideal-gas"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var T = st.T || 300;
    var V = st.V || 5;
    var n = st.n || 1;
    var R = 8.314;
    var P = st.P !== undefined ? st.P : (n * R * T) / Math.max(0.5, V);

    var pisH = clamp(36 + (V / 10) * 78, 38, 116);
    var pulseOff =
      pulse && pulse.active && performance.now() - pulse.started < 600
        ? Math.sin(((performance.now() - pulse.started) / 600) * Math.PI) * -6
        : 0;
    pisH += pulseOff;

    // เตาให้ความร้อน + กระบอกสูบแก้วใส + มาตรวัดความดัน
    r.addBevelBox(0, 4, 0, 132, 8, 102, pal.metalDark, 1, null, true);
    if (T > 320) {
      r.addBox(0, 9.5, 0, 76, 3.5, 62, pal.orange, clamp((T - 240) / 420, 0.3, 0.92), null, false);
    }
    r.addCylinder([0, 8, 0], [0, 126, 0], 54, 54, pal.glass, 0.20, 20, false, false);
    r.addCylinder([0, 124, 0], [0, 128, 0], 56, 56, pal.metalLight, 0.75, 20, false, false);
    // หัวลูกสูบทองเหลืองและก้านสูบ
    r.addCylinder([0, pisH, 0], [0, pisH + 10, 0], 50, 50, pal.gold, 0.95, 20, true, false);
    r.addCylinder([0, pisH + 10, 0], [0, pisH + 46, 0], 6, 6, pal.metalLight, 1, 12, true, false);
    r.addCylinder([-18, pisH + 46, 0], [18, pisH + 46, 0], 4, 4, pal.graphite, 1, 10, true, false);

    // เกจวัดความดันข้างกระบอกสูบ
    r.addCylinder([54, 46, 0], [74, 46, 0], 3, 3, pal.metalLight, 1, 10);
    r.addCylinder([82, 34, 0], [82, 58, 0], 14, 14, pal.graphite, 1, 16);
    var gAng = -0.9 + clamp(P / 700, 0, 1) * 1.8;
    r.addLine([82, 46, 15], [82 + 11 * Math.sin(gAng), 46 + 11 * Math.cos(gAng), 15], pal.danger, 2.2, false);

    // โมเลกุลแก๊ส 3 มิติเปลี่ยนสีตามอุณหภูมิ T
    var speedScale = Math.sqrt(T / 300) * 1.45;
    var molCount = Math.round(clamp(12 + n * 10, 12, 32));
    var molColor = T > 460 ? pal.danger : T > 340 ? pal.orange : pal.cobalt;
    for (var i = 0; i < molCount; i++) {
      var s1 = Math.sin(i * 12.9898) * 43758.5453;
      var s2 = Math.cos(i * 78.233) * 19341.12;
      var ax = (s1 - Math.floor(s1)) * Math.PI * 2;
      var az = (s2 - Math.floor(s2)) * Math.PI * 2;
      var px = 38 * Math.sin(ax + time * speedScale * (1.2 + (i % 4) * 0.35));
      var pz = 38 * Math.cos(az + time * speedScale * (1.0 + (i % 3) * 0.4));
      var py = 14 + (pisH - 22) * (0.5 + 0.5 * Math.sin(i * 2.1 + time * speedScale * 2.2));
      r.addSphere([px, py, pz], 4.2, molColor, 1, false);
    }
  };

  SCENES["thin-lens"] = function (r, st, time, pulse) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    // รางม้านั่งแสง 3 มิติ
    r.addBevelBox(0, 4, 0, 340, 8, 42, pal.metalDark, 1, null, true);
    r.addBox(0, 8.6, 14, 336, 1.8, 3, pal.metalLight, 1, null, false);
    r.addBox(0, 8.6, -14, 336, 1.8, 3, pal.metalLight, 1, null, false);

    var scale = 2.4;
    var f = st.f || 15;
    var s = st.s || 30;
    var isConcave = !!st.isConcave;
    var objX = clamp(-s * scale, -155, -24);
    var isHidden = !!st.isGame && !st.revealed;
    var firing = pulse && pulse.active && performance.now() - pulse.started < 1100;

    // ฐานและเลนส์แก้วตรงกลาง (นูนหรือเว้า)
    r.addBevelBox(0, 10, 0, 18, 6, 28, pal.graphite, 1, null, false);
    if (isConcave) {
      r.addCylinder([0, 46, -8], [0, 46, 8], 40, 40, pal.glass, 0.34, 18, true, false);
      r.addRing([0, 46, 0], 40, pal.metalLight, 2.5, false);
    } else {
      r.addCylinder([0, 46, -6], [0, 46, 6], 39, 39, pal.glass, 0.44, 20, true, false);
      r.addRing([0, 46, 0], 39, pal.cyan, 2.2, false);
    }

    // จุดโฟกัส F ด้านหน้าและหลัง
    r.addSphere([-f * scale, 12, 0], 4.4, pal.gold, 1, false);
    r.addSphere([f * scale, 12, 0], 4.4, pal.gold, 1, false);

    // วัตถุ (เสาลูกศรเรืองแสง 3 มิติ)
    r.addArrow([objX, 10, 0], [objX, 62, 0], 3.0, pal.danger);

    if (st.targetDist) {
      var tx = clamp(st.targetDist * scale, 30, 155);
      r.addBevelBox(tx, 46, 0, 7, 74, 48, pal.gold, 0.38, pal.gold, false);
      r.addBevelBox(tx, 9, 0, 18, 5, 34, pal.graphite, 1, null, false);
    }

    if (!isHidden || firing) {
      var F = isConcave ? -f : f;
      var sp = Math.abs(s - F) > 0.4 ? (s * F) / (s - F) : 999;
      if (sp > 0 && sp < 140) {
        var imgX = clamp(sp * scale, 18, 160);
        var m = -sp / s;
        var imgTipY = clamp(46 + m * 36, 10, 96);
        r.addArrow([imgX, 46, 0], [imgX, imgTipY, 0], 2.5, pal.emerald);
        r.addGlowCurve([[objX, 62, 0], [0, 62, 0], [imgX, imgTipY, 0]], pal.danger, 2.0, false, false);
        r.addGlowCurve([[objX, 62, 0], [imgX, imgTipY, 0]], pal.gold, 1.8, false, false);
      } else if (sp < 0 && sp > -140) {
        var vImgX = clamp(sp * scale, -155, -10);
        var vm = -sp / s;
        r.addArrow([vImgX, 46, 0], [vImgX, clamp(46 + vm * 34, 16, 94), 0], 2.2, pal.cyan);
        r.addGlowCurve([[objX, 62, 0], [0, 62, 0], [95, 78, 0]], pal.danger, 1.9, false, false);
      }
    } else {
      r.addGlowCurve([[objX, 62, 0], [0, 62, 0]], pal.danger, 2.0, true, false);
      r.addGlowCurve([[objX, 62, 0], [0, 46, 0]], pal.gold, 1.8, true, false);
    }
  };

  SCENES["magnetic-induction"] = function (r, st, time) {
    var pal = r.pal;
    r.addFloorGrid(240, 160, 42);
    var B = st.B !== undefined ? st.B : 1.0;
    var v = st.v !== undefined ? st.v : 4;
    var wireMode = !!st.wireMode;

    // แท่งแม่เหล็ก N-S แบบ Bevelled
    r.addBevelBox(-34, 14, 0, 68, 22, 36, pal.danger, 1, null, true);
    r.addBevelBox(34, 14, 0, 68, 22, 36, pal.cobalt, 1, null, true);

    // เส้นสนามแม่เหล็ก 3 มิติโค้งเรืองแสง
    for (var az = -2; az <= 2; az++) {
      var ang = az * 0.46;
      var arc = [];
      for (var k = 0; k <= 20; k++) {
        var f = k / 20;
        var lx = -58 + f * 116;
        var bulge = Math.sin(f * Math.PI) * (54 + Math.abs(az) * 14);
        arc.push([lx, 26 + bulge * Math.cos(ang), bulge * Math.sin(ang)]);
      }
      r.addGlowCurve(arc, pal.cyan, 1.6, true, false);
    }

    if (wireMode) {
      var railX = clamp(Math.sin(time * (0.8 + v * 0.15)) * 45, -55, 55);
      r.addBevelBox(0, 62, -26, 144, 4.5, 4.5, pal.metalLight, 1, null, false);
      r.addBevelBox(0, 62, 26, 144, 4.5, 4.5, pal.metalLight, 1, null, false);
      r.addCylinder([-70, 62, -26], [-70, 62, 26], 3, 3, pal.metal, 1, 10);
      r.addCylinder([railX, 62, -28], [railX, 62, 28], 4.2, 4.2, pal.gold, 1, 12);
    } else {
      var rad = clamp(24 + v * 2.8, 22, 54);
      var theta = time * clamp(0.8 + B * 0.9, 0.5, 4);
      var cx = rad * Math.cos(theta);
      var cz = rad * Math.sin(theta);
      r.addRing([0, 68, 0], rad, pal.emerald, 2.0, false);
      r.addSphere([cx, 68, cz], 7.4, pal.danger, 1, true);
      r.addArrow([cx, 68, cz], [cx * 0.25, 68, cz * 0.25], 2.1, pal.emerald);
    }
  };

  SCENES["modern-quantum"] = function (r, st, time, pulse) {
    var pal = r.pal;
    var mode = st.mode || "photoelectric";
    r.addFloorGrid(240, 160, 42);

    if (mode === "decay") {
      r.addBevelBox(0, 3, 0, 120, 6, 120, pal.metalDark, 1, null, true);
      var frac = clamp(st.remainFrac !== undefined ? st.remainFrac : 0.5, 0.02, 1);
      var total = 27;
      var activeCount = Math.round(total * frac);
      var idx = 0;
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = 0; iy < 3; iy++) {
          for (var iz = -1; iz <= 1; iz++) {
            var active = idx < activeCount;
            var jitter = active ? Math.sin(time * 5 + idx) * 1.4 : 0;
            r.addSphere(
              [ix * 24 + jitter, 24 + iy * 24, iz * 24],
              8.2,
              active ? pal.gold : pal.metal,
              active ? 1 : 0.45,
              iy === 0
            );
            idx++;
          }
        }
      }
      return;
    }

    if (mode === "relativity") {
      var beta = clamp(st.beta || 0.6, 0.05, 0.98);
      var gamma = 1 / Math.sqrt(1 - beta * beta);
      var xPos = Math.sin(time * beta * 3.0) * 84;
      var len = clamp(84 / gamma, 18, 84);
      r.addGlowCurve([[-140, 12, 0], [140, 12, 0]], pal.glass, 2.0, true, false);
      r.addBevelBox(xPos, 38, 0, len, 20, 32, pal.cobalt, 1, null, true);
      r.addBevelBox(xPos + len * 0.15, 50, 0, len * 0.45, 7, 18, pal.glass, 0.85, null, false);
      r.addCylinder([xPos - len * 0.5 - 18, 38, 0], [xPos - len * 0.5, 38, 0], 8, 3, pal.gold, 0.88, 12);
      return;
    }

    // โหมด photoelectric: หลอดสุญญากาศ + ขั้วโลหะ + โฟตอน/อิเล็กตรอน
    var W0 = st.W0 || 2.2;
    var freq = st.f || 10;
    var Ek = st.Ek !== undefined ? st.Ek : Math.max(0, 0.4136 * freq - W0);
    var isHidden = !!st.isGame && !st.revealed;
    var firing = pulse && pulse.active && performance.now() - pulse.started < 1200;

    r.addBevelBox(-75, 4, 0, 26, 8, 48, pal.metalDark, 1, null, true);
    r.addBevelBox(75, 4, 0, 26, 8, 48, pal.metalDark, 1, null, true);
    r.addCylinder([-96, 48, 0], [96, 48, 0], 46, 46, pal.glass, 0.20, 20, true, false);
    r.addBevelBox(-70, 48, 0, 10, 62, 44, pal.graphite, 1, null, false);
    r.addBevelBox(72, 48, 0, 9, 62, 44, pal.gold, 0.92, null, false);

    // หัวฉายโฟตอน + ลำโฟตอน
    var photCol = freq > 10.5 ? pal.violet : freq > 8 ? pal.cobalt : freq > 6 ? pal.emerald : pal.danger;
    r.addCylinder([-152, 56, 0], [-128, 56, 0], 8, 7, pal.graphite, 1, 12);
    for (var p = 0; p < 3; p++) {
      var pf = (time * 0.9 + p * 0.33) % 1;
      var px = -128 + 56 * pf;
      r.addSphere([px, 56 - p * 8, 0], 4.6, photCol, 1, false);
    }

    if ((!isHidden || firing) && Ek > 0) {
      var eSpd = clamp(0.5 + Ek * 0.55, 0.5, 2.6);
      for (var k = 0; k < 4; k++) {
        var ef = (time * eSpd + k * 0.25) % 1;
        var ex = -64 + 132 * ef;
        r.addSphere([ex, 40 + (k % 2) * 16, (k - 1.5) * 8], 5.0, pal.cyan, 1, false);
      }
    }
  };

  // ------------------------------------------------------------------ Viewport & Overlay Toolbar 3D
  function attach(container, svgEl, opts) {
    opts = opts || {};
    var kind = opts.kind || "projectile";
    if (!container || !svgEl || !svgEl.parentNode) return null;

    var DEFAULT_YAW = 0.46;
    var DEFAULT_PITCH = 0.26;
    var DEFAULT_ZOOM = 1.16;

    var stage = h("div", { class: "lp3d-stage" });
    var is3D = true;
    var cam = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: DEFAULT_ZOOM, targetY: 32 };
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
