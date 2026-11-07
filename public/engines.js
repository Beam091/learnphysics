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

  window.LPEngines = {
    animations: { projectile: projectile, coulomb: coulomb, reflection: reflection },
    games: { "aim-and-shoot": aimAndShoot },
  };
})();
