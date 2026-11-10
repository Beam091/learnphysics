// หน้าบทเรียน: โหลดบทเรียนจาก /api/lessons/:slug แล้วแสดง 4 ขั้น คลิป > ซิม > เกม > แบบทดสอบ
// ความคืบหน้าเก็บในเครื่อง (localStorage) และถ้าล็อกอินด้วย Google อยู่ จะซิงค์ขึ้นเซิร์ฟเวอร์อัตโนมัติ
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
    (kids || []).forEach(function (c) {
      if (c) n.appendChild(c);
    });
    return n;
  }

  // ---------------------------------------------------------------- ความคืบหน้า
  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getProgress() {
    var p = readAll()[slug] || {};
    return {
      video: !!p.video,
      anim: !!p.anim,
      game: !!p.game,
      quiz: typeof p.quiz === "number" ? p.quiz : null,
    };
  }

  function setProgress(key, value) {
    try {
      var all = readAll();
      var p = all[slug] || {};
      if (key === "quiz") {
        p.quiz = Math.max(typeof p.quiz === "number" ? p.quiz : 0, value);
      } else {
        p[key] = value;
      }
      all[slug] = p;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) {
      /* เก็บไม่ได้ก็ไม่เป็นไร ใช้งานต่อได้ */
    }
    // ล็อกอินอยู่: ส่งขึ้นเซิร์ฟเวอร์ด้วย (ผลควิซถูกบันทึกฝั่งเซิร์ฟเวอร์อยู่แล้วตอนตรวจ)
    if (window.LPAuth && window.LPAuth.user) window.LPAuth.pushProgress(slug);
  }

  var statusEls = {};
  var passedBanner = null;
  var currentLesson = null;

  function paintStatus() {
    var p = getProgress();
    var map = {
      video: p.video ? "ดูแล้ว" : "",
      anim: p.anim ? "ลองแล้ว" : "",
      game: p.game ? "ผ่านแล้ว" : "",
      quiz: p.quiz !== null ? "คะแนนสูงสุด " + p.quiz + "%" : "",
    };
    for (var k in statusEls) {
      statusEls[k].textContent = map[k];
    }

    if (passedBanner) {
      var passScore = currentLesson && currentLesson.quiz ? currentLesson.quiz.passScore : 60;
      var isPassed =
        (typeof p.quiz === "number" && p.quiz >= passScore) ||
        (p.video && p.anim && p.game && (p.quiz !== null ? p.quiz >= passScore : true));

      if (isPassed) {
        passedBanner.style.display = "flex";
        passedBanner.textContent = "🎉 คุณผ่านบทเรียนนี้แล้ว!";
      } else {
        passedBanner.style.display = "none";
        passedBanner.textContent = "";
      }
    }
  }

  function step(key, number, title, bodyNodes) {
    var status = h("span", { class: "step-status" });
    statusEls[key] = status;
    var head = h("h2", null, [
      h("span", { class: "step-no", text: String(number) }),
      document.createTextNode(title),
      status,
    ]);
    return h("section", { class: "step", id: "step-" + key }, [head].concat(bodyNodes));
  }

  function notReady(text) {
    return h("p", { class: "muted", text: text });
  }

  // ---------------------------------------------------------------------- คลิป
  function videoStep(lesson) {
    var nodes = [];
    if (!lesson.videos.length) {
      nodes.push(notReady("ยังไม่มีคลิปสำหรับบทเรียนนี้"));
    } else {
      var list = h("ul", { class: "videos" });
      lesson.videos.forEach(function (v) {
        var linkText = v.provider === "youtube" ? "เปิดบน YouTube" : "เปิดลิงก์";
        var a = h("a", {
          class: "button",
          href: v.url,
          target: "_blank",
          rel: "noopener noreferrer",
          text: linkText,
        });
        var channel = v.channelUrl
          ? h("a", { href: v.channelUrl, target: "_blank", rel: "noopener noreferrer", text: v.channelName })
          : document.createTextNode(v.channelName);
        list.appendChild(
          h("li", null, [
            h("strong", { text: v.title }),
            h("span", { class: "muted" }, [document.createTextNode("จากช่อง "), channel]),
            a,
          ])
        );
      });
      nodes.push(list);

      var boxId = "video-done";
      var box = h("input", { type: "checkbox", id: boxId });
      box.checked = getProgress().video;
      box.addEventListener("change", function () {
        setProgress("video", box.checked);
        paintStatus();
      });
      nodes.push(h("div", { class: "field check" }, [box, h("label", { for: boxId, text: "ดูคลิปนี้แล้ว" })]));
      nodes.push(
        h("p", {
          class: "note",
          text: "คลิปจะเปิดในแท็บใหม่ เมื่อดูจบแล้วกลับมาที่หน้านี้เพื่อทำขั้นต่อไป",
        })
      );
    }
    return step("video", 1, "ดูคลิปสอน", nodes);
  }

  // -------------------------------------------------------------- ซิมและเกม
  function animStep(lesson) {
    var box = h("div", { class: "sim" });
    var a = lesson.animation;
    var engine = a && window.LPEngines && window.LPEngines.animations[a.engine];
    if (engine) {
      engine(box, a.config, {
        onInteract: function () {
          setProgress("anim", true);
          paintStatus();
        },
      });
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
      game(box, g.config, {
        onWin: function () {
          setProgress("game", true);
          paintStatus();
        },
      });
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
    var questionFieldsets = {}; // question id -> fieldset element

    quiz.questions.forEach(function (q, i) {
      var legend = h("legend", { text: "ข้อ " + (i + 1) + ". " + q.body });
      var fs = h("fieldset", { class: "q" }, [legend]);
      questionFieldsets[q.id] = fs;

      if (q.type === "choice" && q.choices) {
        q.choices.forEach(function (c, ci) {
          var id = "q" + q.id + "-" + ci;
          var inp = h("input", { type: "radio", name: "q" + q.id, id: id, value: String(ci) });
          var opt = h("div", { class: "opt" }, [inp, h("label", { for: id, text: c })]);

          inp.addEventListener("change", function () {
            var siblings = fs.querySelectorAll(".opt");
            for (var s = 0; s < siblings.length; s++) {
              siblings[s].classList.remove("is-selected");
            }
            if (inp.checked) {
              opt.classList.add("is-selected");
            }
          });

          fs.appendChild(opt);
        });
      } else {
        var nid = "q" + q.id;
        fs.appendChild(
          h("div", { class: "opt num" }, [
            h("label", { for: nid, text: "คำตอบ (ตัวเลข)" }),
            h("input", { type: "number", step: "any", inputmode: "decimal", id: nid, name: nid }),
          ])
        );
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
          var el = form.elements["q" + q.id];
          if (el) {
            var v = el.value.trim();
            if (v !== "" && isFinite(Number(v))) answers[q.id] = Number(v);
          }
        }
      });
      return answers;
    }

    function showResult(data) {
      resultBox.textContent = "";
      var verdict = data.passed ? "ผ่านเกณฑ์" : "ยังไม่ผ่านเกณฑ์ (ต้องได้ " + quiz.passScore + "% ขึ้นไป)";
      resultBox.appendChild(
        h("p", {
          class: "score " + (data.passed ? "score-pass" : "score-fail"),
          text: "ได้ " + data.score + " จาก " + data.total + " ข้อ (" + data.percent + "%) " + verdict,
        })
      );

      // ถ้าสอบผ่าน และมีบทถัดไป ให้แสดงปุ่มลัดเรียนบทถัดไปในกล่องผลลัพธ์
      if (data.passed && currentLesson && currentLesson.nextLesson) {
        var nextActionBox = h("div", { class: "quiz-next-action" }, [
          h("a", {
            class: "button cta-main",
            href: "/lesson?s=" + encodeURIComponent(currentLesson.nextLesson.slug),
            text: "เรียนบทถัดไป: " + currentLesson.nextLesson.title + " →",
          }),
        ]);
        resultBox.appendChild(nextActionBox);
      }

      data.results.forEach(function (r) {
        var fs = questionFieldsets[r.id];
        var m = marks[r.id];
        m.textContent = "";
        m.className = "mark-line " + (r.correct ? "ok" : "bad");

        var q = quiz.questions.filter(function (x) {
          return x.id === r.id;
        })[0];

        // ไฮไลต์ตัวเลือกที่ถูกต้องและผิด
        if (fs) {
          var allOpts = fs.querySelectorAll(".opt");
          for (var i = 0; i < allOpts.length; i++) {
            allOpts[i].classList.remove("is-correct", "is-wrong");
          }

          if (q && q.type === "choice") {
            var correctInp = fs.querySelector('input[value="' + r.correctAnswer + '"]');
            if (correctInp && correctInp.closest(".opt")) {
              correctInp.closest(".opt").classList.add("is-correct");
            }
            if (!r.correct) {
              var checkedInp = fs.querySelector('input[type="radio"]:checked');
              if (checkedInp && checkedInp.closest(".opt")) {
                checkedInp.closest(".opt").classList.add("is-wrong");
              }
            }
          } else {
            var numOpt = fs.querySelector(".opt.num");
            if (numOpt) {
              numOpt.classList.add(r.correct ? "is-correct" : "is-wrong");
            }
          }
        }

        m.appendChild(h("strong", { text: r.correct ? "✓ ถูกต้อง " : "✗ ยังไม่ถูก " }));
        if (!r.correct) {
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
        .then(function (res) {
          if (!res.ok) throw new Error("bad status");
          return res.json();
        })
        .then(function (data) {
          if (!data.ok) throw new Error("bad data");
          showResult(data);
        })
        .catch(function () {
          resultBox.textContent = "ตรวจคำตอบไม่สำเร็จ ลองกดส่งอีกครั้ง";
        })
        .then(function () {
          submit.disabled = false;
        });
    });

    retry.addEventListener("click", function () {
      form.reset();
      resultBox.textContent = "";
      Object.keys(marks).forEach(function (id) {
        marks[id].textContent = "";
        marks[id].className = "mark-line";
      });
      Object.keys(questionFieldsets).forEach(function (id) {
        var opts = questionFieldsets[id].querySelectorAll(".opt");
        for (var i = 0; i < opts.length; i++) {
          opts[i].classList.remove("is-selected", "is-correct", "is-wrong");
        }
      });
      retry.hidden = true;
    });

    return step("quiz", 4, "ทำแบบทดสอบ", [form]);
  }

  // ------------------------------------------------- แถบปุ่มนำทางบทก่อนหน้า/ถัดไป
  function buildLessonNav(prevLesson, nextLesson) {
    var nav = h("nav", { class: "lesson-nav", "aria-label": "บทเรียนก่อนหน้าและถัดไป" });

    if (prevLesson) {
      var prevBtn = h(
        "a",
        {
          class: "lesson-nav-btn prev",
          href: "/lesson?s=" + encodeURIComponent(prevLesson.slug),
          title: "ไปยัง: " + prevLesson.title,
        },
        [
          h("span", { class: "nav-dir", text: "← บทก่อนหน้า" }),
          h("span", { class: "nav-title", text: prevLesson.title }),
        ]
      );
      nav.appendChild(prevBtn);
    } else {
      var disabledPrev = h("div", { class: "lesson-nav-btn prev disabled" }, [
        h("span", { class: "nav-dir", text: "← บทก่อนหน้า" }),
        h("span", { class: "nav-title", text: "เริ่มต้นหลักสูตร" }),
      ]);
      nav.appendChild(disabledPrev);
    }

    var centerBtn = h("a", { class: "lesson-nav-btn center", href: "/courses" }, [
      h("span", { class: "nav-dir", text: "หลักสูตร" }),
      h("span", { class: "nav-title", text: "ดูหลักสูตรทั้งหมด" }),
    ]);
    nav.appendChild(centerBtn);

    if (nextLesson) {
      var nextBtn = h(
        "a",
        {
          class: "lesson-nav-btn next",
          href: "/lesson?s=" + encodeURIComponent(nextLesson.slug),
          title: "ไปยัง: " + nextLesson.title,
        },
        [
          h("span", { class: "nav-dir", text: "บทถัดไป →" }),
          h("span", { class: "nav-title", text: nextLesson.title }),
        ]
      );
      nav.appendChild(nextBtn);
    } else {
      var disabledNext = h("div", { class: "lesson-nav-btn next disabled" }, [
        h("span", { class: "nav-dir", text: "บทถัดไป →" }),
        h("span", { class: "nav-title", text: "สิ้นสุดหลักสูตร 🎉" }),
      ]);
      nav.appendChild(disabledNext);
    }

    return nav;
  }

  function resolvePrevNext(lesson, callback) {
    if (lesson.prevLesson !== undefined || lesson.nextLesson !== undefined) {
      callback(lesson.prevLesson || null, lesson.nextLesson || null);
      return;
    }

    // กรณีสำรอง (หาก API ยังไม่ได้ส่ง prevLesson/nextLesson มา)
    fetch("/api/catalog")
      .then(function (res) {
        if (!res.ok) throw new Error("catalog fetch error");
        return res.json();
      })
      .then(function (data) {
        if (!data.ok || !data.categories) {
          callback(null, null);
          return;
        }
        var list = [];
        data.categories.forEach(function (cat) {
          cat.chapters.forEach(function (ch) {
            (ch.lessons || []).forEach(function (l) {
              list.push({ slug: l.slug, title: l.title });
            });
          });
        });
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
          if (list[i].slug === lesson.slug) {
            idx = i;
            break;
          }
        }
        var prev = idx > 0 ? list[idx - 1] : null;
        var next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
        callback(prev, next);
      })
      .catch(function () {
        callback(null, null);
      });
  }

  // ------------------------------------------------------------------ หน้าหลัก
  function render(lesson) {
    currentLesson = lesson;
    document.title = lesson.title + " | LearnPhysics";
    root.textContent = "";

    var crumbs = h("nav", { class: "crumbs", "aria-label": "ตำแหน่งปัจจุบัน" }, [
      h("a", { href: "/courses", text: "หลักสูตร" }),
      document.createTextNode(" › " + lesson.category + " › " + lesson.chapter.title),
    ]);
    root.appendChild(crumbs);
    root.appendChild(h("h1", { text: lesson.title }));
    root.appendChild(h("p", { class: "level-badge", text: LEVELS[lesson.level] || lesson.level }));

    // แถบสถานะความคืบหน้าของบทเรียน (แสดงป้ายผ่านแล้ว)
    passedBanner = h("div", { class: "lesson-passed-banner", role: "status", "aria-live": "polite" });
    passedBanner.style.display = "none";
    root.appendChild(passedBanner);

    // การ์ดสรุปสาระสำคัญ (Key Takeaways Card)
    if (lesson.summary) {
      var summaryCard = h("div", { class: "summary-card" }, [
        h("h2", { class: "summary-card-title", text: "💡 สาระสำคัญของบทนี้" }),
        h("p", { class: "summary-card-body", text: lesson.summary }),
      ]);
      root.appendChild(summaryCard);
    }

    root.appendChild(videoStep(lesson));
    root.appendChild(animStep(lesson));
    root.appendChild(gameStep(lesson));
    root.appendChild(quizStep(lesson));
    root.appendChild(toolsBox(lesson));

    // แถบปุ่มนำทาง บทก่อนหน้า / บทถัดไป ท้ายหน้า
    var navContainer = h("div", { class: "lesson-nav-wrap" });
    root.appendChild(navContainer);

    resolvePrevNext(lesson, function (prev, next) {
      lesson.prevLesson = prev;
      lesson.nextLesson = next;
      navContainer.textContent = "";
      navContainer.appendChild(buildLessonNav(prev, next));
    });

    root.appendChild(
      h("p", {
        class: "note save-note",
        text: "ความคืบหน้าบันทึกไว้ในเครื่องนี้ เข้าสู่ระบบด้วย Google เพื่อซิงค์ข้ามอุปกรณ์",
      })
    );

    paintStatus();
  }

  // ------------------------------------------------------ บุ๊กมาร์กและโน้ตย่อ
  var NOTES_KEY = "learnphysics.notes.v1";

  function readLocalNote() {
    try {
      return (JSON.parse(localStorage.getItem(NOTES_KEY)) || {})[slug] || "";
    } catch (e) {
      return "";
    }
  }

  function writeLocalNote(text) {
    try {
      var all = JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
      if (text) all[slug] = text;
      else delete all[slug];
      localStorage.setItem(NOTES_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function toolsBox() {
    var box = h("div", { class: "lesson-tools" });

    var bm = h("button", { type: "button", class: "bookmark-btn" });
    var bmNote = h("span", { class: "notes-hint" });
    function paintBookmark() {
      var on = window.LPAuth && window.LPAuth.bookmarks.indexOf(slug) !== -1;
      bm.classList.toggle("on", !!on);
      bm.textContent = on ? "⭐ บันทึกบทเรียนนี้แล้ว (กดเพื่อเอาออก)" : "⭐ บันทึกบทเรียนนี้ (Bookmark)";
      bm.setAttribute("aria-pressed", on ? "true" : "false");
    }
    bm.addEventListener("click", function () {
      if (!window.LPAuth || !window.LPAuth.user) {
        bmNote.textContent = "เข้าสู่ระบบด้วย Google ก่อน จึงจะบันทึกบทเรียนไว้ได้";
        return;
      }
      bm.disabled = true;
      window.LPAuth.toggleBookmark(slug).then(function () {
        bm.disabled = false;
        paintBookmark();
      });
    });
    box.appendChild(h("div", null, [bm, document.createTextNode(" "), bmNote]));

    var area = h("textarea", { id: "lesson-note", maxlength: "5000", "aria-label": "โน้ตย่อส่วนตัว", placeholder: "จดสิ่งที่อยากจำจากบทนี้..." });
    var saveBtn = h("button", { type: "button", text: "บันทึกโน้ต" });
    var hint = h("span", { class: "notes-hint", role: "status", "aria-live": "polite" });
    var notes = h("div", { class: "notes-box" }, [
      h("h2", { text: "📝 โน้ตย่อส่วนตัวของฉัน" }),
      area,
      h("div", { class: "notes-actions" }, [saveBtn, hint]),
    ]);
    box.appendChild(notes);

    function loadNote() {
      var loggedIn = window.LPAuth && window.LPAuth.user;
      if (!loggedIn) {
        area.value = readLocalNote();
        hint.textContent = "เก็บไว้ในเครื่องนี้ · เข้าสู่ระบบด้วย Google เพื่อซิงค์ข้ามอุปกรณ์";
        return;
      }
      hint.textContent = "";
      window.LPAuth.api("/api/notes/" + encodeURIComponent(slug)).then(function (data) {
        var local = readLocalNote();
        if (data.ok && data.body) area.value = data.body;
        else if (local) {
          // มีโน้ตที่จดไว้ก่อนล็อกอิน ส่งขึ้นเซิร์ฟเวอร์
          area.value = local;
          window.LPAuth.api("/api/notes/" + encodeURIComponent(slug), "POST", { body: local });
        }
      });
    }

    saveBtn.addEventListener("click", function () {
      var text = area.value.trim();
      if (!window.LPAuth || !window.LPAuth.user) {
        writeLocalNote(text);
        hint.textContent = "บันทึกในเครื่องนี้แล้ว · เข้าสู่ระบบด้วย Google เพื่อซิงค์ข้ามอุปกรณ์";
        return;
      }
      saveBtn.disabled = true;
      window.LPAuth.api("/api/notes/" + encodeURIComponent(slug), "POST", { body: text })
        .then(function (data) {
          if (!data.ok) throw new Error("fail");
          writeLocalNote("");
          hint.textContent = "บันทึกโน้ตแล้ว (ซิงค์ข้ามอุปกรณ์)";
        })
        .catch(function () {
          hint.textContent = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";
        })
        .then(function () {
          saveBtn.disabled = false;
        });
    });

    function refresh() {
      var vb = document.getElementById("video-done");
      if (vb) vb.checked = getProgress().video;
      paintBookmark();
      loadNote();
      paintStatus();
    }
    refresh();
    document.addEventListener("lp:auth-ready", refresh);
    return box;
  }

  function fail(text) {
    root.textContent = "";
    root.appendChild(h("h1", { text: "เปิดบทเรียนไม่ได้" }));
    root.appendChild(h("p", { class: "lead", text: text }));
    root.appendChild(h("p", null, [h("a", { class: "back", href: "/courses", text: "กลับไปหน้าหลักสูตร" })]));
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    fail("ไม่พบบทเรียนนี้ ลองเลือกจากหน้าหลักสูตร");
    return;
  }

  fetch("/api/lessons/" + encodeURIComponent(slug))
    .then(function (res) {
      if (res.status === 404) {
        fail("ไม่พบบทเรียนนี้ ลองเลือกจากหน้าหลักสูตร");
        return null;
      }
      if (!res.ok) throw new Error("bad status");
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      if (!data.ok) throw new Error("bad data");
      render(data.lesson);
    })
    .catch(function () {
      fail("โหลดบทเรียนไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง");
    });
})();
