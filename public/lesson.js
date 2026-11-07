// หน้าบทเรียน: โหลดบทเรียนจาก /api/lessons/:slug แล้วแสดง 4 ขั้น คลิป > ซิม > เกม > แบบทดสอบ
// ความคืบหน้าเก็บในเครื่องของผู้เรียน (localStorage) จนกว่าระบบล็อกอินจะเสร็จ
(function () {
  "use strict";

  var root = document.getElementById("lesson");
  if (!root) return;

  var slug = new URLSearchParams(location.search).get("s") || "";
  var STORE_KEY = "learnphysics.progress.v1";
  var LEVELS = { junior: "ม.ต้น", senior: "ม.ปลาย" };

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

  // ---------------------------------------------------------------- ความคืบหน้า
  function readAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function getProgress() {
    var p = readAll()[slug] || {};
    return { video: !!p.video, anim: !!p.anim, game: !!p.game, quiz: typeof p.quiz === "number" ? p.quiz : null };
  }
  function setProgress(key, value) {
    try {
      var all = readAll();
      var p = all[slug] || {};
      if (key === "quiz") p.quiz = Math.max(typeof p.quiz === "number" ? p.quiz : 0, value);
      else p[key] = value;
      all[slug] = p;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* เก็บไม่ได้ก็ไม่เป็นไร ใช้งานต่อได้ */ }
  }

  var statusEls = {};
  function paintStatus() {
    var p = getProgress();
    var map = {
      video: p.video ? "ดูแล้ว" : "",
      anim: p.anim ? "ลองแล้ว" : "",
      game: p.game ? "ผ่านแล้ว" : "",
      quiz: p.quiz !== null ? "คะแนนสูงสุด " + p.quiz + "%" : "",
    };
    for (var k in statusEls) statusEls[k].textContent = map[k];
  }

  function step(key, number, title, bodyNodes) {
    var status = h("span", { class: "step-status" });
    statusEls[key] = status;
    var head = h("h2", null, [h("span", { class: "step-no", text: String(number) }), document.createTextNode(title), status]);
    return h("section", { class: "step", id: "step-" + key }, [head].concat(bodyNodes));
  }

  function notReady(text) { return h("p", { class: "muted", text: text }); }

  // ---------------------------------------------------------------------- คลิป
  function videoStep(lesson) {
    var nodes = [];
    if (!lesson.videos.length) {
      nodes.push(notReady("ยังไม่มีคลิปสำหรับบทเรียนนี้"));
    } else {
      var list = h("ul", { class: "videos" });
      lesson.videos.forEach(function (v) {
        var linkText = v.provider === "youtube" ? "เปิดบน YouTube" : "เปิดลิงก์";
        var a = h("a", { class: "button", href: v.url, target: "_blank", rel: "noopener noreferrer", text: linkText });
        var channel = v.channelUrl
          ? h("a", { href: v.channelUrl, target: "_blank", rel: "noopener noreferrer", text: v.channelName })
          : document.createTextNode(v.channelName);
        list.appendChild(h("li", null, [
          h("strong", { text: v.title }),
          h("span", { class: "muted" }, [document.createTextNode("จากช่อง "), channel]),
          a,
        ]));
      });
      nodes.push(list);

      var boxId = "video-done";
      var box = h("input", { type: "checkbox", id: boxId });
      box.checked = getProgress().video;
      box.addEventListener("change", function () { setProgress("video", box.checked); paintStatus(); });
      nodes.push(h("div", { class: "field check" }, [box, h("label", { for: boxId, text: "ดูคลิปนี้แล้ว" })]));
      nodes.push(h("p", { class: "note", text: "คลิปจะเปิดในแท็บใหม่ เมื่อดูจบแล้วกลับมาที่หน้านี้เพื่อทำขั้นต่อไป" }));
    }
    return step("video", 1, "ดูคลิปสอน", nodes);
  }

  // -------------------------------------------------------------- ซิมและเกม
  function animStep(lesson) {
    var box = h("div", { class: "sim" });
    var a = lesson.animation;
    var engine = a && window.LPEngines && window.LPEngines.animations[a.engine];
    if (engine) {
      engine(box, a.config, { onInteract: function () { setProgress("anim", true); paintStatus(); } });
    } else {
      box.appendChild(notReady("ตัวจำลองของบทนี้กำลังจัดทำ"));
    }
    return step("anim", 2, a && a.title ? "ลองจำลอง: " + a.title : "ลองจำลอง", [box]);
  }

  function gameStep(lesson) {
    var box = h("div", { class: "sim" });
    var g = lesson.game;
    var game = g && window.LPEngines && window.LPEngines.games[g.template];
    if (game) {
      game(box, g.config, { onWin: function () { setProgress("game", true); paintStatus(); } });
    } else {
      box.appendChild(notReady("เกมของบทนี้กำลังจัดทำ"));
    }
    return step("game", 3, g && g.title ? "เล่นเกม: " + g.title : "เล่นเกม", [box]);
  }

  // ------------------------------------------------------------- แบบทดสอบ
  function quizStep(lesson) {
    var quiz = lesson.quiz;
    if (!quiz || !quiz.questions.length) {
      return step("quiz", 4, "ทำแบบทดสอบ", [notReady("แบบทดสอบของบทนี้กำลังจัดทำ")]);
    }

    var form = h("form", { class: "quiz", novalidate: "novalidate" });
    var resultBox = h("div", { class: "quiz-result", "aria-live": "polite" });
    var submit = h("button", { type: "submit", text: "ส่งคำตอบ" });
    var retry = h("button", { type: "button", class: "secondary", text: "ทำอีกครั้ง" });
    retry.hidden = true;
    var marks = {}; // question id -> element สำหรับแสดงผลตรวจ

    quiz.questions.forEach(function (q, i) {
      var legend = h("legend", { text: "ข้อ " + (i + 1) + ". " + q.body });
      var fs = h("fieldset", { class: "q" }, [legend]);
      if (q.type === "choice" && q.choices) {
        q.choices.forEach(function (c, ci) {
          var id = "q" + q.id + "-" + ci;
          var inp = h("input", { type: "radio", name: "q" + q.id, id: id, value: String(ci) });
          fs.appendChild(h("div", { class: "opt" }, [inp, h("label", { for: id, text: c })]));
        });
      } else {
        var nid = "q" + q.id;
        fs.appendChild(h("div", { class: "opt num" }, [
          h("label", { for: nid, text: "คำตอบ (ตัวเลข)" }),
          h("input", { type: "number", step: "any", inputmode: "decimal", id: nid, name: nid }),
        ]));
      }
      var mark = h("p", { class: "mark-line" });
      marks[q.id] = mark;
      fs.appendChild(mark);
      form.appendChild(fs);
    });
    form.appendChild(h("div", { class: "actions" }, [submit, retry]));
    form.appendChild(resultBox);

    function collect() {
      var answers = {};
      quiz.questions.forEach(function (q) {
        if (q.type === "choice") {
          var picked = form.querySelector('input[name="q' + q.id + '"]:checked');
          if (picked) answers[q.id] = Number(picked.value);
        } else {
          var v = form.elements["q" + q.id].value.trim();
          if (v !== "" && isFinite(Number(v))) answers[q.id] = Number(v);
        }
      });
      return answers;
    }

    function showResult(data) {
      resultBox.textContent = "";
      var verdict = data.passed ? "ผ่านเกณฑ์" : "ยังไม่ผ่านเกณฑ์ (ต้องได้ " + quiz.passScore + "% ขึ้นไป)";
      resultBox.appendChild(h("p", { class: "score", text: "ได้ " + data.score + " จาก " + data.total + " ข้อ (" + data.percent + "%) " + verdict }));
      data.results.forEach(function (r) {
        var m = marks[r.id];
        m.textContent = "";
        m.className = "mark-line " + (r.correct ? "ok" : "bad");
        m.appendChild(h("strong", { text: r.correct ? "ถูกต้อง " : "ยังไม่ถูก " }));
        if (!r.correct) {
          var q = quiz.questions.filter(function (x) { return x.id === r.id; })[0];
          var shown = q && q.type === "choice" && q.choices ? q.choices[r.correctAnswer] : r.correctAnswer;
          m.appendChild(document.createTextNode("เฉลย: " + shown + " "));
        }
        m.appendChild(document.createTextNode(r.explanation || ""));
      });
      retry.hidden = false;
      setProgress("quiz", data.percent);
      paintStatus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit.disabled = true;
      fetch("/api/quizzes/" + quiz.id + "/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: collect() }),
      })
        .then(function (res) { if (!res.ok) throw new Error("bad status"); return res.json(); })
        .then(function (data) { if (!data.ok) throw new Error("bad data"); showResult(data); })
        .catch(function () { resultBox.textContent = "ตรวจคำตอบไม่สำเร็จ ลองกดส่งอีกครั้ง"; })
        .then(function () { submit.disabled = false; });
    });

    retry.addEventListener("click", function () {
      form.reset();
      resultBox.textContent = "";
      Object.keys(marks).forEach(function (id) { marks[id].textContent = ""; marks[id].className = "mark-line"; });
      retry.hidden = true;
    });

    return step("quiz", 4, "ทำแบบทดสอบ", [form]);
  }

  // ------------------------------------------------------------------ หน้าหลัก
  function render(lesson) {
    document.title = lesson.title + " | LearnPhysics";
    root.textContent = "";

    var crumbs = h("nav", { class: "crumbs", "aria-label": "ตำแหน่งปัจจุบัน" }, [
      h("a", { href: "/courses", text: "หลักสูตร" }),
      document.createTextNode(" › " + lesson.category + " › " + lesson.chapter.title),
    ]);
    root.appendChild(crumbs);
    root.appendChild(h("h1", { text: lesson.title }));
    root.appendChild(h("p", { class: "level-badge", text: LEVELS[lesson.level] || lesson.level }));
    if (lesson.summary) root.appendChild(h("p", { class: "lead", text: lesson.summary }));

    root.appendChild(videoStep(lesson));
    root.appendChild(animStep(lesson));
    root.appendChild(gameStep(lesson));
    root.appendChild(quizStep(lesson));
    root.appendChild(h("p", { class: "note save-note", text: "ความคืบหน้าบันทึกไว้ในเครื่องนี้ การบันทึกข้ามอุปกรณ์จะมาพร้อมระบบเข้าสู่ระบบด้วย Google" }));
    paintStatus();
  }

  function fail(text) {
    root.textContent = "";
    root.appendChild(h("h1", { text: "เปิดบทเรียนไม่ได้" }));
    root.appendChild(h("p", { class: "lead", text: text }));
    root.appendChild(h("p", null, [h("a", { class: "back", href: "/courses", text: "กลับไปหน้าหลักสูตร" })]));
  }

  if (!/^[a-z0-9-]+$/.test(slug)) { fail("ไม่พบบทเรียนนี้ ลองเลือกจากหน้าหลักสูตร"); return; }

  fetch("/api/lessons/" + encodeURIComponent(slug))
    .then(function (res) {
      if (res.status === 404) { fail("ไม่พบบทเรียนนี้ ลองเลือกจากหน้าหลักสูตร"); return null; }
      if (!res.ok) throw new Error("bad status");
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      if (!data.ok) throw new Error("bad data");
      render(data.lesson);
    })
    .catch(function () { fail("โหลดบทเรียนไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง"); });
})();
