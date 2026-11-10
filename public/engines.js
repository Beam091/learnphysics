// ชุดตัวจำลองและเกมของ LearnPhysics: แต่ละบทเรียนเลือกใช้ตัวที่ต้องการผ่านไฟล์ตั้งค่า (config)
// ตัวจำลอง: projectile (ยิงวัตถุ), coulomb (แรงระหว่างประจุ), reflection (การสะท้อนของแสง)
// เกม: aim-and-shoot (ยิงให้ตรงเป้า)
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var uid = 0;

  function svgEl(parent, name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function h(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === "text") n.textContent = props[k];
        else if (k === "class") n.className = props[k];
        else n.setAttribute(k, props[k]);
      }
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // แถบเลื่อนพร้อมป้ายค่า
  function field(label, unit, cfg, onInput) {
    var id = "lp-f" + (++uid);
    var out = h("output", { text: String(cfg.value) });
    var lab = h("label", { for: id }, [
      document.createTextNode(label + " "),
      out,
      document.createTextNode(" " + unit),
    ]);
    var input = h("input", { id: id, type: "range", min: cfg.min, max: cfg.max, step: cfg.step || 1, value: cfg.value });
    input.addEventListener("input", function () {
      out.textContent = input.value;
      onInput();
    });
    return { root: h("div", { class: "field" }, [lab, input]), input: input };
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function drawArrow(svg, x1, y1, x2, y2, cls) {
    cls = cls || "arrow";
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    var ux = dx / len, uy = dy / len;
    var hx = x2 - ux * 8, hy = y2 - uy * 8;
    svgEl(svg, "line", { x1: x1, y1: y1, x2: hx, y2: hy, class: cls });
    var px = -uy, py = ux;
    var p1 = x2.toFixed(1) + "," + y2.toFixed(1);
    var p2 = (x2 - ux * 10 + px * 5).toFixed(1) + "," + (y2 - uy * 10 + py * 5).toFixed(1);
    var p3 = (x2 - ux * 10 - px * 5).toFixed(1) + "," + (y2 - uy * 10 - py * 5).toFixed(1);
    svgEl(svg, "polygon", { points: p1 + " " + p2 + " " + p3, class: "arrow-head" });
  }

  // ---------------------------------------------------------------- projectile
  function projectile(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var G = 9.8, W = 170, H = 90, VBW = 680, VBH = 360;
    var M = { l: 46, r: 14, t: 14, b: 38 };
    var ac = config.angle || { min: 10, max: 80, default: 45 };
    var sc = config.speed || { min: 10, max: 40, default: 25 };

    function sx(x) { return M.l + (x / W) * (VBW - M.l - M.r); }
    function sy(y) { return VBH - M.b - (y / H) * (VBH - M.t - M.b); }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 " + VBW + " " + VBH,
      class: "plot",
      role: "img",
      "aria-label": "กราฟแสดงเส้นทางของวัตถุที่ถูกยิงเฉียงขึ้น แกนนอนคือระยะทาง แกนตั้งคือความสูง หน่วยเมตร",
    });

    var x, y;
    for (x = 0; x <= W; x += 10) svgEl(svg, "line", { x1: sx(x), y1: sy(0), x2: sx(x), y2: sy(H), class: x === 0 ? "g-axis" : "g-line" });
    for (y = 0; y <= H; y += 10) svgEl(svg, "line", { x1: sx(0), y1: sy(y), x2: sx(W), y2: sy(y), class: y === 0 ? "g-axis" : "g-line" });
    for (x = 0; x <= 150; x += 50) svgEl(svg, "text", { x: sx(x), y: sy(0) + 26, "text-anchor": "middle", class: "g-label" }).textContent = x + " ม.";
    [0, 40, 80].forEach(function (yy) {
      svgEl(svg, "text", { x: sx(0) - 8, y: sy(yy) + 6, "text-anchor": "end", class: "g-label" }).textContent = String(yy);
    });

    var targetG = svgEl(svg, "g", {});
    var path = svgEl(svg, "polyline", { class: "path", points: "" });
    var apex = svgEl(svg, "circle", { class: "mark", r: 5, cx: 0, cy: 0 });
    var land = svgEl(svg, "circle", { class: "mark", r: 5, cx: 0, cy: 0 });
    var ball = svgEl(svg, "circle", { class: "ball", r: 7, cx: sx(0), cy: sy(0) });

    var rangeOut = h("dd", { text: "-" }), heightOut = h("dd", { text: "-" }), timeOut = h("dd", { text: "-" });
    var interacted = false, frame = null;
    var cur = { vx: 0, vy: 0, T: 0, R: 0, H: 0 };

    function interact() {
      if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); }
    }

    var angleF = field("มุมยิง", "องศา", { min: ac.min, max: ac.max, value: ac.default }, function () { interact(); update(); });
    var speedF = field("ความเร็วต้น", "เมตร/วินาที", { min: sc.min, max: sc.max, value: sc.default }, function () { interact(); update(); });
    var shootBtn = h("button", { type: "button", text: "ยิง" });

    function compute() {
      var a = (Number(angleF.input.value) * Math.PI) / 180;
      var v = Number(speedF.input.value);
      var vx = v * Math.cos(a), vy = v * Math.sin(a), T = (2 * vy) / G;
      cur = { vx: vx, vy: vy, T: T, R: vx * T, H: (vy * vy) / (2 * G) };
    }
    function pos(t) { return { x: cur.vx * t, y: cur.vy * t - 0.5 * G * t * t }; }
    function placeBall(t) {
      var p = pos(t);
      ball.setAttribute("cx", sx(p.x));
      ball.setAttribute("cy", sy(Math.max(p.y, 0)));
    }
    function stop() { if (frame !== null) { cancelAnimationFrame(frame); frame = null; } }

    function update() {
      stop();
      compute();
      var pts = [];
      for (var i = 0; i <= 60; i++) {
        var p = pos((cur.T * i) / 60);
        pts.push(sx(p.x).toFixed(1) + "," + sy(Math.max(p.y, 0)).toFixed(1));
      }
      path.setAttribute("points", pts.join(" "));
      apex.setAttribute("cx", sx(cur.R / 2)); apex.setAttribute("cy", sy(cur.H));
      land.setAttribute("cx", sx(cur.R)); land.setAttribute("cy", sy(0));
      placeBall(0);
      rangeOut.textContent = cur.R.toFixed(1) + " ม.";
      heightOut.textContent = cur.H.toFixed(1) + " ม.";
      timeOut.textContent = cur.T.toFixed(2) + " วิ";
    }

    function finish() {
      placeBall(cur.T);
      frame = null;
      if (opts.onLand) opts.onLand(cur.R);
    }

    function shoot() {
      interact();
      stop();
      if (reducedMotion()) { finish(); return; }
      var start = performance.now();
      function step(now) {
        var t = (now - start) / 1000;
        if (t >= cur.T) { finish(); return; }
        placeBall(t);
        frame = requestAnimationFrame(step);
      }
      placeBall(0);
      frame = requestAnimationFrame(step);
    }
    shootBtn.addEventListener("click", shoot);

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [angleF.root, speedF.root]));
    var actBtns = [shootBtn];
    if (opts.extraActions && Array.isArray(opts.extraActions)) {
      actBtns = actBtns.concat(opts.extraActions);
    }
    container.appendChild(h("div", { class: "actions" }, actBtns));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ระยะไกลสุด" }), rangeOut]),
      h("div", null, [h("dt", { text: "สูงสุด" }), heightOut]),
      h("div", null, [h("dt", { text: "เวลาที่ลอย" }), timeOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "ไม่คิดแรงต้านอากาศ ใช้ g = 9.8 เมตร/วินาที²" }));
    update();

    return {
      angleInput: angleF.input,
      speedInput: speedF.input,
      setTarget: function (xt, tol) {
        clear(targetG);
        svgEl(targetG, "rect", { x: sx(xt - tol), y: sy(0) - 14, width: sx(xt + tol) - sx(xt - tol), height: 14, class: "target" });
        svgEl(targetG, "text", { x: sx(xt), y: sy(0) - 20, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "เป้า (" + xt + " ม.)";
      },
    };
  }

  // ------------------------------------------------------------------- coulomb
  function coulomb(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var K = 9e9;
    var c1 = config.q1 || { min: 1, max: 10, default: 2 };
    var c2 = config.q2 || { min: 1, max: 10, default: 3 };
    var cr = config.r || { min: 0.1, max: 1.0, default: 0.3 };
    var interacted = false;
    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 400 190",
      class: "plot",
      role: "img",
      "aria-label": "ประจุไฟฟ้าสองจุดและลูกศรแสดงแรงที่กระทำต่อกัน",
    });

    var q1F = field("ประจุตัวที่ 1 =", "ไมโครคูลอมบ์", { min: c1.min, max: c1.max, value: c1.default }, function () { interact(); update(); });
    var q2F = field("ประจุตัวที่ 2 =", "ไมโครคูลอมบ์", { min: c2.min, max: c2.max, value: c2.default }, function () { interact(); update(); });
    var rF = field("ระยะห่าง =", "เมตร", { min: cr.min, max: cr.max, step: 0.05, value: cr.default }, function () { interact(); update(); });

    var signId = "lp-f" + (++uid);
    var signBox = h("input", { id: signId, type: "checkbox" });
    signBox.addEventListener("change", function () { interact(); update(); });
    var signRow = h("div", { class: "field check" }, [signBox, h("label", { for: signId, text: "ประจุตัวที่ 2 เป็นประจุลบ" })]);

    var forceOut = h("dd", { text: "-" }), kindOut = h("dd", { text: "-" });

    function arrow(x1, y, x2) {
      var s = x2 >= x1 ? 1 : -1;
      svgEl(svg, "line", { x1: x1, y1: y, x2: x2 - s * 8, y2: y, class: "arrow" });
      svgEl(svg, "polygon", { points: x2 + "," + y + " " + (x2 - s * 12) + "," + (y - 7) + " " + (x2 - s * 12) + "," + (y + 7), class: "arrow-head" });
    }

    function update() {
      var q1 = Number(q1F.input.value) * 1e-6, q2 = Number(q2F.input.value) * 1e-6, r = Number(rF.input.value);
      var F = (K * q1 * q2) / (r * r);
      var opposite = signBox.checked;

      clear(svg);
      var d = 90 + ((r - cr.min) / (cr.max - cr.min || 1)) * 210;
      var x1 = 200 - d / 2, x2 = 200 + d / 2, y = 80, rad = 20;
      var L = 14 + 14 * Math.log10(1 + 100 * F);
      if (opposite) L = Math.min(L, (d - 2 * rad) / 2 - 6);
      else L = Math.min(L, x1 - rad - 14);

      svgEl(svg, "line", { x1: x1, y1: 136, x2: x2, y2: 136, class: "g-axis" });
      svgEl(svg, "text", { x: 200, y: 172, "text-anchor": "middle", class: "g-label" }).textContent = "r = " + r.toFixed(2) + " ม.";

      if (opposite) { arrow(x1 + rad, y, x1 + rad + L); arrow(x2 - rad, y, x2 - rad - L); }
      else { arrow(x1 - rad, y, x1 - rad - L); arrow(x2 + rad, y, x2 + rad + L); }

      svgEl(svg, "circle", { cx: x1, cy: y, r: rad, class: "charge-pos" });
      svgEl(svg, "text", { x: x1, y: y + 8, "text-anchor": "middle", class: "charge-sign" }).textContent = "+";
      svgEl(svg, "circle", { cx: x2, cy: y, r: rad, class: opposite ? "charge-neg" : "charge-pos" });
      svgEl(svg, "text", { x: x2, y: y + 8, "text-anchor": "middle", class: "charge-sign" }).textContent = opposite ? "\u2212" : "+";

      forceOut.textContent = (F < 1 ? F.toFixed(3) : F.toFixed(2)) + " นิวตัน";
      kindOut.textContent = opposite ? "ดึงดูดกัน" : "ผลักกัน";
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [q1F.root, q2F.root, rF.root, signRow]));
    container.appendChild(h("dl", { class: "results two", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ขนาดแรง" }), forceOut]),
      h("div", null, [h("dt", { text: "ลักษณะแรง" }), kindOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "F = k·q1·q2 / r² เมื่อ k = 9×10⁹ นิวตัน·เมตร²/คูลอมบ์² ลูกศรแสดงทิศทางและขนาดแรงอย่างคร่าวๆ" }));
    update();
  }

  // ---------------------------------------------------------------- reflection
  function reflection(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var ac = config.angle || { min: 0, max: 80, default: 40 };
    var interacted = false;
    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 300",
      class: "plot",
      role: "img",
      "aria-label": "รังสีแสงตกกระทบกระจกเงาราบและสะท้อนออกด้วยมุมเท่ากัน วัดจากเส้นแนวฉาก",
    });
    var angleF = field("มุมตกกระทบ", "องศา", { min: ac.min, max: ac.max, value: ac.default }, function () { interact(); update(); });
    var out = h("dd", { text: "-" });

    function update() {
      var deg = Number(angleF.input.value), a = (deg * Math.PI) / 180;
      var hx = 340, hy = 240, L = 190, s = Math.sin(a), c = Math.cos(a);
      clear(svg);

      svgEl(svg, "line", { x1: 100, y1: hy, x2: 580, y2: hy, class: "mirror" });
      svgEl(svg, "line", { x1: hx, y1: hy, x2: hx, y2: 40, class: "normal" });
      svgEl(svg, "text", { x: hx + 8, y: 30, class: "g-label" }).textContent = "เส้นแนวฉาก";

      svgEl(svg, "line", { x1: hx - L * s, y1: hy - L * c, x2: hx, y2: hy, class: "ray" });
      svgEl(svg, "line", { x1: hx, y1: hy, x2: hx + L * s, y2: hy - L * c, class: "ray" });
      svgEl(svg, "text", { x: hx - L * s - 6, y: hy - L * c + 6, "text-anchor": "end", class: "g-label" }).textContent = "รังสีตกกระทบ";
      svgEl(svg, "text", { x: hx + L * s + 6, y: hy - L * c + 6, class: "g-label" }).textContent = "รังสีสะท้อน";

      if (deg >= 1) {
        var R = 60, half = a / 2;
        svgEl(svg, "path", { d: "M " + hx + " " + (hy - R) + " A " + R + " " + R + " 0 0 0 " + (hx - R * s) + " " + (hy - R * c), class: "arc" });
        svgEl(svg, "path", { d: "M " + hx + " " + (hy - R) + " A " + R + " " + R + " 0 0 1 " + (hx + R * s) + " " + (hy - R * c), class: "arc" });
        svgEl(svg, "text", { x: hx - 88 * Math.sin(half), y: hy - 88 * Math.cos(half) + 6, "text-anchor": "middle", class: "g-label" }).textContent = "θ";
        svgEl(svg, "text", { x: hx + 88 * Math.sin(half), y: hy - 88 * Math.cos(half) + 6, "text-anchor": "middle", class: "g-label" }).textContent = "θ";
      }
      out.textContent = deg + " องศา";
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [angleF.root]));
    container.appendChild(h("dl", { class: "results two", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "มุมตกกระทบ = มุมสะท้อน" }), out]),
    ]));
    container.appendChild(h("p", { class: "note", text: "มุมทั้งสองวัดจากเส้นแนวฉาก (เส้นตั้งฉากกับผิวกระจก) ไม่ใช่วัดจากผิวกระจก" }));
    update();
  }

  // ------------------------------------------------------------- aim-and-shoot
  function aimAndShoot(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var range = config.targetDistance || config.targetRange || config.target || [40, 120];
    var tol = Math.max(config.tolerance || 4, 3);
    var target = 0, attempts = 0, won = false;

    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite", text: "ปรับมุมและความเร็ว แล้วกดยิงให้ตกในช่วงเป้า" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });
    var view = h("div", { class: "game-view" });

    var viewConfig = Object.assign({}, config.view || {}, {
      angle: config.angle || (config.view && config.view.angle),
      speed: config.speed || (config.view && config.view.speed),
    });

    var engine = projectile(view, viewConfig, {
      extraActions: [newBtn],
      onLand: function (R) {
        attempts += 1;
        var diff = R - target;
        if (Math.abs(diff) <= tol) {
          msg.className = "game-msg ok";
          msg.textContent = "ถูกเป้าหมายอย่างแม่นยำ! วัตถุตกที่ระยะ " + R.toFixed(1) + " ม. (เป้า " + target + "±" + tol + " ม.) ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
          if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
        } else {
          msg.className = "game-msg";
          msg.textContent = (diff < 0 ? "ตกสั้นไป " : "ตกเลยเป้าไป ") + Math.abs(diff).toFixed(1) + " เมตร (ตกที่ " + R.toFixed(1) + " ม., เป้า " + target + " ม.) ลองปรับมุมหรือความเร็วใหม่ (ยิงครั้งที่ " + attempts + ")";
        }
      },
    });

    function pickTarget() {
      // Guaranteed solvable: pick candidate angle and speed from actual slider bounds
      var cands = [];
      var allCands = [];
      var aMin = Math.max(15, Number(engine.angleInput ? engine.angleInput.min : 10));
      var aMax = Math.min(75, Number(engine.angleInput ? engine.angleInput.max : 80));
      var sMin = Number(engine.speedInput ? engine.speedInput.min : 10);
      var sMax = Number(engine.speedInput ? engine.speedInput.max : 40);
      var curAngle = Number(engine.angleInput ? engine.angleInput.value : 45);
      var curSpeed = Number(engine.speedInput ? engine.speedInput.value : 25);
      var G = 9.8;
      for (var a = aMin; a <= aMax; a += 1) {
        var rad = (a * Math.PI) / 180;
        for (var s = sMin; s <= sMax; s += 1) {
          var R = (s * s * Math.sin(2 * rad)) / G;
          if (R >= 15 && R <= 134 && (Math.abs(a - curAngle) >= 3 || Math.abs(s - curSpeed) >= 2)) {
            var rRound = Math.round(R);
            allCands.push(rRound);
            if (R >= range[0] && R <= range[1]) {
              cands.push(rRound);
            }
          }
        }
      }
      var pool = cands.length > 0 ? cands : allCands;
      if (pool.length > 0) {
        target = pool[Math.floor(Math.random() * pool.length)];
      } else {
        target = 60;
      }
      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: ยิงให้ตกที่ระยะ " + target + " เมตร (ยอมให้คลาดเคลื่อนได้ ±" + tol + " เมตร)";
      msg.textContent = "ปรับมุมและความเร็วต้น แล้วกดยิงให้ตกในช่วงเป้า";
      engine.setTarget(target, tol);
    }

    newBtn.addEventListener("click", pickTarget);
    container.appendChild(info);
    container.appendChild(view);
    container.appendChild(msg);
    pickTarget();
  }

  // ------------------------------------------------------------------ ohm-law
  // วาดวงจรอย่างง่าย: แบตเตอรี่ + ตัวต้านทาน พร้อมจุดแสดงการไหลของกระแส
  function drawCircuit(svg, V, R) {
    var I = V / R;
    clear(svg);
    var x1 = 120, x2 = 560, y1 = 50, y2 = 210;
    svgEl(svg, "polyline", { points: x1 + "," + (y2 - 40) + " " + x1 + "," + y2 + " " + x2 + "," + y2 + " " + x2 + "," + y1 + " " + (x1 + 0) + "," + y1 + " " + x1 + "," + (y1 + 40), class: "g-axis", fill: "none" });
    // แบตเตอรี่ (ซ้าย)
    svgEl(svg, "line", { x1: x1 - 22, y1: (y1 + y2) / 2 - 8, x2: x1 + 22, y2: (y1 + y2) / 2 - 8, class: "g-axis", "stroke-width": 4 });
    svgEl(svg, "line", { x1: x1 - 12, y1: (y1 + y2) / 2 + 8, x2: x1 + 12, y2: (y1 + y2) / 2 + 8, class: "g-axis", "stroke-width": 4 });
    svgEl(svg, "text", { x: x1 - 30, y: (y1 + y2) / 2 + 5, "text-anchor": "end", class: "g-label" }).textContent = "V = " + V + " โวลต์";
    // ตัวต้านทาน (บน)
    var rw = 40 + R * 4;
    svgEl(svg, "rect", { x: (x1 + x2) / 2 - rw / 2, y: y1 - 14, width: rw, height: 28, class: "target", "fill-opacity": 0.8 });
    svgEl(svg, "text", { x: (x1 + x2) / 2, y: y1 - 22, "text-anchor": "middle", class: "g-label" }).textContent = "R = " + R + " Ω";
    // จุดกระแส: จำนวนและความเร็วตามค่า I
    var n = Math.max(2, Math.min(14, Math.round(I * 2)));
    var perim = (x2 - x1) * 2 + (y2 - y1) * 2;
    var dur = Math.max(0.6, 6 / (1 + I));
    var path = "M " + x1 + " " + y1 + " L " + x2 + " " + y1 + " L " + x2 + " " + y2 + " L " + x1 + " " + y2 + " Z";
    for (var i = 0; i < n; i++) {
      var dot = svgEl(svg, "circle", { r: 5, class: "ball", cx: x1, cy: y1 });
      if (!reducedMotion()) {
        var am = svgEl(dot, "animateMotion", { dur: dur + "s", repeatCount: "indefinite", begin: (-(dur * i) / n) + "s", path: path });
        am.setAttribute("rotate", "0");
      } else {
        dot.setAttribute("cx", x1 + (perim * i) / n % (x2 - x1));
      }
    }
    svgEl(svg, "text", { x: (x1 + x2) / 2, y: y2 + 30, "text-anchor": "middle", class: "g-label" }).textContent = "I = " + I.toFixed(2) + " แอมแปร์  (ลูกศรกระแสไหลตามเข็มนาฬิกา)";
  }

  function ohmLaw(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var vc = config.voltage || { min: 1, max: 24, default: 12 };
    var rc = config.resistance || { min: 1, max: 20, default: 6 };
    var interacted = false;
    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }
    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 260",
      class: "plot",
      role: "img",
      "aria-label": "วงจรไฟฟ้าอย่างง่ายประกอบด้วยแบตเตอรี่และตัวต้านทาน จุดแสดงการไหลของกระแสไฟฟ้า",
    });
    var vF = field("แรงดันไฟฟ้า V =", "โวลต์", { min: vc.min, max: vc.max, value: vc.default }, function () { interact(); update(); });
    var rF = field("ความต้านทาน R =", "โอห์ม", { min: rc.min, max: rc.max, value: rc.default }, function () { interact(); update(); });
    var iOut = h("dd", { text: "-" }), pOut = h("dd", { text: "-" });
    function update() {
      var V = Number(vF.input.value), R = Number(rF.input.value);
      drawCircuit(svg, V, R);
      iOut.textContent = (V / R).toFixed(2) + " แอมแปร์";
      pOut.textContent = ((V * V) / R).toFixed(2) + " วัตต์";
    }
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [vF.root, rF.root]));
    container.appendChild(h("dl", { class: "results two", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "กระแสไฟฟ้า I = V/R" }), iOut]),
      h("div", null, [h("dt", { text: "กำลังไฟฟ้า P = VI" }), pOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "เพิ่ม V กระแสเพิ่มขึ้น เพิ่ม R กระแสลดลง จำนวนและความเร็วของจุดแสดงขนาดกระแสอย่างคร่าวๆ" }));
    update();
  }

  // ----------------------------------------------------------------- snell-law
  function snellLaw(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var ac = config.angle || { min: 0, max: 80, default: 40 };
    var n1c = config.n1 || { min: 1, max: 2, default: 1 };
    var n2c = config.n2 || { min: 1, max: 2, default: 1.5 };
    var interacted = false;
    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }
    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 340",
      class: "plot",
      role: "img",
      "aria-label": "รังสีแสงตกกระทบรอยต่อของตัวกลางสองชนิดแล้วหักเหหรือสะท้อนกลับหมด วัดมุมจากเส้นแนวฉาก",
    });
    var aF = field("มุมตกกระทบ θ₁ =", "องศา", { min: ac.min, max: ac.max, value: ac.default }, function () { interact(); update(); });
    var n1F = field("ดัชนีหักเหตัวกลางที่ 1 (n₁) =", "", { min: n1c.min, max: n1c.max, step: 0.05, value: n1c.default }, function () { interact(); update(); });
    var n2F = field("ดัชนีหักเหตัวกลางที่ 2 (n₂) =", "", { min: n2c.min, max: n2c.max, step: 0.05, value: n2c.default }, function () { interact(); update(); });
    var outAngle = h("dd", { text: "-" }), outKind = h("dd", { text: "-" });

    function update() {
      var deg = Number(aF.input.value), n1 = Number(n1F.input.value), n2 = Number(n2F.input.value);
      var a = (deg * Math.PI) / 180, s2 = (n1 * Math.sin(a)) / n2;
      var hx = 340, hy = 170, L = 150, s = Math.sin(a), c = Math.cos(a);
      clear(svg);
      svgEl(svg, "rect", { x: 40, y: 20, width: 600, height: 150, class: "g-line", fill: "none" });
      svgEl(svg, "rect", { x: 40, y: 170, width: 600, height: 150, class: "target", "fill-opacity": 0.25 });
      svgEl(svg, "line", { x1: 40, y1: hy, x2: 640, y2: hy, class: "mirror" });
      svgEl(svg, "line", { x1: hx, y1: 20, x2: hx, y2: 320, class: "normal" });
      svgEl(svg, "text", { x: 52, y: 44, class: "g-label" }).textContent = "ตัวกลางที่ 1  n₁ = " + n1.toFixed(2);
      svgEl(svg, "text", { x: 52, y: 306, class: "g-label" }).textContent = "ตัวกลางที่ 2  n₂ = " + n2.toFixed(2);
      svgEl(svg, "text", { x: hx + 8, y: 36, class: "g-label" }).textContent = "เส้นแนวฉาก";
      svgEl(svg, "line", { x1: hx - L * s, y1: hy - L * c, x2: hx, y2: hy, class: "ray" });
      svgEl(svg, "text", { x: hx - L * s - 6, y: hy - L * c + 4, "text-anchor": "end", class: "g-label" }).textContent = "รังสีตกกระทบ";
      var tir = s2 > 1, deg2 = 0;
      if (tir) {
        svgEl(svg, "line", { x1: hx, y1: hy, x2: hx + L * s, y2: hy - L * c, class: "ray" });
        svgEl(svg, "text", { x: hx + L * s + 6, y: hy - L * c + 4, class: "g-label" }).textContent = "สะท้อนกลับหมด";
        outAngle.textContent = "ไม่มีรังสีหักเห";
        outKind.textContent = "สะท้อนกลับหมด (sin θ₂ = " + s2.toFixed(2) + " > 1)";
      } else {
        var b = Math.asin(s2); deg2 = (b * 180) / Math.PI;
        svgEl(svg, "line", { x1: hx, y1: hy, x2: hx + L * Math.sin(b), y2: hy + L * Math.cos(b), class: "ray" });
        svgEl(svg, "text", { x: hx + L * Math.sin(b) + 6, y: hy + L * Math.cos(b) + 4, class: "g-label" }).textContent = "รังสีหักเห";
        if (deg > 0.5) svgEl(svg, "text", { x: hx + 12, y: hy + 40, class: "g-label" }).textContent = "θ₂ = " + deg2.toFixed(1) + "°";
        outAngle.textContent = deg2.toFixed(1) + " องศา";
        outKind.textContent = n2 > n1 ? "หักเหเข้าหาเส้นแนวฉาก" : n2 < n1 ? "หักเหออกจากเส้นแนวฉาก" : "ไม่หักเห (n เท่ากัน)";
      }
      if (deg > 0.5) svgEl(svg, "text", { x: hx - 12, y: hy - 40, "text-anchor": "end", class: "g-label" }).textContent = "θ₁ = " + deg + "°";
    }
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [aF.root, n1F.root, n2F.root]));
    container.appendChild(h("dl", { class: "results two", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "มุมหักเห θ₂" }), outAngle]),
      h("div", null, [h("dt", { text: "ผลที่เกิด" }), outKind]),
    ]));
    container.appendChild(h("p", { class: "note", text: "n₁ sin θ₁ = n₂ sin θ₂ มุมทั้งสองวัดจากเส้นแนวฉาก ถ้าแสงไปสู่ตัวกลางที่ n น้อยกว่าและมุมใหญ่พอ จะเกิดการสะท้อนกลับหมด" }));
    update();
  }

  // ------------------------------------------------------------- harmonic-wave
  function harmonicWave(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var fc = config.frequency || { min: 1, max: 10, default: 2 };
    var lc = config.wavelength || { min: 1, max: 10, default: 4 };
    var amc = config.amplitude || { min: 1, max: 5, default: 3 };
    var VBW = 680, VBH = 280, XMAX = 20, interacted = false;
    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }
    var svg = svgEl(null, "svg", {
      viewBox: "0 0 " + VBW + " " + VBH,
      class: "plot",
      role: "img",
      "aria-label": "กราฟคลื่นรูปไซน์ แกนนอนคือตำแหน่ง หน่วยเมตร แกนตั้งคือการกระจัด",
    });
    var fF = field("ความถี่ f =", "เฮิรตซ์", { min: fc.min, max: fc.max, step: 0.5, value: fc.default }, function () { interact(); update(); });
    var lF = field("ความยาวคลื่น λ =", "เมตร", { min: lc.min, max: lc.max, step: 0.5, value: lc.default }, function () { interact(); update(); });
    var aF = field("แอมพลิจูด A =", "เมตร", { min: amc.min, max: amc.max, step: 0.5, value: amc.default }, function () { interact(); update(); });
    var vOut = h("dd", { text: "-" }), tOut = h("dd", { text: "-" });
    function update() {
      var f = Number(fF.input.value), lam = Number(lF.input.value), A = Number(aF.input.value);
      var mid = VBH / 2, sx = (VBW - 60) / XMAX, sy = (mid - 30) / 5;
      clear(svg);
      svgEl(svg, "line", { x1: 30, y1: mid, x2: VBW - 30, y2: mid, class: "g-axis" });
      var pts = [];
      for (var i = 0; i <= 400; i++) {
        var x = (XMAX * i) / 400;
        pts.push((30 + x * sx).toFixed(1) + "," + (mid - A * sy * Math.sin((2 * Math.PI * x) / lam)).toFixed(1));
      }
      svgEl(svg, "polyline", { points: pts.join(" "), class: "path", fill: "none" });
      // แสดงช่วง λ จากยอดแรก
      var xs = 30 + (lam / 4) * sx, xe = xs + lam * sx;
      if (xe <= VBW - 30) {
        svgEl(svg, "line", { x1: xs, y1: mid - A * sy - 14, x2: xe, y2: mid - A * sy - 14, class: "arrow" });
        svgEl(svg, "text", { x: (xs + xe) / 2, y: mid - A * sy - 20, "text-anchor": "middle", class: "g-label" }).textContent = "λ = " + lam + " ม.";
      }
      svgEl(svg, "line", { x1: 30 + XMAX * sx - 20, y1: mid, x2: 30 + XMAX * sx - 20, y2: mid - A * sy, class: "normal" });
      svgEl(svg, "text", { x: 30 + XMAX * sx - 26, y: mid - (A * sy) / 2, "text-anchor": "end", class: "g-label" }).textContent = "A = " + A;
      vOut.textContent = (f * lam).toFixed(2) + " เมตร/วินาที";
      tOut.textContent = (1 / f).toFixed(3) + " วินาที";
    }
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [fF.root, lF.root, aF.root]));
    container.appendChild(h("dl", { class: "results two", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "อัตราเร็วคลื่น v = fλ" }), vOut]),
      h("div", null, [h("dt", { text: "คาบ T = 1/f" }), tOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "แอมพลิจูดไม่มีผลต่ออัตราเร็วคลื่น อัตราเร็วขึ้นกับ f และ λ เท่านั้น (ในตัวกลางเดียวกัน)" }));
    update();
  }

  // -------------------------------------------------------------- match-circuit
  function matchCircuit(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = Math.max(config.tolerance || 0.1, 0.1);
    var tr = config.targetCurrent || config.target || [0.6, 5.0];
    var vc = config.voltage || { min: 2, max: 24, default: 12 };
    var rc = config.resistance || { min: 1, max: 20, default: 8 };
    var target = 0, attempts = 0, won = false;
    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 260", class: "plot", role: "img", "aria-label": "วงจรไฟฟ้าอย่างง่ายสำหรับเกมปรับกระแสให้ตรงเป้า" });
    var vF = field("แรงดัน V =", "โวลต์", { min: vc.min, max: vc.max, step: 0.5, value: vc.default }, function () { preview(); });
    var rF = field("ความต้านทาน R =", "โอห์ม", { min: rc.min, max: rc.max, step: 0.5, value: rc.default }, function () { preview(); });
    var checkBtn = h("button", { type: "button", text: "ตรวจคำตอบ" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });
    function preview() { drawCircuit(svg, Number(vF.input.value), Number(rF.input.value)); }
    function pick() {
      // Guaranteed solvable: pick candidate V and R
      var cands = [];
      var curI = Number(vF.input.value) / Number(rF.input.value);
      for (var v = vc.min; v <= vc.max; v = Math.round((v + 0.5) * 10) / 10) {
        for (var r = rc.min; r <= rc.max; r = Math.round((r + 0.5) * 10) / 10) {
          var I = v / r;
          if (I >= tr[0] && I <= tr[1]) {
            if (Math.abs(I - curI) > tol * 1.5) {
              cands.push(Math.round(I * 10) / 10);
            }
          }
        }
      }
      if (cands.length > 0) {
        target = cands[Math.floor(Math.random() * cands.length)];
      } else {
        var midV = Math.round(((vc.min + vc.max) / 2) * 2) / 2;
        var midR = Math.round(((rc.min + rc.max) / 2) * 2) / 2;
        target = Math.round((midV / midR) * 10) / 10;
      }
      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: ปรับแรงดัน V และความต้านทาน R ให้ได้กระแส I = " + target.toFixed(1) + " แอมแปร์ (คลาดเคลื่อนไม่เกิน ±" + tol + " แอมแปร์)";
      msg.textContent = "เลื่อนแถบ V และ R แล้วกดตรวจคำตอบ";
      preview();
    }
    checkBtn.addEventListener("click", function () {
      var I = Number(vF.input.value) / Number(rF.input.value);
      attempts += 1;
      var diff = I - target;
      if (Math.abs(diff) <= tol) {
        msg.className = "game-msg ok";
        msg.textContent = "ถูกต้อง! ได้กระแส I = " + I.toFixed(2) + " แอมแปร์ ตรงเป้าหมายพอดี ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.className = "game-msg";
        msg.textContent = "ขณะนี้ได้ I = " + I.toFixed(2) + " แอมแปร์ " + (diff < 0 ? "น้อยไป " : "มากไป ") + Math.abs(diff).toFixed(2) + " แอมแปร์ ลองปรับ V หรือ R ใหม่ (ตรวจครั้งที่ " + attempts + ")";
      }
    });
    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [vF.root, rF.root]));
    container.appendChild(h("div", { class: "actions" }, [checkBtn, newBtn]));
    container.appendChild(msg);
    pick();
  }

  // ----------------------------------------------------------------- wave-tuner
  function waveTuner(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = Math.max(config.tolerance || 1.0, 1.0);
    var tr = config.targetSpeed || config.target || [5, 36];
    var fc = config.frequency || { min: 1, max: 10, default: 2 };
    var lc = config.wavelength || { min: 1, max: 10, default: 4 };
    var target = 0, attempts = 0, won = false;
    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 200", class: "plot", role: "img", "aria-label": "กราฟคลื่นไซน์ที่เปลี่ยนตามความถี่และความยาวคลื่นที่ผู้เล่นเลือก" });
    var fF = field("ความถี่ f =", "เฮิรตซ์", { min: fc.min, max: fc.max, step: 0.5, value: fc.default }, function () { preview(); });
    var lF = field("ความยาวคลื่น λ =", "เมตร", { min: lc.min, max: lc.max, step: 0.5, value: lc.default }, function () { preview(); });
    var tuneBtn = h("button", { type: "button", text: "จูนคลื่น" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });
    function preview() {
      var lam = Number(lF.input.value), freq = Number(fF.input.value), pts = [];
      var curSpeed = freq * lam;
      clear(svg);
      svgEl(svg, "line", { x1: 20, y1: 100, x2: 660, y2: 100, class: "g-axis" });
      for (var i = 0; i <= 320; i++) {
        var x = (20 * i) / 320;
        pts.push((20 + x * 32).toFixed(1) + "," + (100 - 60 * Math.sin((2 * Math.PI * x) / lam)).toFixed(1));
      }
      svgEl(svg, "polyline", { points: pts.join(" "), class: "path", fill: "none" });
      svgEl(svg, "text", { x: 340, y: 35, "text-anchor": "middle", class: "g-label" }).textContent = "ความเร็วคลื่นขณะนี้: v = f × λ = " + curSpeed.toFixed(1) + " ม./วิ (เป้าหมาย: " + target.toFixed(1) + " ม./วิ)";
    }
    function pick() {
      // Guaranteed solvable: pick candidate f and lambda
      var cands = [];
      var curV = Number(fF.input.value) * Number(lF.input.value);
      for (var f = fc.min; f <= fc.max; f = Math.round((f + 0.5) * 10) / 10) {
        for (var l = lc.min; l <= lc.max; l = Math.round((l + 0.5) * 10) / 10) {
          var v = Math.round((f * l) * 10) / 10;
          if (v >= tr[0] && v <= tr[1]) {
            if (Math.abs(v - curV) > tol * 1.5) {
              cands.push(v);
            }
          }
        }
      }
      if (cands.length > 0) {
        target = cands[Math.floor(Math.random() * cands.length)];
      } else {
        var midF = Math.round(((fc.min + fc.max) / 2) * 2) / 2;
        var midL = Math.round(((lc.min + lc.max) / 2) * 2) / 2;
        target = Math.round((midF * midL) * 10) / 10;
      }
      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: จูนคลื่นให้มีอัตราเร็ว v = " + target.toFixed(1) + " เมตร/วินาที (คลาดเคลื่อนไม่เกิน ±" + tol + " ม./วิ) โดย v = f × λ";
      msg.textContent = "ปรับความถี่ f และความยาวคลื่น λ แล้วกดจูนคลื่น";
      preview();
    }
    tuneBtn.addEventListener("click", function () {
      var v = Number(fF.input.value) * Number(lF.input.value);
      attempts += 1;
      var diff = v - target;
      if (Math.abs(diff) <= tol) {
        msg.className = "game-msg ok";
        msg.textContent = "จูนคลื่นสำเร็จ! ได้อัตราเร็ว v = " + v.toFixed(1) + " เมตร/วินาที ตรงเป้า ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.className = "game-msg";
        msg.textContent = "ขณะนี้ v = " + v.toFixed(1) + " ม./วิ " + (diff < 0 ? "ช้าไป " : "เร็วไป ") + Math.abs(diff).toFixed(1) + " ม./วิ ลองปรับ f หรือ λ ใหม่ (ครั้งที่ " + attempts + ")";
      }
    });
    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [fF.root, lF.root]));
    container.appendChild(h("div", { class: "actions" }, [tuneBtn, newBtn]));
    container.appendChild(msg);
    pick();
  }

  // ------------------------------------------------------------- newton-force
  function newtonForce(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var fc = config.force || { min: 0, max: 100, default: 40 };
    var mc = config.mass || { min: 1, max: 20, default: 5 };
    var muc = config.friction || { min: 0, max: 0.8, step: 0.05, default: 0.2 };
    var G = 9.8, interacted = false, frame = null;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 240",
      class: "plot",
      role: "img",
      "aria-label": "กล่องบนพื้นราบแสดงแรงดึง แรงเสียดทาน แรงแนวฉาก และน้ำหนัก",
    });

    var fF = field("แรงดึง F =", "นิวตัน", { min: fc.min, max: fc.max, value: fc.default }, function () { interact(); update(); });
    var mF = field("มวล m =", "กก.", { min: mc.min, max: mc.max, value: mc.default }, function () { interact(); update(); });
    var muF = field("สัมประสิทธิ์แรงเสียดทาน μ =", "", { min: muc.min, max: muc.max, step: muc.step || 0.05, value: muc.default }, function () { interact(); update(); });
    var testBtn = h("button", { type: "button", text: "ทดสอบการเคลื่อนที่" });

    var fOut = h("dd", { text: "-" }), fNetOut = h("dd", { text: "-" }), aOut = h("dd", { text: "-" });
    var boxOffset = 0;

    function stopAnim() { if (frame !== null) { cancelAnimationFrame(frame); frame = null; } }

    function update() {
      stopAnim();
      var F = Number(fF.input.value), m = Number(mF.input.value), mu = Number(muF.input.value);
      var N = m * G, maxFriction = mu * N;
      var f = F <= maxFriction ? F : maxFriction;
      var Fnet = F > maxFriction ? F - maxFriction : 0;
      var a = Fnet / m;

      clear(svg);
      var floorY = 170;
      svgEl(svg, "line", { x1: 20, y1: floorY, x2: 660, y2: floorY, class: "g-axis", "stroke-width": 3 });
      for (var hx = 30; hx <= 650; hx += 20) {
        svgEl(svg, "line", { x1: hx, y1: floorY, x2: hx - 10, y2: floorY + 10, class: "g-line" });
      }

      var bw = 90, bh = 60;
      var bx = 160 + boxOffset;
      var by = floorY - bh;
      svgEl(svg, "rect", { x: bx, y: by, width: bw, height: bh, class: "target", "fill-opacity": 0.8 });
      svgEl(svg, "text", { x: bx + bw / 2, y: by + bh / 2 + 6, "text-anchor": "middle", class: "g-label" }).textContent = m + " กก.";

      var arrowFLen = Math.min(160, Math.max(14, F * 1.6));
      if (F > 0) {
        drawArrow(svg, bx + bw, by + bh / 2, bx + bw + arrowFLen, by + bh / 2);
        svgEl(svg, "text", { x: bx + bw + arrowFLen / 2, y: by + bh / 2 - 8, "text-anchor": "middle", class: "g-label" }).textContent = "F = " + F + " N";
      }

      var arrowfLen = Math.min(140, Math.max(10, f * 1.6));
      if (f > 0) {
        drawArrow(svg, bx, floorY - 4, bx - arrowfLen, floorY - 4);
        svgEl(svg, "text", { x: bx - arrowfLen / 2, y: floorY - 10, "text-anchor": "middle", class: "g-label" }).textContent = "f = " + f.toFixed(1) + " N";
      }

      drawArrow(svg, bx + bw / 2, by, bx + bw / 2, by - 40);
      svgEl(svg, "text", { x: bx + bw / 2 + 8, y: by - 26, class: "g-label" }).textContent = "N = " + N.toFixed(1) + " N";
      drawArrow(svg, bx + bw / 2, floorY, bx + bw / 2, floorY + 45);
      svgEl(svg, "text", { x: bx + bw / 2 + 8, y: floorY + 36, class: "g-label" }).textContent = "W = mg = " + N.toFixed(1) + " N";

      fOut.textContent = f.toFixed(1) + " นิวตัน";
      fNetOut.textContent = Fnet.toFixed(1) + " นิวตัน";
      aOut.textContent = a.toFixed(2) + " ม./วิ²";
    }

    testBtn.addEventListener("click", function () {
      interact();
      var F = Number(fF.input.value), m = Number(mF.input.value), mu = Number(muF.input.value);
      var N = m * G, maxFriction = mu * N;
      var a = F > maxFriction ? (F - maxFriction) / m : 0;
      stopAnim();
      if (a <= 0) {
        boxOffset = 0;
        update();
        return;
      }
      if (reducedMotion()) {
        boxOffset = 220;
        update();
        return;
      }
      var tStart = performance.now();
      function step(now) {
        var t = (now - tStart) / 1000;
        var s = 0.5 * a * t * t * 24;
        if (s >= 220 || t >= 2.5) {
          boxOffset = 220;
          update();
          frame = null;
          return;
        }
        boxOffset = s;
        update();
        frame = requestAnimationFrame(step);
      }
      boxOffset = 0;
      frame = requestAnimationFrame(step);
    });

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [fF.root, mF.root, muF.root, testBtn]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "แรงเสียดทาน f" }), fOut]),
      h("div", null, [h("dt", { text: "แรงลัพธ์ F_net" }), fNetOut]),
      h("div", null, [h("dt", { text: "ความเร่ง a = F_net/m" }), aOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "F_net = F − μmg = ma ถ้าแรงดึง F ไม่ชนะแรงเสียดทานสถิตสูงสุด กล่องจะไม่เคลื่อนที่ (a = 0)" }));
    update();
  }

  // ------------------------------------------------------------- linear-motion
  function linearMotion(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var uc = config.speed || { min: 0, max: 30, default: 10 };
    var ac = config.acceleration || { min: -10, max: 10, step: 1, default: 2 };
    var tc = config.time || { min: 1, max: 10, step: 0.5, default: 4 };
    var interacted = false, frame = null;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 280",
      class: "plot",
      role: "img",
      "aria-label": "การเคลื่อนที่แนวตรงและกราฟความเร็วกับเวลา",
    });

    var uF = field("ความเร็วต้น u =", "ม./วิ", { min: uc.min, max: uc.max, value: uc.default }, function () { interact(); resetAnim(); });
    var aF = field("ความเร่ง a =", "ม./วิ²", { min: ac.min, max: ac.max, step: ac.step || 1, value: ac.default }, function () { interact(); resetAnim(); });
    var tF = field("เวลา t =", "วินาที", { min: tc.min, max: tc.max, step: tc.step || 0.5, value: tc.default }, function () { interact(); resetAnim(); });
    var playBtn = h("button", { type: "button", text: "เล่นการเคลื่อนที่" });

    var vOut = h("dd", { text: "-" }), sOut = h("dd", { text: "-" }), vAvgOut = h("dd", { text: "-" });
    var animT = null;

    function stopAnim() { if (frame !== null) { cancelAnimationFrame(frame); frame = null; } }
    function resetAnim() { stopAnim(); animT = null; update(); }

    function update() {
      var u = Number(uF.input.value), a = Number(aF.input.value), tTotal = Number(tF.input.value);
      var tCur = animT === null ? tTotal : animT;
      var vFinal = u + a * tTotal;
      var sFinal = u * tTotal + 0.5 * a * tTotal * tTotal;
      var sCur = u * tCur + 0.5 * a * tCur * tCur;

      clear(svg);

      var trackY = 55, trackX1 = 50, trackX2 = 630;
      svgEl(svg, "line", { x1: trackX1, y1: trackY, x2: trackX2, y2: trackY, class: "g-axis" });
      for (var d = 0; d <= 200; d += 50) {
        var tx = trackX1 + (d / 200) * (trackX2 - trackX1);
        svgEl(svg, "line", { x1: tx, y1: trackY - 5, x2: tx, y2: trackY + 5, class: "g-axis" });
        svgEl(svg, "text", { x: tx, y: trackY - 10, "text-anchor": "middle", class: "g-label", "font-size": "15px" }).textContent = d + " ม.";
      }
      var cartX = trackX1 + Math.max(0, Math.min(1, sCur / 200)) * (trackX2 - trackX1);
      svgEl(svg, "rect", { x: cartX - 18, y: trackY - 24, width: 36, height: 20, class: "ball", rx: 4 });
      svgEl(svg, "circle", { cx: cartX - 10, cy: trackY - 2, r: 4, class: "mark" });
      svgEl(svg, "circle", { cx: cartX + 10, cy: trackY - 2, r: 4, class: "mark" });
      svgEl(svg, "text", { x: cartX, y: trackY + 22, "text-anchor": "middle", class: "g-label", "font-size": "15px" }).textContent = "s = " + sCur.toFixed(1) + " ม.";

      var gx1 = 80, gx2 = 630, gy0 = 240, gyTop = 110;
      var maxV = Math.max(40, u + 5, vFinal + 5);
      var minV = Math.min(0, vFinal - 5);
      var vRange = Math.max(20, maxV - minV);
      function gvy(v) { return gy0 - ((v - minV) / vRange) * (gy0 - gyTop); }
      function gtx(t) { return gx1 + (t / 10) * (gx2 - gx1); }

      var yZero = gvy(0);
      svgEl(svg, "line", { x1: gx1, y1: yZero, x2: gx2, y2: yZero, class: "g-axis" });
      svgEl(svg, "line", { x1: gx1, y1: gyTop - 10, x2: gx1, y2: gy0 + 10, class: "g-axis" });
      svgEl(svg, "text", { x: gx2 + 10, y: yZero + 5, class: "g-label", "font-size": "15px" }).textContent = "t (วิ)";
      svgEl(svg, "text", { x: gx1 - 10, y: gyTop - 6, "text-anchor": "end", class: "g-label", "font-size": "15px" }).textContent = "v (ม./วิ)";

      var polyPoints = [
        gtx(0) + "," + yZero,
        gtx(0) + "," + gvy(u),
        gtx(tTotal) + "," + gvy(vFinal),
        gtx(tTotal) + "," + yZero,
      ];
      svgEl(svg, "polygon", { points: polyPoints.join(" "), class: "target", "fill-opacity": 0.25 });

      svgEl(svg, "line", { x1: gtx(0), y1: gvy(u), x2: gtx(tTotal), y2: gvy(vFinal), class: "ray" });
      svgEl(svg, "circle", { cx: gtx(0), cy: gvy(u), r: 4, class: "mark" });
      svgEl(svg, "circle", { cx: gtx(tTotal), cy: gvy(vFinal), r: 4, class: "mark" });
      svgEl(svg, "text", { x: gtx(0) - 8, y: gvy(u) + 5, "text-anchor": "end", class: "g-label", "font-size": "15px" }).textContent = "u = " + u;
      svgEl(svg, "text", { x: gtx(tTotal) + 8, y: gvy(vFinal) + 5, class: "g-label", "font-size": "15px" }).textContent = "v = " + vFinal.toFixed(1);

      vOut.textContent = vFinal.toFixed(1) + " ม./วิ";
      sOut.textContent = sFinal.toFixed(1) + " ม.";
      vAvgOut.textContent = ((u + vFinal) / 2).toFixed(1) + " ม./วิ";
    }

    playBtn.addEventListener("click", function () {
      interact();
      stopAnim();
      var tTotal = Number(tF.input.value);
      if (reducedMotion()) { resetAnim(); return; }
      var tStart = performance.now();
      function step(now) {
        var elapsed = (now - tStart) / 1000;
        if (elapsed >= tTotal) {
          animT = null;
          update();
          frame = null;
          return;
        }
        animT = elapsed;
        update();
        frame = requestAnimationFrame(step);
      }
      animT = 0;
      frame = requestAnimationFrame(step);
    });

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [uF.root, aF.root, tF.root, playBtn]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ความเร็วปลาย v = u+at" }), vOut]),
      h("div", null, [h("dt", { text: "การกระจัด s = ut+½at²" }), sOut]),
      h("div", null, [h("dt", { text: "ความเร็วเฉลี่ย (u+v)/2" }), vAvgOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "สมการการเคลื่อนที่แนวตรงความเร่งคงตัว: v = u + at และ s = ut + ½at² (พื้นที่แรเงาใต้กราฟ v-t คือการกระจัด s)" }));
    update();
  }

  // -------------------------------------------------------- momentum-collision
  function momentumCollision(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var m1c = config.m1 || { min: 1, max: 10, default: 2 };
    var u1c = config.u1 || { min: 0, max: 10, default: 6 };
    var m2c = config.m2 || { min: 1, max: 10, default: 3 };
    var u2c = config.u2 || { min: -10, max: 5, default: -2 };
    var interacted = false, frame = null;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 230",
      class: "plot",
      role: "img",
      "aria-label": "การชนของวัตถุสองก้อนในหนึ่งมิติ",
    });

    var m1F = field("มวลก้อน 1 (m₁) =", "กก.", { min: m1c.min, max: m1c.max, value: m1c.default }, function () { interact(); resetAnim(); });
    var u1F = field("ความเร็วต้น 1 (u₁) =", "ม./วิ", { min: u1c.min, max: u1c.max, value: u1c.default }, function () { interact(); resetAnim(); });
    var m2F = field("มวลก้อน 2 (m₂) =", "กก.", { min: m2c.min, max: m2c.max, value: m2c.default }, function () { interact(); resetAnim(); });
    var u2F = field("ความเร็วต้น 2 (u₂) =", "ม./วิ", { min: u2c.min, max: u2c.max, value: u2c.default }, function () { interact(); resetAnim(); });

    var stickId = "lp-f" + (++uid);
    var stickBox = h("input", { id: stickId, type: "checkbox" });
    stickBox.addEventListener("change", function () { interact(); resetAnim(); });
    var stickRow = h("div", { class: "field check" }, [stickBox, h("label", { for: stickId, text: "ชนแล้วติดกันไป (Inelastic)" })]);
    var collideBtn = h("button", { type: "button", text: "จำลองการชน" });

    var pOut = h("dd", { text: "-" }), v1Out = h("dd", { text: "-" }), v2Out = h("dd", { text: "-" }), ekOut = h("dd", { text: "-" });
    var animProgress = null;

    function stopAnim() { if (frame !== null) { cancelAnimationFrame(frame); frame = null; } }
    function resetAnim() { stopAnim(); animProgress = null; update(); }

    function update() {
      var m1 = Number(m1F.input.value), u1 = Number(u1F.input.value);
      var m2 = Number(m2F.input.value), u2 = Number(u2F.input.value);
      var sticky = stickBox.checked;

      var v1, v2;
      if (sticky) {
        v1 = (m1 * u1 + m2 * u2) / (m1 + m2);
        v2 = v1;
      } else {
        v1 = ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2);
        v2 = (2 * m1 * u1 + (m2 - m1) * u2) / (m1 + m2);
      }

      var pTotal = m1 * u1 + m2 * u2;
      var ekAfter = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;

      clear(svg);

      var floorY = 160;
      svgEl(svg, "line", { x1: 30, y1: floorY, x2: 650, y2: floorY, class: "g-axis", "stroke-width": 3 });

      var r1 = 18 + m1 * 2, r2 = 18 + m2 * 2;
      var contactX = 340;
      var startX1 = 150, startX2 = 530;

      var pos1, pos2, showV1, showV2;
      if (animProgress === null || animProgress < 0.5) {
        var frac = animProgress === null ? 0 : animProgress * 2;
        pos1 = startX1 + frac * (contactX - r1 - startX1);
        pos2 = startX2 - frac * (startX2 - (contactX + r2));
        showV1 = u1; showV2 = u2;
      } else {
        var fracAfter = (animProgress - 0.5) * 2;
        pos1 = (contactX - r1) + fracAfter * (v1 * 25);
        pos2 = (contactX + r2) + fracAfter * (v2 * 25);
        showV1 = v1; showV2 = v2;
      }

      svgEl(svg, "circle", { cx: pos1, cy: floorY - r1, r: r1, class: "charge-neg" });
      svgEl(svg, "text", { x: pos1, y: floorY - r1 + 6, "text-anchor": "middle", class: "charge-sign", "font-size": "18px" }).textContent = m1 + "k";

      svgEl(svg, "circle", { cx: pos2, cy: floorY - r2, r: r2, class: "charge-pos" });
      svgEl(svg, "text", { x: pos2, y: floorY - r2 + 6, "text-anchor": "middle", class: "charge-sign", "font-size": "18px" }).textContent = m2 + "k";

      if (Math.abs(showV1) > 0.1) {
        var a1Len = showV1 * 8;
        drawArrow(svg, pos1, floorY - r1 - r1 - 10, pos1 + a1Len, floorY - r1 - r1 - 10);
        svgEl(svg, "text", { x: pos1, y: floorY - r1 - r1 - 18, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "v₁ = " + showV1.toFixed(1);
      }
      if (Math.abs(showV2) > 0.1) {
        var a2Len = showV2 * 8;
        drawArrow(svg, pos2, floorY - r2 - r2 - 10, pos2 + a2Len, floorY - r2 - r2 - 10);
        svgEl(svg, "text", { x: pos2, y: floorY - r2 - r2 - 18, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "v₂ = " + showV2.toFixed(1);
      }

      pOut.textContent = pTotal.toFixed(1) + " กก.·ม./วิ";
      v1Out.textContent = v1.toFixed(2) + " ม./วิ";
      v2Out.textContent = v2.toFixed(2) + " ม./วิ";
      ekOut.textContent = ekAfter.toFixed(1) + " จูล";
    }

    collideBtn.addEventListener("click", function () {
      interact();
      stopAnim();
      if (reducedMotion()) { animProgress = 1; update(); return; }
      var start = performance.now(), duration = 1600;
      function step(now) {
        var p = (now - start) / duration;
        if (p >= 1) { animProgress = 1; update(); frame = null; return; }
        animProgress = p;
        update();
        frame = requestAnimationFrame(step);
      }
      animProgress = 0;
      frame = requestAnimationFrame(step);
    });

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [m1F.root, u1F.root, m2F.root, u2F.root, stickRow, collideBtn]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "โมเมนตัมรวมก่อนชน" }), pOut]),
      h("div", null, [h("dt", { text: "ความเร็ว 1 หลังชน v₁" }), v1Out]),
      h("div", null, [h("dt", { text: "ความเร็ว 2 หลังชน v₂" }), v2Out]),
    ]));
    container.appendChild(h("p", { class: "note", text: "กฎการอนุรักษ์โมเมนตัม m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂ ถ้าชนแบบยืดหยุ่น พลังงานจลน์จะคงที่ด้วย (Ek = " + ekOut.textContent + ")" }));
    update();
  }

  // ------------------------------------------------------------ circular-shm
  function circularShm(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var mc = config.mass || { min: 0.5, max: 10, step: 0.5, default: 2 };
    var rc = config.radius || { min: 0.5, max: 4, step: 0.5, default: 2 };
    var kc = config.springK || { min: 8, max: 80, step: 4, default: 32 };
    var interacted = false, frame = null;
    var isVisible = true;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 270",
      class: "plot",
      role: "img",
      "aria-label": "การเปรียบเทียบการเคลื่อนที่แบบวงกลมสม่ำเสมอกับการสั่นแบบฮาร์มอนิกอย่างง่าย",
    });

    var mF = field("มวล m =", "กก.", { min: mc.min, max: mc.max, step: mc.step || 0.5, value: mc.default }, function () { interact(); update(); });
    var rF = field("รัศมี / แอมพลิจูด r =", "เมตร", { min: rc.min, max: rc.max, step: rc.step || 0.5, value: rc.default }, function () { interact(); update(); });
    var kF = field("ค่าคงตัวสปริง k =", "น./ม.", { min: kc.min, max: kc.max, step: kc.step || 4, value: kc.default }, function () { interact(); update(); });

    var fcOut = h("dd", { text: "-" }), tOut = h("dd", { text: "-" }), fOut = h("dd", { text: "-" });
    var angle = 0, lastTime = null;

    function renderFrame(theta) {
      var m = Number(mF.input.value), r = Number(rF.input.value), k = Number(kF.input.value);
      var w = Math.sqrt(k / m);
      var T = (2 * Math.PI) / w;
      var f = 1 / T;
      var Fc = m * w * w * r;

      clear(svg);

      var cx = 180, cy = 135, pixR = 25 + r * 22;

      svgEl(svg, "circle", { cx: cx, cy: cy, r: pixR, class: "g-line", fill: "none", "stroke-dasharray": "4 4" });
      svgEl(svg, "line", { x1: cx - pixR - 20, y1: cy, x2: cx + pixR + 20, y2: cy, class: "g-axis", opacity: 0.4 });
      svgEl(svg, "line", { x1: cx, y1: cy - pixR - 20, x2: cx, y2: cy + pixR + 20, class: "g-axis", opacity: 0.4 });

      var px = cx + pixR * Math.cos(theta);
      var py = cy - pixR * Math.sin(theta);

      svgEl(svg, "line", { x1: cx, y1: cy, x2: px, y2: py, class: "g-axis" });
      drawArrow(svg, px, py, px - 0.4 * pixR * Math.cos(theta), py + 0.4 * pixR * Math.sin(theta));
      drawArrow(svg, px, py, px - 0.3 * pixR * Math.sin(theta), py - 0.3 * pixR * Math.cos(theta));

      svgEl(svg, "circle", { cx: px, cy: py, r: 8, class: "ball" });
      svgEl(svg, "text", { x: cx, y: 30, "text-anchor": "middle", class: "g-label" }).textContent = "การเคลื่อนที่แบบวงกลม (Fc = " + Fc.toFixed(1) + " N)";

      var sx = 480;
      var shmY = cy - pixR * Math.sin(theta);
      svgEl(svg, "line", { x1: sx - 70, y1: 40, x2: sx + 70, y2: 40, class: "g-axis", "stroke-width": 3 });

      var springTop = 40, coils = 12;
      var sPoints = [sx + "," + springTop];
      for (var i = 1; i <= coils; i++) {
        var segY = springTop + ((shmY - 14 - springTop) * i) / (coils + 1);
        var segX = sx + (i % 2 === 0 ? 12 : -12);
        sPoints.push(segX + "," + segY.toFixed(1));
      }
      sPoints.push(sx + "," + (shmY - 14));
      svgEl(svg, "polyline", { points: sPoints.join(" "), class: "path", fill: "none" });

      svgEl(svg, "rect", { x: sx - 20, y: shmY - 14, width: 40, height: 28, class: "target" });
      svgEl(svg, "text", { x: sx, y: shmY + 4, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = m + "kg";

      svgEl(svg, "line", { x1: px, y1: py, x2: sx - 20, y2: shmY, class: "normal" });
      svgEl(svg, "text", { x: sx, y: 30, "text-anchor": "middle", class: "g-label" }).textContent = "SHM สปริง (T = " + T.toFixed(2) + " s)";

      fcOut.textContent = Fc.toFixed(1) + " นิวตัน";
      tOut.textContent = T.toFixed(2) + " วินาที";
      fOut.textContent = f.toFixed(2) + " เฮิรตซ์";
    }

    function loop(now) {
      if (!isVisible) {
        frame = null;
        return;
      }
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      var m = Number(mF.input.value), k = Number(kF.input.value);
      var w = Math.sqrt(k / m);
      angle += w * dt;
      renderFrame(angle);
      frame = requestAnimationFrame(loop);
    }

    function update() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      if (reducedMotion()) {
        renderFrame(Math.PI / 4);
        return;
      }
      if (!isVisible) {
        renderFrame(angle);
        return;
      }
      lastTime = performance.now();
      frame = requestAnimationFrame(loop);
    }

    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var wasVisible = isVisible;
          isVisible = entry.isIntersecting;
          if (isVisible && !wasVisible && !reducedMotion()) {
            lastTime = performance.now();
            if (frame === null) frame = requestAnimationFrame(loop);
          } else if (!isVisible && frame !== null) {
            cancelAnimationFrame(frame);
            frame = null;
          }
        });
      });
      observer.observe(svg);
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [mF.root, rF.root, kF.root]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "แรงสู่ศูนย์กลาง Fc" }), fcOut]),
      h("div", null, [h("dt", { text: "คาบ T = 2π√(m/k)" }), tOut]),
      h("div", null, [h("dt", { text: "ความถี่ f = 1/T" }), fOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "Fc = mv²/r และ T = 2π√(m/k) สังเกตว่าการสั่น SHM ของสปริงคือภาพฉายเงา 1 มิติของการเคลื่อนที่แบบวงกลม" }));
    update();
  }

  // ------------------------------------------------------------ fluid-pressure
  function fluidPressure(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var rhoc = config.density || { min: 600, max: 1400, step: 50, default: 1000 };
    var hc = config.depth || { min: 0.5, max: 8, step: 0.5, default: 3 };
    var obc = config.objectDensity || { min: 400, max: 1600, step: 50, default: 800 };
    var G = 9.8, P0 = 101.3;
    var interacted = false;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 280",
      class: "plot",
      role: "img",
      "aria-label": "ถังของเหลวแสดงความดันที่ระดับความลึกและแรงพยุงของวัตถุ",
    });

    var rhoF = field("ความหนาแน่นของเหลว ρ =", "กก./ม.³", { min: rhoc.min, max: rhoc.max, step: rhoc.step || 50, value: rhoc.default }, function () { interact(); update(); });
    var hF = field("ความลึกของจุดวัด h =", "เมตร", { min: hc.min, max: hc.max, step: hc.step || 0.5, value: hc.default }, function () { interact(); update(); });
    var obF = field("ความหนาแน่นวัตถุ ρ_obj =", "กก./ม.³", { min: obc.min, max: obc.max, step: obc.step || 50, value: obc.default }, function () { interact(); update(); });

    var pgOut = h("dd", { text: "-" }), pTotOut = h("dd", { text: "-" }), fbOut = h("dd", { text: "-" });

    function update() {
      var rho = Number(rhoF.input.value), h = Number(hF.input.value), rhoObj = Number(obF.input.value);
      var Pgauge = (rho * G * h) / 1000;
      var Ptotal = P0 + Pgauge;

      var V0 = 0.02, massObj = rhoObj * V0, weightObj = massObj * G;
      var FB, subFrac, statusTxt;
      if (rhoObj <= rho) {
        subFrac = rhoObj / rho;
        FB = weightObj;
        statusTxt = "ลอยตัว (จม " + (subFrac * 100).toFixed(0) + "% ของก้อน)";
      } else {
        subFrac = 1.0;
        FB = rho * V0 * G;
        statusTxt = "จมลงสู่ก้นภาชนะ (ρ_obj > ρ)";
      }

      clear(svg);

      var tankX = 60, tankW = 560, tankTopY = 60, tankBottomY = 240, tankH = tankBottomY - tankTopY;
      var waterColor = "rgba(47, 91, 234, " + (0.15 + (rho / 2000) * 0.35) + ")";

      svgEl(svg, "rect", { x: tankX, y: tankTopY, width: tankW, height: tankH, fill: waterColor, stroke: "none" });
      svgEl(svg, "line", { x1: tankX, y1: tankTopY, x2: tankX + tankW, y2: tankTopY, class: "ray" });
      svgEl(svg, "polyline", { points: tankX + "," + tankTopY + " " + tankX + "," + tankBottomY + " " + (tankX + tankW) + "," + tankBottomY + " " + (tankX + tankW) + "," + tankTopY, class: "g-axis", fill: "none", "stroke-width": 3 });

      svgEl(svg, "text", { x: tankX + 16, y: tankTopY - 12, class: "g-label", "font-size": "15px" }).textContent = "ผิวน้ำ P₀ = 101.3 kPa";

      var sensorY = tankTopY + (h / 8) * tankH;
      svgEl(svg, "line", { x1: tankX + 50, y1: tankTopY, x2: tankX + 50, y2: sensorY, class: "arrow" });
      drawArrow(svg, tankX + 50, sensorY - 10, tankX + 50, sensorY);
      svgEl(svg, "circle", { cx: tankX + 50, cy: sensorY, r: 6, class: "mark" });
      svgEl(svg, "line", { x1: tankX + 50, y1: sensorY, x2: tankX + 180, y2: sensorY, class: "normal" });
      svgEl(svg, "text", { x: tankX + 190, y: sensorY + 5, class: "g-label", "font-size": "15px" }).textContent = "h = " + h + " m (P = " + Ptotal.toFixed(1) + " kPa)";

      var objW = 60, objH = 60;
      var objX = tankX + 380;
      var objY = rhoObj <= rho ? tankTopY - (1 - subFrac) * objH : tankBottomY - objH;

      svgEl(svg, "rect", { x: objX, y: objY, width: objW, height: objH, class: "target", rx: 3 });
      svgEl(svg, "text", { x: objX + objW / 2, y: objY + objH / 2 + 5, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = rhoObj + " kg/m³";

      var fbTipY = Math.max(18, objY - 35);
      drawArrow(svg, objX + objW / 2, objY, objX + objW / 2, fbTipY);
      var fbLabelY = Math.max(26, objY - 20);
      svgEl(svg, "text", { x: objX + objW / 2 + 6, y: fbLabelY, class: "g-label", "font-size": "14px" }).textContent = "F_B=" + FB.toFixed(1) + "N";
      drawArrow(svg, objX + objW / 2, objY + objH, objX + objW / 2, objY + objH + 35);
      svgEl(svg, "text", { x: objX + objW / 2 + 6, y: objY + objH + 28, class: "g-label", "font-size": "14px" }).textContent = "W=" + weightObj.toFixed(1) + "N";

      svgEl(svg, "text", { x: objX + objW / 2, y: tankBottomY + 24, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = statusTxt;

      pgOut.textContent = Pgauge.toFixed(1) + " kPa";
      pTotOut.textContent = Ptotal.toFixed(1) + " kPa";
      fbOut.textContent = FB.toFixed(1) + " นิวตัน";
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [rhoF.root, hF.root, obF.root]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ความดันเกจ ρgh" }), pgOut]),
      h("div", null, [h("dt", { text: "ความดันสัมบูรณ์ P = P₀+ρgh" }), pTotOut]),
      h("div", null, [h("dt", { text: "แรงพยุง F_B = ρVg" }), fbOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "ความดันของไหล P = P₀ + ρgh และแรงพยุงตามหลักอาร์คิมิดิส F_B = ρVg (ถ้า ρ_obj < ρ วัตถุจะลอยตัวที่สมดุล F_B = W)" }));
    update();
  }

  // ----------------------------------------------------------------- ideal-gas
  function idealGas(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tc = config.temperature || { min: 200, max: 600, step: 20, default: 300 };
    var vc = config.volume || { min: 2, max: 10, step: 0.5, default: 5 };
    var nc = config.moles || { min: 0.5, max: 3.0, step: 0.5, default: 1.0 };
    var R = 8.314, interacted = false, frame = null;
    var isVisible = true;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 270",
      class: "plot",
      role: "img",
      "aria-label": "กระบอกสูบแก๊สอุดมคติ อนุภาคแก๊สที่เคลื่อนที่ และลูกสูบ",
    });

    var tF = field("อุณหภูมิ T =", "เคลวิน (K)", { min: tc.min, max: tc.max, step: tc.step || 20, value: tc.default }, function () { interact(); update(); });
    var vF = field("ปริมาตร V =", "ลิตร", { min: vc.min, max: vc.max, step: vc.step || 0.5, value: vc.default }, function () { interact(); update(); });
    var nF = field("จำนวนโมล n =", "โมล", { min: nc.min, max: nc.max, step: nc.step || 0.5, value: nc.default }, function () { interact(); update(); });

    var pOut = h("dd", { text: "-" }), uOut = h("dd", { text: "-" }), pvOut = h("dd", { text: "-" });

    var particles = [];
    for (var i = 0; i < 22; i++) {
      particles.push({
        x: 0.1 + Math.random() * 0.8,
        y: 0.1 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }

    var lastNow = null;

    function render(dt) {
      var T = Number(tF.input.value), V = Number(vF.input.value), n = Number(nF.input.value);
      var P = (n * R * T) / V;
      var U = 1.5 * n * R * T;

      clear(svg);

      var cylLeft = 80, cylTop = 60, cylBottom = 200, cylHeight = cylBottom - cylTop;
      var maxW = 440;
      var pistonX = cylLeft + (V / 10) * maxW;

      svgEl(svg, "polyline", { points: (cylLeft + maxW + 20) + "," + cylTop + " " + cylLeft + "," + cylTop + " " + cylLeft + "," + cylBottom + " " + (cylLeft + maxW + 20) + "," + cylBottom, class: "g-axis", fill: "none", "stroke-width": 3 });
      svgEl(svg, "rect", { x: pistonX, y: cylTop + 2, width: 14, height: cylHeight - 4, class: "target" });
      svgEl(svg, "line", { x1: pistonX + 14, y1: cylTop + cylHeight / 2, x2: pistonX + 90, y2: cylTop + cylHeight / 2, class: "arrow", "stroke-width": 6 });

      var speedScale = Math.sqrt(T / 300);
      particles.forEach(function (pt) {
        if (!reducedMotion() && dt > 0) {
          pt.x += (pt.vx * speedScale * dt * 0.8);
          pt.y += (pt.vy * speedScale * dt * 0.8);
          if (pt.x < 0.02) { pt.x = 0.02; pt.vx = Math.abs(pt.vx); }
          if (pt.x > 0.98) { pt.x = 0.98; pt.vx = -Math.abs(pt.vx); }
          if (pt.y < 0.05) { pt.y = 0.05; pt.vy = Math.abs(pt.vy); }
          if (pt.y > 0.95) { pt.y = 0.95; pt.vy = -Math.abs(pt.vy); }
        }
        var px = cylLeft + 6 + pt.x * (pistonX - cylLeft - 12);
        var py = cylTop + 6 + pt.y * (cylHeight - 12);
        svgEl(svg, "circle", { cx: px, cy: py, r: 4, class: "ball" });
      });

      var flameCenter = cylLeft + (pistonX - cylLeft) / 2;
      var flameH = 10 + (T / 600) * 25;
      svgEl(svg, "polygon", {
        points: (flameCenter - 25) + "," + (cylBottom + 18) + " " + flameCenter + "," + (cylBottom + 18 - flameH) + " " + (flameCenter + 25) + "," + (cylBottom + 18),
        fill: "orange",
        stroke: "var(--ball)",
      });
      svgEl(svg, "text", { x: flameCenter, y: cylBottom + 34, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "T = " + T + " K";

      svgEl(svg, "text", { x: 570, y: 80, "text-anchor": "middle", class: "g-label" }).textContent = "เกจวัดความดัน";
      svgEl(svg, "circle", { cx: 570, cy: 130, r: 38, class: "target", "fill-opacity": 0.2 });
      var gaugeAngle = -Math.PI * 0.75 + (Math.min(P, 800) / 800) * (Math.PI * 1.5);
      svgEl(svg, "line", { x1: 570, y1: 130, x2: 570 + 30 * Math.cos(gaugeAngle), y2: 130 + 30 * Math.sin(gaugeAngle), class: "ray" });
      svgEl(svg, "text", { x: 570, y: 190, "text-anchor": "middle", class: "g-label", "font-size": "15px" }).textContent = P.toFixed(1) + " kPa";

      pOut.textContent = P.toFixed(1) + " kPa";
      uOut.textContent = U.toFixed(0) + " จูล";
      pvOut.textContent = (n * R).toFixed(2) + " J/K";
    }

    function loop(now) {
      if (!isVisible) {
        frame = null;
        return;
      }
      var dt = (now - lastNow) / 1000;
      lastNow = now;
      render(Math.min(0.05, dt));
      frame = requestAnimationFrame(loop);
    }

    function update() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      if (reducedMotion()) {
        render(0);
        return;
      }
      if (!isVisible) {
        render(0);
        return;
      }
      lastNow = performance.now();
      frame = requestAnimationFrame(loop);
    }

    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var wasVisible = isVisible;
          isVisible = entry.isIntersecting;
          if (isVisible && !wasVisible && !reducedMotion()) {
            lastNow = performance.now();
            if (frame === null) frame = requestAnimationFrame(loop);
          } else if (!isVisible && frame !== null) {
            cancelAnimationFrame(frame);
            frame = null;
          }
        });
      });
      observer.observe(svg);
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [tF.root, vF.root, nF.root]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ความดันแก๊ส P = nRT/V" }), pOut]),
      h("div", null, [h("dt", { text: "พลังงานภายใน U = 3/2 nRT" }), uOut]),
      h("div", null, [h("dt", { text: "ค่าคงตัว nR = PV/T" }), pvOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "PV = nRT และพลังงานภายในแก๊สอะตอมเดี่ยว U = 3/2 nRT (เมื่ออุณหภูมิเพิ่มขึ้น อนุภาคแก๊สวิ่งเร็วขึ้นและชนผนังบ่อยขึ้น เกิดความดันสูงขึ้น)" }));
    update();
  }

  // ----------------------------------------------------------------- thin-lens
  function thinLens(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var sc = config.objectDistance || { min: 10, max: 60, step: 1, default: 30 };
    var fc = config.focalLength || { min: 8, max: 25, step: 1, default: 15 };
    var interacted = false;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 280",
      class: "plot",
      role: "img",
      "aria-label": "แผนภาพรังสีของเลนส์บาง แสดงระยะวัตถุ จุดโฟกัส และระยะภาพ",
    });

    var sF = field("ระยะวัตถุ s =", "ซม.", { min: sc.min, max: sc.max, step: sc.step || 1, value: sc.default }, function () { interact(); update(); });
    var fF = field("ความยาวโฟกัส f =", "ซม.", { min: fc.min, max: fc.max, step: fc.step || 1, value: fc.default }, function () { interact(); update(); });

    var concaveId = "lp-f" + (++uid);
    var concaveBox = h("input", { id: concaveId, type: "checkbox" });
    if (config.isConcave) concaveBox.checked = true;
    concaveBox.addEventListener("change", function () { interact(); update(); });
    var concaveRow = h("div", { class: "field check" }, [concaveBox, h("label", { for: concaveId, text: "เลนส์เว้า (Concave Lens)" })]);

    var spOut = h("dd", { text: "-" }), mOut = h("dd", { text: "-" }), kindOut = h("dd", { text: "-" });

    function update() {
      var s = Number(sF.input.value), fVal = Number(fF.input.value);
      var isConcave = concaveBox.checked;
      var F = isConcave ? -fVal : fVal;

      clear(svg);

      var midX = 340, midY = 140;
      var scale = 4.5;

      svgEl(svg, "line", { x1: 20, y1: midY, x2: 660, y2: midY, class: "g-axis" });
      svgEl(svg, "line", { x1: midX, y1: 25, x2: midX, y2: 255, class: "mirror" });
      svgEl(svg, "polyline", { points: (midX - 8) + ",35 " + midX + ",25 " + (midX + 8) + ",35", class: "g-axis", fill: "none", "stroke-width": 2 });
      svgEl(svg, "polyline", { points: (midX - 8) + ",245 " + midX + ",255 " + (midX + 8) + ",245", class: "g-axis", fill: "none", "stroke-width": 2 });
      svgEl(svg, "text", { x: midX, y: 20, "text-anchor": "middle", class: "g-label", "font-size": "15px" }).textContent = isConcave ? "เลนส์เว้า" : "เลนส์นูน";

      var fPix = Math.abs(F) * scale;
      svgEl(svg, "circle", { cx: midX - fPix, cy: midY, r: 4, class: "mark" });
      svgEl(svg, "circle", { cx: midX + fPix, cy: midY, r: 4, class: "mark" });
      svgEl(svg, "text", { x: midX - fPix, y: midY + 18, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "F";
      svgEl(svg, "text", { x: midX + fPix, y: midY + 18, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "F'";

      var objX = midX - s * scale;
      var objH = 45;
      svgEl(svg, "line", { x1: objX, y1: midY, x2: objX, y2: midY - objH, class: "ray" });
      svgEl(svg, "polygon", { points: objX + "," + (midY - objH - 8) + " " + (objX - 5) + "," + (midY - objH) + " " + (objX + 5) + "," + (midY - objH), class: "arrow-head" });
      svgEl(svg, "text", { x: objX, y: midY + 18, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "วัตถุ";

      var sDiff = s - F;
      if (Math.abs(s - fVal) < 0.01 && !isConcave) {
        spOut.textContent = "ระยะอนันต์ (∞)";
        mOut.textContent = "-";
        kindOut.textContent = "รังสีขนานกัน (เกิดภาพที่ระยะอนันต์)";

        var extX = Math.min(640, midX + fPix * 2.5);
        var extY1 = (midY - objH) + ((extX - midX) / fPix) * objH;
        var extY2 = midY + ((extX - midX) / fPix) * objH;

        // รังสีเส้นที่ 1: ขนานแกนมุขสำคัญแล้วหักเหผ่านจุดโฟกัส F
        svgEl(svg, "line", { x1: objX, y1: midY - objH, x2: midX, y2: midY - objH, class: "ray" });
        svgEl(svg, "line", { x1: midX, y1: midY - objH, x2: extX, y2: extY1, class: "ray" });

        // รังสีเส้นที่ 2: ผ่านจุดศูนย์กลางเลนส์ (midX, midY)
        svgEl(svg, "line", { x1: objX, y1: midY - objH, x2: extX, y2: extY2, class: "ray" });

        svgEl(svg, "text", { x: midX + 150, y: midY - 35, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "รังสีขนานกัน (เกิดภาพที่ระยะอนันต์)";
        return;
      }

      var sp = (s * F) / sDiff;
      var m = -sp / s;
      var imgH = objH * m;
      var imgX = midX + sp * scale;

      svgEl(svg, "line", { x1: objX, y1: midY - objH, x2: midX, y2: midY - objH, class: "ray" });
      if (isConcave) {
        svgEl(svg, "line", { x1: midX, y1: midY - objH, x2: midX + 160, y2: (midY - objH) - (160 / fPix) * objH, class: "ray" });
        svgEl(svg, "line", { x1: midX - fPix, y1: midY, x2: midX, y2: midY - objH, class: "normal" });
      } else {
        svgEl(svg, "line", { x1: midX, y1: midY - objH, x2: midX + fPix * 2, y2: midY + objH, class: "ray" });
      }
      svgEl(svg, "line", { x1: objX, y1: midY - objH, x2: midX + (midX - objX), y2: midY + objH, class: "ray" });

      if (imgX > 20 && imgX < 660) {
        var isReal = sp > 0;
        var strokeStyle = isReal ? "var(--ball)" : "var(--muted)";
        var dash = isReal ? "" : "6 4";
        svgEl(svg, "line", { x1: imgX, y1: midY, x2: imgX, y2: midY - imgH, stroke: strokeStyle, "stroke-width": 3, "stroke-dasharray": dash });
        var tipY = midY - imgH;
        var dir = imgH >= 0 ? -1 : 1;
        svgEl(svg, "polygon", {
          points: imgX + "," + (tipY + dir * 8) + " " + (imgX - 5) + "," + tipY + " " + (imgX + 5) + "," + tipY,
          fill: strokeStyle,
        });
        svgEl(svg, "text", { x: imgX, y: midY + (isReal ? 18 : 32), "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = isReal ? "ภาพจริง" : "ภาพเสมือน";
      }

      spOut.textContent = (sp > 0 ? "+" : "") + sp.toFixed(1) + " ซม.";
      mOut.textContent = Math.abs(m).toFixed(2) + " เท่า";
      kindOut.textContent = sp > 0 ? "ภาพจริง (หัวกลับ)" : "ภาพเสมือน (หัวตั้ง)";
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [sF.root, fF.root, concaveRow]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ระยะภาพ s'" }), spOut]),
      h("div", null, [h("dt", { text: "กำลังขยาย |m|" }), mOut]),
      h("div", null, [h("dt", { text: "ลักษณะภาพ" }), kindOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "สมการเลนส์บาง 1/f = 1/s + 1/s' และ m = −s'/s (ระยะภาพเป็นบวกคือภาพจริง อยู่หลังเลนส์ ติดลบคือภาพเสมือน อยู่หน้าเลนส์)" }));
    update();
  }

  // -------------------------------------------------------- magnetic-induction
  function magneticInduction(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var bc = config.bField || { min: 0.2, max: 2.0, step: 0.1, default: 0.8 };
    var vc = config.speed || { min: 2, max: 20, step: 1, default: 10 };
    var interacted = false;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 270",
      class: "plot",
      role: "img",
      "aria-label": "สนามแม่เหล็กแสดงแรงกระทำต่อประจุไฟฟ้าหรือแรงเคลื่อนไฟฟ้าเหนี่ยวนำ",
    });

    var bF = field("สนามแม่เหล็ก B =", "เทสลา (T)", { min: bc.min, max: bc.max, step: bc.step || 0.1, value: bc.default }, function () { interact(); update(); });
    var vF = field("ความเร็ว v =", "ม./วิ", { min: vc.min, max: vc.max, step: vc.step || 1, value: vc.default }, function () { interact(); update(); });

    var modeId = "lp-f" + (++uid);
    var modeBox = h("input", { id: modeId, type: "checkbox" });
    modeBox.addEventListener("change", function () { interact(); update(); });
    var modeRow = h("div", { class: "field check" }, [modeBox, h("label", { for: modeId, text: "โหมดลวดเหนี่ยวนำตัดสนามแม่เหล็ก (Faraday EMF)" })]);

    var out1 = h("dd", { text: "-" }), out2 = h("dd", { text: "-" }), out3 = h("dd", { text: "-" });
    var label1 = h("dt", { text: "แรงแม่เหล็ก F = qvB" }), label2 = h("dt", { text: "รัศมีความโค้ง r" }), label3 = h("dt", { text: "ทิศทางการเบี่ยงเบน" });

    function update() {
      var B = Number(bF.input.value), v = Number(vF.input.value);
      var isInduction = modeBox.checked;

      clear(svg);

      var fx1 = 80, fy1 = 30, fw = 520, fh = 200;
      for (var x = fx1 + 25; x < fx1 + fw; x += 45) {
        for (var y = fy1 + 25; y < fy1 + fh; y += 45) {
          svgEl(svg, "text", { x: x, y: y, "text-anchor": "middle", class: "g-label", "font-size": "15px", opacity: 0.35 }).textContent = "×";
        }
      }
      svgEl(svg, "rect", { x: fx1, y: fy1, width: fw, height: fh, class: "g-line", fill: "none", "stroke-width": 1.5 });
      svgEl(svg, "text", { x: fx1 + 10, y: fy1 + 20, class: "g-label", "font-size": "14px" }).textContent = "B = " + B.toFixed(1) + " T (พุ่งเข้ากระดาษ)";

      if (!isInduction) {
        var q = 1.6;
        var F = q * v * B;
        var r = (v * 15) / B;

        label1.textContent = "แรงแม่เหล็ก F = qvB";
        label2.textContent = "รัศมีความโค้ง r";
        label3.textContent = "ทิศทางแรงสู่ศูนย์กลาง";

        var startX = fx1, startY = 190;
        var arcD = "M " + (startX - 50) + " " + startY + " L " + startX + " " + startY;
        var safeR = Math.max(30, Math.min(300, r));
        arcD += " A " + safeR + " " + safeR + " 0 0 0 " + (startX + safeR * Math.sin(0.9)) + " " + (startY - safeR * (1 - Math.cos(0.9)));
        svgEl(svg, "path", { d: arcD, class: "path", fill: "none" });

        var curX = startX + safeR * 0.5;
        var curY = startY - safeR * 0.15;
        svgEl(svg, "circle", { cx: curX, cy: curY, r: 8, class: "charge-pos" });
        svgEl(svg, "text", { x: curX, y: curY + 5, "text-anchor": "middle", class: "charge-sign", "font-size": "14px" }).textContent = "+";

        drawArrow(svg, curX, curY, curX + 35, curY - 10);
        drawArrow(svg, curX, curY, curX - 5, curY - 35);

        out1.textContent = F.toFixed(1) + " ×10⁻¹³ N";
        out2.textContent = (r / 20).toFixed(2) + " เมตร";
        out3.textContent = "เบี่ยงขึ้นตามกฎมือขวา";
      } else {
        var L = 0.5, R = 2.0;
        var emf = B * L * v;
        var I = emf / R;

        label1.textContent = "แรงเคลื่อนไฟฟ้า ε = BLv";
        label2.textContent = "กระแสเหนี่ยวนำ I = ε/R";
        label3.textContent = "ทิศกระแสเหนี่ยวนำ";

        var railY1 = 70, railY2 = 190;
        svgEl(svg, "line", { x1: fx1 + 40, y1: railY1, x2: fx1 + fw - 40, y2: railY1, class: "g-axis", "stroke-width": 3 });
        svgEl(svg, "line", { x1: fx1 + 40, y1: railY2, x2: fx1 + fw - 40, y2: railY2, class: "g-axis", "stroke-width": 3 });
        svgEl(svg, "line", { x1: fx1 + 40, y1: railY1, x2: fx1 + 40, y2: railY2, class: "g-axis", "stroke-width": 3 });
        svgEl(svg, "circle", { cx: fx1 + 40, cy: (railY1 + railY2) / 2, r: 12, class: "mark" });
        svgEl(svg, "text", { x: fx1 + 40, y: (railY1 + railY2) / 2 + 5, "text-anchor": "middle", class: "g-label", "font-size": "12px" }).textContent = "R";

        var barX = fx1 + 220;
        svgEl(svg, "line", { x1: barX, y1: railY1 - 8, x2: barX, y2: railY2 + 8, class: "mirror" });
        drawArrow(svg, barX, (railY1 + railY2) / 2, barX + 50, (railY1 + railY2) / 2);
        svgEl(svg, "text", { x: barX + 25, y: (railY1 + railY2) / 2 - 10, class: "g-label", "font-size": "14px" }).textContent = "v = " + v + " m/s";

        drawArrow(svg, barX, railY2 - 20, barX, railY1 + 20);

        out1.textContent = emf.toFixed(2) + " โวลต์";
        out2.textContent = I.toFixed(2) + " แอมแปร์";
        out3.textContent = "ไหลทวนเข็มนาฬิกา (ต้านการเปลี่ยนฟลักซ์)";
      }
    }

    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls three" }, [bF.root, vF.root, modeRow]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [label1, out1]),
      h("div", null, [label2, out2]),
      h("div", null, [label3, out3]),
    ]));
    container.appendChild(h("p", { class: "note", text: "แรงแม่เหล็ก F = qvB sin θ กระทำตั้งฉากกับความเร็วทำให้ประจุเบี่ยงเบนเป็นวงกลม และ ε = −ΔΦ/Δt = BLv เกิดกระแสเหนี่ยวนำตามกฎของเลนซ์" }));
    update();
  }

  // ------------------------------------------------------------ modern-quantum
  function modernQuantum(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var mode = config.mode || "photoelectric";
    var interacted = false;

    function interact() { if (!interacted) { interacted = true; if (opts.onInteract) opts.onInteract(); } }

    var svg = svgEl(null, "svg", {
      viewBox: "0 0 680 270",
      class: "plot",
      role: "img",
      "aria-label": "การจำลองปรากฏการณ์ฟิสิกส์ยุคใหม่",
    });

    var dt1 = h("dt", { text: "-" }), dd1 = h("dd", { text: "-" });
    var dt2 = h("dt", { text: "-" }), dd2 = h("dd", { text: "-" });
    var dt3 = h("dt", { text: "-" }), dd3 = h("dd", { text: "-" });
    var noteP = h("p", { class: "note" });
    var controlsRow = h("div", { class: "controls" });

    if (mode === "decay") {
      var hlc = config.halfLife || { min: 1, max: 15, step: 1, default: 4 };
      var tc = config.time || { min: 0, max: 30, step: 1, default: 8 };
      var hlF = field("ครึ่งชีวิต T½ =", "ปี", { min: hlc.min, max: hlc.max, step: hlc.step || 1, value: hlc.default }, function () { interact(); updateDecay(); });
      var tF = field("เวลาที่ผ่านไป t =", "ปี", { min: tc.min, max: tc.max, step: tc.step || 1, value: tc.default }, function () { interact(); updateDecay(); });

      dt1.textContent = "ปริมาณที่เหลือ N(t)";
      dt2.textContent = "ปริมาณที่สลายไปแล้ว";
      dt3.textContent = "จำนวนครึ่งชีวิตที่ผ่านไป";
      noteP.textContent = "การสลายตัวของสารกัมมันตรังสี: N = N₀(1/2)^(t/T½) เมื่อผ่านไปทุกๆ 1 ครึ่งชีวิต สารจะลดลงเหลือครึ่งหนึ่งของเดิม";

      controlsRow.appendChild(hlF.root);
      controlsRow.appendChild(tF.root);

      function updateDecay() {
        var T_half = Number(hlF.input.value), t = Number(tF.input.value);
        var N0 = 1000;
        var nPeriods = t / T_half;
        var rem = N0 * Math.pow(0.5, nPeriods);
        var decayed = N0 - rem;

        clear(svg);

        var gx1 = 60, gx2 = 360, gyTop = 40, gyBottom = 220;
        svgEl(svg, "line", { x1: gx1, y1: gyBottom, x2: gx2, y2: gyBottom, class: "g-axis" });
        svgEl(svg, "line", { x1: gx1, y1: gyTop, x2: gx1, y2: gyBottom, class: "g-axis" });
        svgEl(svg, "text", { x: gx2 + 5, y: gyBottom + 5, class: "g-label", "font-size": "14px" }).textContent = "เวลา (ปี)";
        svgEl(svg, "text", { x: gx1 - 10, y: gyTop, "text-anchor": "end", class: "g-label", "font-size": "14px" }).textContent = "N";

        var pts = [];
        for (var i = 0; i <= 30; i++) {
          var tx = gx1 + (i / 30) * (gx2 - gx1);
          var ny = gyBottom - (Math.pow(0.5, i / T_half)) * (gyBottom - gyTop);
          pts.push(tx.toFixed(1) + "," + ny.toFixed(1));
        }
        svgEl(svg, "polyline", { points: pts.join(" "), class: "path", fill: "none" });

        var curX = gx1 + (t / 30) * (gx2 - gx1);
        var curY = gyBottom - (rem / N0) * (gyBottom - gyTop);
        svgEl(svg, "line", { x1: curX, y1: gyBottom, x2: curX, y2: curY, class: "normal" });
        svgEl(svg, "line", { x1: gx1, y1: curY, x2: curX, y2: curY, class: "normal" });
        svgEl(svg, "circle", { cx: curX, cy: curY, r: 6, class: "ball" });

        svgEl(svg, "text", { x: 520, y: 35, "text-anchor": "middle", class: "g-label", "font-size": "15px" }).textContent = "อนุภาคจำลอง (" + Math.round((rem / N0) * 100) + "%)";
        var gridX = 420, gridY = 55;
        var activeCount = Math.round((rem / N0) * 100);
        for (var row = 0; row < 10; row++) {
          for (var col = 0; col < 10; col++) {
            var idx = row * 10 + col;
            var isAct = idx < activeCount;
            svgEl(svg, "circle", {
              cx: gridX + col * 20,
              cy: gridY + row * 16,
              r: 5,
              class: isAct ? "ball" : "g-line",
              fill: isAct ? "var(--ball)" : "none",
            });
          }
        }

        dd1.textContent = rem.toFixed(0) + " / " + N0;
        dd2.textContent = decayed.toFixed(0) + " (" + ((decayed / N0) * 100).toFixed(1) + "%)";
        dd3.textContent = nPeriods.toFixed(2) + " รอบ";
      }
      updateDecay();

    } else if (mode === "relativity") {
      var sc = config.speedRatio || { min: 0, max: 0.98, step: 0.02, default: 0.6 };
      var sF = field("อัตราเร็ว v/c =", "", { min: sc.min, max: sc.max, step: sc.step || 0.02, value: sc.default }, function () { interact(); updateRel(); });

      dt1.textContent = "แฟกเตอร์ลอเรนตซ์ γ";
      dt2.textContent = "ความยาวหดสั้น L = L₀/γ";
      dt3.textContent = "เวลาขยายออก Δt = γΔt₀";
      noteP.textContent = "สัมพัทธภาพพิเศษของไอน์สไตน์: เมื่อวัตถุเคลื่อนที่เข้าใกล้ความเร็วแสง (c) ความยาวจะหดสั้นลง และเวลาจะเดินช้าลงเทียบกับผู้สังเกตอยู่นิ่ง";

      controlsRow.appendChild(sF.root);

      function updateRel() {
        var beta = Number(sF.input.value);
        var gamma = 1 / Math.sqrt(Math.max(0.001, 1 - beta * beta));
        var L0 = 160;
        var L = L0 / gamma;

        clear(svg);

        svgEl(svg, "text", { x: 60, y: 55, class: "g-label", "font-size": "15px" }).textContent = "ผู้สังเกตอยู่นิ่ง (L₀ = 100 ม.):";
        svgEl(svg, "rect", { x: 60, y: 70, width: L0, height: 40, class: "target", rx: 6 });
        svgEl(svg, "line", { x1: 60, y1: 125, x2: 60 + L0, y2: 125, class: "arrow" });
        svgEl(svg, "text", { x: 60 + L0 / 2, y: 140, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "L₀";

        svgEl(svg, "text", { x: 60, y: 175, class: "g-label", "font-size": "15px" }).textContent = "สังเกตจากโลก (v = " + beta.toFixed(2) + "c):";
        svgEl(svg, "rect", { x: 60, y: 190, width: L, height: 40, class: "ball", rx: 6 });
        svgEl(svg, "line", { x1: 60, y1: 245, x2: 60 + L, y2: 245, class: "arrow" });
        svgEl(svg, "text", { x: 60 + L / 2, y: 260, "text-anchor": "middle", class: "g-label", "font-size": "14px" }).textContent = "L = " + (100 / gamma).toFixed(1) + " ม.";

        var gx1 = 380, gx2 = 630, gyTop = 40, gyBottom = 230;
        svgEl(svg, "line", { x1: gx1, y1: gyBottom, x2: gx2, y2: gyBottom, class: "g-axis" });
        svgEl(svg, "line", { x1: gx1, y1: gyTop, x2: gx1, y2: gyBottom, class: "g-axis" });
        svgEl(svg, "text", { x: gx2 - 20, y: gyBottom + 20, class: "g-label", "font-size": "14px" }).textContent = "v/c";
        svgEl(svg, "text", { x: gx1 - 8, y: gyTop + 5, "text-anchor": "end", class: "g-label", "font-size": "14px" }).textContent = "γ";

        var pts = [];
        for (var b = 0; b <= 98; b += 2) {
          var bVal = b / 100;
          var gVal = 1 / Math.sqrt(1 - bVal * bVal);
          var x = gx1 + (bVal / 1.0) * (gx2 - gx1);
          var y = gyBottom - ((Math.min(gVal, 5) - 1) / 4) * (gyBottom - gyTop);
          pts.push(x.toFixed(1) + "," + y.toFixed(1));
        }
        svgEl(svg, "polyline", { points: pts.join(" "), class: "path", fill: "none" });

        var curX = gx1 + beta * (gx2 - gx1);
        var curY = gyBottom - ((Math.min(gamma, 5) - 1) / 4) * (gyBottom - gyTop);
        svgEl(svg, "circle", { cx: curX, cy: curY, r: 6, class: "ball" });

        dd1.textContent = gamma.toFixed(2);
        dd2.textContent = (100 / gamma).toFixed(1) + " เมตร (" + ((1 / gamma) * 100).toFixed(0) + "%)";
        dd3.textContent = gamma.toFixed(2) + " เท่าของเดิม";
      }
      updateRel();

    } else {
      var fqc = config.frequency || { min: 3, max: 15, step: 0.5, default: 8 };
      var w0c = config.workFunction || { min: 1.5, max: 4.5, step: 0.1, default: 2.3 };
      var fqF = field("ความถี่แสง f =", "×10¹⁴ Hz", { min: fqc.min, max: fqc.max, step: fqc.step || 0.5, value: fqc.default }, function () { interact(); updatePE(); });
      var w0F = field("ฟังก์ชันงาน W₀ =", "อิเล็กตรอนโวลต์ (eV)", { min: w0c.min, max: w0c.max, step: w0c.step || 0.1, value: w0c.default }, function () { interact(); updatePE(); });

      dt1.textContent = "พลังงานโฟตอน E = hf";
      dt2.textContent = "พลังงานจลน์สูงสุด Ek_max";
      dt3.textContent = "ความถี่ขีดเริ่ม f₀ = W₀/h";
      noteP.textContent = "ปรากฏการณ์โฟโตอิเล็กทริก: Ek_max = hf − W₀ อิเล็กตรอนจะหลุดออกจากผิวโลหะได้ก็ต่อเมื่อพลังงานโฟตอน hf มากกว่าฟังก์ชันงาน W₀";

      controlsRow.appendChild(fqF.root);
      controlsRow.appendChild(w0F.root);

      function updatePE() {
        var f = Number(fqF.input.value), W0 = Number(w0F.input.value);
        var hConst = 0.4136;
        var E = hConst * f;
        var Ek = Math.max(0, E - W0);
        var f0 = W0 / hConst;

        clear(svg);

        svgEl(svg, "rect", { x: 380, y: 50, width: 250, height: 160, rx: 12, class: "g-line", fill: "none", "stroke-width": 2 });
        svgEl(svg, "rect", { x: 410, y: 70, width: 14, height: 120, class: "target" });
        svgEl(svg, "text", { x: 417, y: 210, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "W₀=" + W0 + "eV";
        svgEl(svg, "rect", { x: 590, y: 70, width: 10, height: 120, class: "g-axis", opacity: 0.5 });

        var lightColor = f < 5 ? "#ff5533" : f < 7.5 ? "#33bb55" : f < 10 ? "#3388ff" : "#8833ff";
        for (var k = 0; k < 4; k++) {
          var ly = 85 + k * 28;
          svgEl(svg, "line", { x1: 340, y1: ly - 20, x2: 410, y2: ly, stroke: lightColor, "stroke-width": 3, "stroke-dasharray": "6 4" });
        }

        if (E > W0) {
          var nElectrons = Math.min(8, Math.round(2 + Ek * 2));
          for (var e = 0; e < nElectrons; e++) {
            var ex = 430 + (e * 20) % 150;
            var ey = 80 + ((e * 35) % 100);
            svgEl(svg, "circle", { cx: ex, cy: ey, r: 5, class: "charge-neg" });
            drawArrow(svg, ex, ey, ex + 14 + Ek * 4, ey);
          }
        } else {
          svgEl(svg, "text", { x: 510, y: 135, "text-anchor": "middle", class: "g-label", style: "fill: var(--bad); font-weight: 600;" }).textContent = "พลังงานไม่พอ (ไม่หลุด)";
        }

        var gx1 = 60, gx2 = 320, gyTop = 40, gyBottom = 220;
        svgEl(svg, "line", { x1: gx1, y1: gyBottom, x2: gx2, y2: gyBottom, class: "g-axis" });
        svgEl(svg, "line", { x1: gx1, y1: gyTop, x2: gx1, y2: gyBottom, class: "g-axis" });
        svgEl(svg, "text", { x: gx2 + 5, y: gyBottom + 5, class: "g-label", "font-size": "13px" }).textContent = "f";
        svgEl(svg, "text", { x: gx1 - 8, y: gyTop + 5, "text-anchor": "end", class: "g-label", "font-size": "13px" }).textContent = "Ek";

        var f0X = gx1 + (f0 / 16) * (gx2 - gx1);
        if (f0X < gx2) {
          var endX = gx2;
          var endEk = hConst * 16 - W0;
          var endY = gyBottom - (endEk / 5) * (gyBottom - gyTop);
          svgEl(svg, "line", { x1: f0X, y1: gyBottom, x2: endX, y2: endY, class: "ray" });
          svgEl(svg, "circle", { cx: f0X, cy: gyBottom, r: 4, class: "mark" });
          svgEl(svg, "text", { x: f0X, y: gyBottom + 18, "text-anchor": "middle", class: "g-label", "font-size": "12px" }).textContent = "f₀";
        }

        var curX = gx1 + (f / 16) * (gx2 - gx1);
        var curY = gyBottom - (Ek / 5) * (gyBottom - gyTop);
        svgEl(svg, "circle", { cx: curX, cy: curY, r: 5, class: "ball" });

        dd1.textContent = E.toFixed(2) + " eV";
        dd2.textContent = Ek > 0 ? Ek.toFixed(2) + " eV" : "0 eV (hf ≤ W₀)";
        dd3.textContent = f0.toFixed(2) + " ×10¹⁴ Hz";
      }
      updatePE();
    }

    container.appendChild(svg);
    container.appendChild(controlsRow);
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [dt1, dd1]),
      h("div", null, [dt2, dd2]),
      h("div", null, [dt3, dd3]),
    ]));
    container.appendChild(noteP);
  }

  // ------------------------------------------------------------- balance-force
  function balanceForce(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = Math.max(config.tolerance || 0.2, 0.2);
    var tr = config.targetAcc || config.targetAcceleration || config.target || [1.0, 5.0];
    var fc = config.force || { min: 10, max: 100, default: 35 };
    var mc = config.mass || { min: 1, max: 10, default: 5 };
    var G = 9.8, mu = 0.2;
    var target = 0, attempts = 0, won = false;

    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 200", class: "plot", role: "img", "aria-label": "เกมปรับแรงและมวลให้ความเร่งตรงเป้าหมาย" });

    var fF = field("แรงดึง F =", "นิวตัน", { min: fc.min, max: fc.max, step: 1, value: fc.default }, function () { preview(); });
    var mF = field("มวล m =", "กก.", { min: mc.min, max: mc.max, step: 0.5, value: mc.default }, function () { preview(); });
    var checkBtn = h("button", { type: "button", text: "ตรวจคำตอบ" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });

    function preview() {
      var F = Number(fF.input.value), m = Number(mF.input.value);
      var maxFriction = mu * m * G;
      var a = F > maxFriction ? (F - maxFriction) / m : 0;
      clear(svg);

      var floorY = 140;
      svgEl(svg, "line", { x1: 30, y1: floorY, x2: 650, y2: floorY, class: "g-axis", "stroke-width": 2 });

      var bx = 220, bw = 80, bh = 50, by = floorY - bh;
      svgEl(svg, "rect", { x: bx, y: by, width: bw, height: bh, class: "target" });
      svgEl(svg, "text", { x: bx + bw / 2, y: by + bh / 2 + 5, "text-anchor": "middle", class: "g-label" }).textContent = m + " kg";

      drawArrow(svg, bx + bw, by + bh / 2, bx + bw + Math.min(140, F * 1.4), by + bh / 2);
      svgEl(svg, "text", { x: bx + bw + 40, y: by + bh / 2 - 8, class: "g-label", "font-size": "14px" }).textContent = "F=" + F + "N";

      svgEl(svg, "text", { x: 340, y: 40, "text-anchor": "middle", class: "g-label" }).textContent = "ความเร่งขณะนี้: a = " + a.toFixed(2) + " ม./วิ² (เป้าหมาย: " + target.toFixed(1) + " ม./วิ²)";
    }

    function pick() {
      // Guaranteed solvable: pick candidate F and m
      var cands = [];
      var curF = Number(fF.input.value), curM = Number(mF.input.value);
      var curMaxFriction = mu * curM * G;
      var curA = curF > curMaxFriction ? (curF - curMaxFriction) / curM : 0;

      for (var f = fc.min; f <= fc.max; f += 1) {
        for (var m = mc.min; m <= mc.max; m = Math.round((m + 0.5) * 10) / 10) {
          var maxFriction = mu * m * G;
          if (f > maxFriction) {
            var a = (f - maxFriction) / m;
            if (a >= tr[0] && a <= tr[1]) {
              if (Math.abs(a - curA) > tol * 1.5) {
                cands.push(Math.round(a * 10) / 10);
              }
            }
          }
        }
      }

      if (cands.length > 0) {
        target = cands[Math.floor(Math.random() * cands.length)];
      } else {
        var midM = (mc.min + mc.max) / 2;
        var reqF = Math.round((tr[0] + mu * G) * midM);
        reqF = Math.max(fc.min, Math.min(fc.max, reqF));
        var calcA = (reqF - mu * midM * G) / midM;
        target = Math.round(calcA * 10) / 10;
      }

      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: ปรับแรง F และมวล m ให้เกิดความเร่ง a = " + target.toFixed(1) + " ม./วิ² (คลาดเคลื่อนไม่เกิน ±" + tol + " ม./วิ² โดย μ = " + mu + ")";
      msg.textContent = "เลื่อนแถบ F และ m แล้วกดตรวจคำตอบ";
      preview();
    }

    checkBtn.addEventListener("click", function () {
      var F = Number(fF.input.value), m = Number(mF.input.value);
      var maxFriction = mu * m * G;
      var a = F > maxFriction ? (F - maxFriction) / m : 0;
      attempts += 1;
      var diff = a - target;
      if (Math.abs(diff) <= tol) {
        msg.className = "game-msg ok";
        msg.textContent = "ยอดเยี่ยม! ได้ความเร่ง a = " + a.toFixed(2) + " ม./วิ² ตรงเป้าหมายพอดี ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.className = "game-msg";
        msg.textContent = "ความเร่ง a = " + a.toFixed(2) + " ม./วิ² " + (diff < 0 ? "น้อยไป " : "มากไป ") + Math.abs(diff).toFixed(2) + " ม./วิ² ลองปรับใหม่ (ตรวจครั้งที่ " + attempts + ")";
      }
      preview();
    });

    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [fF.root, mF.root]));
    container.appendChild(h("div", { class: "actions" }, [checkBtn, newBtn]));
    container.appendChild(msg);
    pick();
  }

  // ---------------------------------------------------------------- lens-focus
  function lensFocus(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = Math.max(config.tolerance || 1.5, 1.5);
    var tr = config.targetDistance || config.targetImageDist || config.target || [22, 55];
    var fVal = config.focalLength || 15;
    var sc = config.objectDistance || { min: 18, max: 60, default: 30 };
    var target = 0, attempts = 0, won = false;

    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 220", class: "plot", role: "img", "aria-label": "เกมปรับระยะวัตถุให้ภาพตกบนฉากเป้าหมาย" });

    var sF = field("ระยะวัตถุ s =", "ซม.", { min: sc.min, max: sc.max, step: 0.5, value: sc.default }, function () { preview(); });
    var checkBtn = h("button", { type: "button", text: "ตรวจคำตอบ" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });

    function preview() {
      var s = Number(sF.input.value);
      var sp = s > fVal ? (s * fVal) / (s - fVal) : 0;
      clear(svg);

      var midX = 260, midY = 110, scale = 4.0;
      svgEl(svg, "line", { x1: 20, y1: midY, x2: 660, y2: midY, class: "g-axis" });

      svgEl(svg, "line", { x1: midX, y1: 20, x2: midX, y2: 200, class: "mirror" });
      svgEl(svg, "text", { x: midX, y: 16, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "เลนส์นูน f=" + fVal + "cm";

      var ox = midX - s * scale;
      svgEl(svg, "line", { x1: ox, y1: midY, x2: ox, y2: midY - 40, class: "ray" });
      svgEl(svg, "text", { x: ox, y: midY + 18, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "s=" + s;

      var tx = midX + target * scale;
      svgEl(svg, "rect", { x: tx - 4, y: 30, width: 8, height: 160, class: "target", "fill-opacity": 0.5 });
      svgEl(svg, "text", { x: tx, y: 24, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "ฉาก (เป้า s'=" + target + ")";

      if (sp > 0) {
        var ix = midX + sp * scale;
        var diff = Math.abs(sp - target);
        var blur = Math.min(14, diff * 1.5);
        svgEl(svg, "circle", { cx: ix, cy: midY, r: Math.max(3, blur), class: "ball", opacity: diff <= tol ? 1 : 0.6 });
        svgEl(svg, "text", { x: ix, y: midY + 28, "text-anchor": "middle", class: "g-label", "font-size": "12px" }).textContent = "ภาพ (s'=" + sp.toFixed(1) + ")";
      }
    }

    function pick() {
      // Guaranteed solvable: pick candidate s
      var cands = [];
      var curS = Number(sF.input.value);
      var curSp = curS > fVal ? (curS * fVal) / (curS - fVal) : 0;

      for (var s = sc.min; s <= sc.max; s = Math.round((s + 0.5) * 10) / 10) {
        if (s > fVal + 1) {
          var sp = (s * fVal) / (s - fVal);
          if (sp >= tr[0] && sp <= tr[1]) {
            if (Math.abs(sp - curSp) > tol * 1.5) {
              cands.push(Math.round(sp * 10) / 10);
            }
          }
        }
      }

      if (cands.length > 0) {
        target = cands[Math.floor(Math.random() * cands.length)];
      } else {
        var midS = (sc.min + sc.max) / 2;
        target = Math.round(((midS * fVal) / (midS - fVal)) * 10) / 10;
      }

      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: ฉากรับภาพตั้งอยู่ที่ s' = " + target.toFixed(1) + " ซม. (เลนส์นูน f = " + fVal + " ซม.) จงปรับระยะวัตถุ s ให้ภาพคมชัดบนฉากพอดี (คลาดเคลื่อนไม่เกิน ±" + tol + " ซม.)";
      msg.textContent = "เลื่อนแถบระยะวัตถุ s แล้วกดตรวจคำตอบ";
      preview();
    }

    checkBtn.addEventListener("click", function () {
      var s = Number(sF.input.value);
      var sp = s > fVal ? (s * fVal) / (s - fVal) : 0;
      attempts += 1;
      var diff = sp - target;
      if (Math.abs(diff) <= tol) {
        msg.className = "game-msg ok";
        msg.textContent = "โฟกัสคมชัด! s' = " + sp.toFixed(1) + " ซม. ภาพตกบนฉากพอดี ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.className = "game-msg";
        msg.textContent = "ภาพตกที่ s' = " + sp.toFixed(1) + " ซม. " + (diff < 0 ? "ตกหน้าฉากไป " : "ตกหลังฉากไป ") + Math.abs(diff).toFixed(1) + " ซม. ลองปรับ s ใหม่ (ตรวจครั้งที่ " + attempts + ")";
      }
      preview();
    });

    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls single" }, [sF.root]));
    container.appendChild(h("div", { class: "actions" }, [checkBtn, newBtn]));
    container.appendChild(msg);
    pick();
  }

  // ------------------------------------------------------------ thermal-piston
  function thermalPiston(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = Math.max(config.tolerance || 15, 12);
    var tr = config.targetPressure || config.target || [120, 320];
    var tc = config.temperature || { min: 200, max: 600, default: 300 };
    var vc = config.volume || { min: 2, max: 10, step: 0.5, default: 5 };
    var R = 8.314, target = 0, attempts = 0, won = false;

    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 200", class: "plot", role: "img", "aria-label": "เกมปรับอุณหภูมิและปริมาตรเพื่อให้ได้ความดันเป้าหมาย" });

    var tF = field("อุณหภูมิ T =", "เคลวิน (K)", { min: tc.min, max: tc.max, step: 5, value: tc.default }, function () { preview(); });
    var vF = field("ปริมาตร V =", "ลิตร", { min: vc.min, max: vc.max, step: 0.5, value: vc.default }, function () { preview(); });
    var checkBtn = h("button", { type: "button", text: "ตรวจคำตอบ" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });

    function preview() {
      var T = Number(tF.input.value), V = Number(vF.input.value);
      var P = (1 * R * T) / V;
      clear(svg);

      var cx = 80, cy = 40, ch = 100, maxW = 380;
      var px = cx + (V / 10) * maxW;

      svgEl(svg, "polyline", { points: (cx + maxW + 20) + "," + cy + " " + cx + "," + cy + " " + cx + "," + (cy + ch) + " " + (cx + maxW + 20) + "," + (cy + ch), class: "g-axis", fill: "none", "stroke-width": 2 });
      svgEl(svg, "rect", { x: px, y: cy + 2, width: 12, height: ch - 4, class: "target" });

      svgEl(svg, "text", { x: 550, y: 50, "text-anchor": "middle", class: "g-label" }).textContent = "ความดัน P (เป้า: " + target + " kPa)";
      svgEl(svg, "circle", { cx: 550, cy: 105, r: 42, class: "target", "fill-opacity": 0.2 });
      var angCur = -Math.PI * 0.75 + (Math.min(P, 500) / 500) * (Math.PI * 1.5);
      var angTar = -Math.PI * 0.75 + (Math.min(target, 500) / 500) * (Math.PI * 1.5);
      svgEl(svg, "line", { x1: 550, y1: 105, x2: 550 + 36 * Math.cos(angTar), y2: 105 + 36 * Math.sin(angTar), class: "normal", "stroke-width": 3 });
      svgEl(svg, "line", { x1: 550, y1: 105, x2: 550 + 34 * Math.cos(angCur), y2: 105 + 34 * Math.sin(angCur), class: "ray" });
      svgEl(svg, "text", { x: 550, y: 175, "text-anchor": "middle", class: "g-label", "font-size": "15px" }).textContent = "ขณะนี้ " + P.toFixed(1) + " kPa";
    }

    function pick() {
      // Guaranteed solvable: pick candidate T and V
      var cands = [];
      var curT = Number(tF.input.value), curV = Number(vF.input.value);
      var curP = (1 * R * curT) / curV;

      for (var t = tc.min; t <= tc.max; t += 5) {
        for (var v = vc.min; v <= vc.max; v = Math.round((v + 0.5) * 10) / 10) {
          var P = (1 * R * t) / v;
          if (P >= tr[0] && P <= tr[1]) {
            if (Math.abs(P - curP) > tol * 1.5) {
              cands.push(Math.round(P));
            }
          }
        }
      }

      if (cands.length > 0) {
        target = cands[Math.floor(Math.random() * cands.length)];
      } else {
        var midT = (tc.min + tc.max) / 2;
        var midV = (vc.min + vc.max) / 2;
        target = Math.round((1 * R * midT) / midV);
      }

      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: ปรับอุณหภูมิ T และปริมาตร V ของแก๊ส 1 โมล ให้ได้ความดัน P = " + target + " kPa (คลาดเคลื่อนไม่เกิน ±" + tol + " kPa)";
      msg.textContent = "ปรับ T และ V แล้วกดตรวจคำตอบ";
      preview();
    }

    checkBtn.addEventListener("click", function () {
      var T = Number(tF.input.value), V = Number(vF.input.value);
      var P = (1 * R * T) / V;
      attempts += 1;
      var diff = P - target;
      if (Math.abs(diff) <= tol) {
        msg.className = "game-msg ok";
        msg.textContent = "ถูกต้อง! ความดัน P = " + P.toFixed(1) + " kPa เข้าเป้าหมายพอดี ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.className = "game-msg";
        msg.textContent = "ความดัน P = " + P.toFixed(1) + " kPa " + (diff < 0 ? "ต่ำไป " : "สูงไป ") + Math.abs(diff).toFixed(1) + " kPa ลองปรับ T หรือ V ใหม่ (ตรวจครั้งที่ " + attempts + ")";
      }
      preview();
    });

    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [tF.root, vF.root]));
    container.appendChild(h("div", { class: "actions" }, [checkBtn, newBtn]));
    container.appendChild(msg);
    pick();
  }

  // --------------------------------------------------------------- quantum-lab
  function quantumLab(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = Math.max(config.tolerance || 0.2, 0.2);
    var tr = config.targetEk || config.targetEnergy || config.target || [0.6, 3.2];
    var W0 = config.workFunction || 2.2;
    var fc = config.frequency || { min: 4, max: 16, step: 0.2, default: 7 };
    var hConst = 0.4136, target = 0, attempts = 0, won = false;

    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 200", class: "plot", role: "img", "aria-label": "ห้องปฏิบัติการควอนตัม ปรับความถี่แสงให้ได้พลังงานจลน์ตามเป้า" });

    var fF = field("ความถี่แสง f =", "×10¹⁴ Hz", { min: fc.min, max: fc.max, step: 0.2, value: fc.default }, function () { preview(); });
    var checkBtn = h("button", { type: "button", text: "ตรวจคำตอบ" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });

    function preview() {
      var f = Number(fF.input.value);
      var E = hConst * f;
      var Ek = Math.max(0, E - W0);
      clear(svg);

      var lightColor = f < 6 ? "#ff4433" : f < 8.5 ? "#22cc55" : f < 11 ? "#3377ff" : "#9933ff";

      svgEl(svg, "rect", { x: 100, y: 30, width: 480, height: 130, rx: 14, class: "g-line", fill: "none", "stroke-width": 2 });
      svgEl(svg, "rect", { x: 140, y: 45, width: 14, height: 100, class: "target" });
      svgEl(svg, "text", { x: 147, y: 165, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "W₀ = " + W0 + " eV";

      for (var i = 0; i < 3; i++) {
        svgEl(svg, "line", { x1: 60, y1: 65 + i * 25, x2: 140, y2: 75 + i * 25, stroke: lightColor, "stroke-width": 3, "stroke-dasharray": "6 4" });
      }

      svgEl(svg, "rect", { x: 300, y: 65, width: 220, height: 26, class: "g-axis", fill: "none" });
      var fillW = Math.max(0, Math.min(220, (Ek / 4) * 220));
      svgEl(svg, "rect", { x: 300, y: 65, width: fillW, height: 26, class: "ball" });
      var tarX = 300 + Math.min(220, (target / 4) * 220);
      svgEl(svg, "line", { x1: tarX, y1: 55, x2: tarX, y2: 100, class: "ray", "stroke-width": 3 });
      svgEl(svg, "text", { x: tarX, y: 50, "text-anchor": "middle", class: "g-label", "font-size": "13px" }).textContent = "เป้า: " + target.toFixed(1) + " eV";

      svgEl(svg, "text", { x: 410, y: 130, "text-anchor": "middle", class: "g-label" }).textContent = "Ek = " + (Ek > 0 ? Ek.toFixed(2) + " eV" : "0 eV (ยังไม่หลุด)");
    }

    function pick() {
      // Guaranteed solvable: pick candidate f
      var cands = [];
      var curF = Number(fF.input.value);
      var curEk = Math.max(0, hConst * curF - W0);

      for (var f = fc.min; f <= fc.max; f = Math.round((f + 0.2) * 10) / 10) {
        var E = hConst * f;
        if (E > W0) {
          var Ek = E - W0;
          if (Ek >= tr[0] && Ek <= tr[1]) {
            if (Math.abs(Ek - curEk) > tol * 1.5) {
              cands.push(Math.round(Ek * 10) / 10);
            }
          }
        }
      }

      if (cands.length > 0) {
        target = cands[Math.floor(Math.random() * cands.length)];
      } else {
        var midF = (fc.min + fc.max) / 2;
        target = Math.round(Math.max(0.4, hConst * midF - W0) * 10) / 10;
      }

      attempts = 0; won = false;
      msg.className = "game-msg";
      info.textContent = "เป้าหมาย: แผ่นโลหะมี W₀ = " + W0 + " eV จงปรับความถี่ f ให้ได้ Ek = " + target.toFixed(1) + " eV (คลาดเคลื่อนไม่เกิน ±" + tol + " eV)";
      msg.textContent = "เลื่อนความถี่ f แล้วกดตรวจคำตอบ";
      preview();
    }

    checkBtn.addEventListener("click", function () {
      var f = Number(fF.input.value);
      var E = hConst * f;
      var Ek = Math.max(0, E - W0);
      attempts += 1;
      var diff = Ek - target;
      if (Math.abs(diff) <= tol) {
        msg.className = "game-msg ok";
        msg.textContent = "สำเร็จ! ได้พลังงานจลน์ Ek = " + Ek.toFixed(2) + " eV ตรงเป้าหมายพอดี ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.className = "game-msg";
        if (E <= W0) {
          msg.textContent = "พลังงานโฟตอน hf = " + E.toFixed(2) + " eV ยังไม่ชนะฟังก์ชันงาน W₀ = " + W0 + " eV ทำให้อิเล็กตรอนไม่หลุด ลองเพิ่มความถี่ f (ตรวจครั้งที่ " + attempts + ")";
        } else {
          msg.textContent = "ได้ Ek = " + Ek.toFixed(2) + " eV " + (diff < 0 ? "น้อยไป " : "มากไป ") + Math.abs(diff).toFixed(2) + " eV ลองปรับ f ใหม่ (ตรวจครั้งที่ " + attempts + ")";
        }
      }
      preview();
    });

    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls single" }, [fF.root]));
    container.appendChild(h("div", { class: "actions" }, [checkBtn, newBtn]));
    container.appendChild(msg);
    pick();
  }

  window.LPEngines = {
    animations: {
      projectile: projectile,
      coulomb: coulomb,
      reflection: reflection,
      "ohm-law": ohmLaw,
      "snell-law": snellLaw,
      "harmonic-wave": harmonicWave,
      "newton-force": newtonForce,
      "linear-motion": linearMotion,
      "momentum-collision": momentumCollision,
      "circular-shm": circularShm,
      "fluid-pressure": fluidPressure,
      "ideal-gas": idealGas,
      "thin-lens": thinLens,
      "magnetic-induction": magneticInduction,
      "modern-quantum": modernQuantum,
    },
    games: {
      "aim-and-shoot": aimAndShoot,
      "match-circuit": matchCircuit,
      "wave-tuner": waveTuner,
      "balance-force": balanceForce,
      "lens-focus": lensFocus,
      "thermal-piston": thermalPiston,
      "quantum-lab": quantumLab,
    },
  };
})();
