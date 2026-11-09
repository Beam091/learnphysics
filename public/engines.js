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
    container.appendChild(h("div", { class: "controls" }, [angleF.root, speedF.root, shootBtn]));
    container.appendChild(h("dl", { class: "results", "aria-live": "polite" }, [
      h("div", null, [h("dt", { text: "ระยะไกลสุด" }), rangeOut]),
      h("div", null, [h("dt", { text: "สูงสุด" }), heightOut]),
      h("div", null, [h("dt", { text: "เวลาที่ลอย" }), timeOut]),
    ]));
    container.appendChild(h("p", { class: "note", text: "ไม่คิดแรงต้านอากาศ ใช้ g = 9.8 เมตร/วินาที²" }));
    update();

    return {
      setTarget: function (xt, tol) {
        clear(targetG);
        svgEl(targetG, "rect", { x: sx(xt - tol), y: sy(0) - 14, width: sx(xt + tol) - sx(xt - tol), height: 14, class: "target" });
        svgEl(targetG, "text", { x: sx(xt), y: sy(0) - 20, "text-anchor": "middle", class: "g-label" }).textContent = "เป้า";
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
    var range = config.targetDistance || [40, 120];
    var tol = config.tolerance || 5;
    var target = 0, attempts = 0, won = false;

    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite", text: "ปรับมุมและความเร็ว แล้วกดยิงให้ตกในช่วงเป้า" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });
    var view = h("div", { class: "game-view" });

    function pickTarget() {
      target = Math.round(range[0] + Math.random() * (range[1] - range[0]));
      attempts = 0; won = false;
      info.textContent = "เป้าอยู่ห่างประมาณ " + target + " เมตร (ยอมให้คลาดเคลื่อนไม่เกิน " + tol + " เมตร)";
      msg.textContent = "ปรับมุมและความเร็ว แล้วกดยิงให้ตกในช่วงเป้า";
      engine.setTarget(target, tol);
    }

    var engine = projectile(view, config.view || {}, {
      onLand: function (R) {
        attempts += 1;
        var diff = R - target;
        if (Math.abs(diff) <= tol) {
          msg.textContent = "ถูกเป้า! ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
          if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
        } else {
          msg.textContent = (diff < 0 ? "สั้นไป " : "ยาวไป ") + Math.abs(diff).toFixed(1) + " เมตร ลองปรับมุมหรือความเร็วใหม่ (ครั้งที่ " + attempts + ")";
        }
      },
    });

    newBtn.addEventListener("click", pickTarget);
    container.appendChild(info);
    container.appendChild(view);
    container.appendChild(msg);
    container.appendChild(newBtn);
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
    var tol = config.tolerance || 0.1;
    var tr = config.targetCurrent || [0.5, 6];
    var vc = config.voltage || { min: 1, max: 24, default: 12 };
    var rc = config.resistance || { min: 1, max: 20, default: 10 };
    var target = 0, attempts = 0, won = false;
    var info = h("p", { class: "game-info" });
    var msg = h("p", { class: "game-msg", "aria-live": "polite" });
    var svg = svgEl(null, "svg", { viewBox: "0 0 680 260", class: "plot", role: "img", "aria-label": "วงจรไฟฟ้าอย่างง่ายสำหรับเกมปรับกระแสให้ตรงเป้า" });
    var vF = field("แรงดัน V =", "โวลต์", { min: vc.min, max: vc.max, value: vc.default }, function () { preview(); });
    var rF = field("ความต้านทาน R =", "โอห์ม", { min: rc.min, max: rc.max, value: rc.default }, function () { preview(); });
    var checkBtn = h("button", { type: "button", text: "ตรวจคำตอบ" });
    var newBtn = h("button", { type: "button", class: "secondary", text: "สุ่มเป้าใหม่" });
    function preview() { drawCircuit(svg, Number(vF.input.value), Number(rF.input.value)); }
    function pick() {
      target = Math.round((tr[0] + Math.random() * (tr[1] - tr[0])) * 10) / 10;
      attempts = 0; won = false;
      info.textContent = "เป้าหมาย: ปรับ V และ R ให้ได้กระแส I = " + target.toFixed(1) + " แอมแปร์ (คลาดเคลื่อนไม่เกิน " + tol + " แอมแปร์)";
      msg.textContent = "เลื่อนแถบ V และ R แล้วกดตรวจคำตอบ";
      preview();
    }
    checkBtn.addEventListener("click", function () {
      var I = Number(vF.input.value) / Number(rF.input.value);
      attempts += 1;
      var diff = I - target;
      if (Math.abs(diff) <= tol) {
        msg.textContent = "ถูกต้อง! I = " + I.toFixed(2) + " แอมแปร์ ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.textContent = "I = " + I.toFixed(2) + " แอมแปร์ " + (diff < 0 ? "น้อยไป" : "มากไป") + " ลองปรับ V หรือ R ใหม่ (ครั้งที่ " + attempts + ")";
      }
    });
    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [vF.root, rF.root, checkBtn]));
    container.appendChild(msg);
    container.appendChild(newBtn);
    pick();
  }

  // ----------------------------------------------------------------- wave-tuner
  function waveTuner(container, config, opts) {
    opts = opts || {};
    config = config || {};
    var tol = config.tolerance || 1;
    var tr = config.targetSpeed || [4, 40];
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
      var lam = Number(lF.input.value), pts = [];
      clear(svg);
      svgEl(svg, "line", { x1: 20, y1: 100, x2: 660, y2: 100, class: "g-axis" });
      for (var i = 0; i <= 320; i++) {
        var x = (20 * i) / 320;
        pts.push((20 + x * 32).toFixed(1) + "," + (100 - 60 * Math.sin((2 * Math.PI * x) / lam)).toFixed(1));
      }
      svgEl(svg, "polyline", { points: pts.join(" "), class: "path", fill: "none" });
    }
    function pick() {
      target = Math.round(tr[0] + Math.random() * (tr[1] - tr[0]));
      attempts = 0; won = false;
      info.textContent = "เป้าหมาย: จูนคลื่นให้มีอัตราเร็ว v = " + target + " เมตร/วินาที (คลาดเคลื่อนไม่เกิน " + tol + " เมตร/วินาที) โดย v = f × λ";
      msg.textContent = "ปรับ f และ λ แล้วกดจูนคลื่น";
      preview();
    }
    tuneBtn.addEventListener("click", function () {
      var v = Number(fF.input.value) * Number(lF.input.value);
      attempts += 1;
      var diff = v - target;
      if (Math.abs(diff) <= tol) {
        msg.textContent = "จูนได้แล้ว! v = " + v.toFixed(1) + " เมตร/วินาที ใช้ " + attempts + " ครั้ง กด “สุ่มเป้าใหม่” เพื่อเล่นอีกรอบ";
        if (!won) { won = true; if (opts.onWin) opts.onWin(attempts); }
      } else {
        msg.textContent = "v = " + v.toFixed(1) + " เมตร/วินาที " + (diff < 0 ? "ช้าไป" : "เร็วไป") + " ลองปรับ f หรือ λ ใหม่ (ครั้งที่ " + attempts + ")";
      }
    });
    newBtn.addEventListener("click", pick);
    container.appendChild(info);
    container.appendChild(svg);
    container.appendChild(h("div", { class: "controls" }, [fF.root, lF.root, tuneBtn]));
    container.appendChild(msg);
    container.appendChild(newBtn);
    pick();
  }

  window.LPEngines = {
    animations: { projectile: projectile, coulomb: coulomb, reflection: reflection, "ohm-law": ohmLaw, "snell-law": snellLaw, "harmonic-wave": harmonicWave },
    games: { "aim-and-shoot": aimAndShoot, "match-circuit": matchCircuit, "wave-tuner": waveTuner },
  };
})();
