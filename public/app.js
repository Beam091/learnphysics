// ตัวอย่างจำลองการยิงวัตถุเฉียงขึ้น (โพรเจกไทล์) บนหน้าแรก
// สูตร: vx = v cosθ, vy = v sinθ, เวลาที่ลอย T = 2vy/g, ระยะไกลสุด R = vx·T, สูงสุด H = vy²/(2g)
(function () {
  "use strict";

  var G = 9.8;
  var WORLD_W = 170; // เมตร (แกนนอน)
  var WORLD_H = 90;  // เมตร (แกนตั้ง)
  var VBW = 680, VBH = 360;
  var M = { l: 46, r: 14, t: 14, b: 38 };
  var NS = "http://www.w3.org/2000/svg";

  var svg = document.getElementById("plot");
  var angleIn = document.getElementById("angle");
  var speedIn = document.getElementById("speed");
  var shootBtn = document.getElementById("shoot");
  if (!svg || !angleIn || !speedIn || !shootBtn) return;

  var angleOut = document.getElementById("angleOut");
  var speedOut = document.getElementById("speedOut");
  var rangeOut = document.getElementById("rangeOut");
  var heightOut = document.getElementById("heightOut");
  var timeOut = document.getElementById("timeOut");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function sx(x) { return M.l + (x / WORLD_W) * (VBW - M.l - M.r); }
  function sy(y) { return VBH - M.b - (y / WORLD_H) * (VBH - M.t - M.b); }

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    svg.appendChild(node);
    return node;
  }

  // เส้นตาราง: ทุก 10 เมตร, ตัวเลขแกนนอนทุก 50 เมตร, แกนตั้งที่ 0 / 40 / 80 เมตร
  function drawGrid() {
    var x, y, n;
    for (x = 0; x <= WORLD_W; x += 10) {
      el("line", { x1: sx(x), y1: sy(0), x2: sx(x), y2: sy(WORLD_H), class: x === 0 ? "g-axis" : "g-line" });
    }
    for (y = 0; y <= WORLD_H; y += 10) {
      el("line", { x1: sx(0), y1: sy(y), x2: sx(WORLD_W), y2: sy(y), class: y === 0 ? "g-axis" : "g-line" });
    }
    for (x = 0; x <= 150; x += 50) {
      n = el("text", { x: sx(x), y: sy(0) + 26, "text-anchor": "middle", class: "g-label" });
      n.textContent = x + " ม.";
    }
    [0, 40, 80].forEach(function (yy) {
      n = el("text", { x: sx(0) - 8, y: sy(yy) + 6, "text-anchor": "end", class: "g-label" });
      n.textContent = String(yy);
    });
  }

  drawGrid();
  var path = el("polyline", { class: "path", points: "" });
  var apex = el("circle", { class: "mark", r: 5, cx: 0, cy: 0 });
  var land = el("circle", { class: "mark", r: 5, cx: 0, cy: 0 });
  var ball = el("circle", { class: "ball", r: 7, cx: sx(0), cy: sy(0) });

  var frame = null;
  var cur = { vx: 0, vy: 0, T: 0, R: 0, H: 0 };

  function compute() {
    var angle = (Number(angleIn.value) * Math.PI) / 180;
    var v = Number(speedIn.value);
    var vx = v * Math.cos(angle);
    var vy = v * Math.sin(angle);
    var T = (2 * vy) / G;
    cur = { vx: vx, vy: vy, T: T, R: vx * T, H: (vy * vy) / (2 * G) };
  }

  function pos(t) {
    return { x: cur.vx * t, y: cur.vy * t - 0.5 * G * t * t };
  }

  function placeBall(t) {
    var p = pos(t);
    ball.setAttribute("cx", sx(p.x));
    ball.setAttribute("cy", sy(Math.max(p.y, 0)));
  }

  function stop() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function update() {
    stop();
    compute();
    var pts = [];
    for (var i = 0; i <= 60; i++) {
      var p = pos((cur.T * i) / 60);
      pts.push(sx(p.x).toFixed(1) + "," + sy(Math.max(p.y, 0)).toFixed(1));
    }
    path.setAttribute("points", pts.join(" "));
    apex.setAttribute("cx", sx(cur.R / 2));
    apex.setAttribute("cy", sy(cur.H));
    land.setAttribute("cx", sx(cur.R));
    land.setAttribute("cy", sy(0));
    placeBall(0);

    angleOut.textContent = angleIn.value;
    speedOut.textContent = speedIn.value;
    rangeOut.textContent = cur.R.toFixed(1) + " ม.";
    heightOut.textContent = cur.H.toFixed(1) + " ม.";
    timeOut.textContent = cur.T.toFixed(2) + " วิ";
  }

  function shoot() {
    stop();
    if (reduceMotion) {
      placeBall(cur.T);
      return;
    }
    var start = performance.now();
    function step(now) {
      var t = (now - start) / 1000;
      if (t >= cur.T) {
        placeBall(cur.T);
        frame = null;
        return;
      }
      placeBall(t);
      frame = requestAnimationFrame(step);
    }
    placeBall(0);
    frame = requestAnimationFrame(step);
  }

  angleIn.addEventListener("input", update);
  speedIn.addEventListener("input", update);
  shootBtn.addEventListener("click", shoot);
  update();
})();
