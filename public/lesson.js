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
      stars: typeof p.stars === "number" && p.stars > 0 ? Math.min(3, p.stars) : (p.game ? 1 : 0),
      gameScore: typeof p.gameScore === "number" ? p.gameScore : 0,
    };
  }

  function setProgress(key, value, extra) {
    try {
      var all = readAll();
      var p = all[slug] || {};
      if (key === "quiz") {
        p.quiz = Math.max(typeof p.quiz === "number" ? p.quiz : 0, value);
      } else {
        p[key] = value;
      }
      if (extra && typeof extra === "object") {
        if (typeof extra.stars === "number") {
          p.stars = Math.max(typeof p.stars === "number" ? p.stars : 0, Math.min(3, Math.max(1, Math.round(extra.stars))));
        }
        if (typeof extra.gameScore === "number") {
          p.gameScore = Math.max(typeof p.gameScore === "number" ? p.gameScore : 0, Math.round(extra.gameScore));
        }
      }
      all[slug] = p;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) {
      /* เก็บไม่ได้ก็ไม่เป็นไร ใช้งานต่อได้ */
    }
    // ล็อกอินอยู่: ส่งขึ้นเซิร์ฟเวอร์ด้วย (ผลควิซถูกบันทึกฝั่งเซิร์ฟเวอร์อยู่แล้วตอนตรวจ)
    if (window.LPAuth && window.LPAuth.user) window.LPAuth.pushProgress(slug);
    document.dispatchEvent(new CustomEvent("lp:progress-updated", { detail: { slug: slug, key: key } }));
  }

  var statusEls = {};
  var passedBanner = null;
  var currentLesson = null;

  function paintStatus() {
    var p = getProgress();
    var map = {
      video: p.video ? "ศึกษาแล้ว" : "",
      anim: p.anim ? "ทดลองแล้ว" : "",
      game: p.game ? "ผ่านกิจกรรมแล้ว " + "⭐".repeat(Math.max(1, Math.min(3, p.stars || 3))) : "",
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
        passedBanner.textContent = "✓ คุณผ่านเกณฑ์การประเมินของบทเรียนนี้แล้ว";
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
      nodes.push(notReady("ยังไม่มีสื่อการสอนสำหรับบทเรียนนี้"));
    } else {
      var list = h("ul", { class: "videos" });
      lesson.videos.forEach(function (v) {
        var linkText = v.provider === "youtube" ? "รับชมสื่อการสอน (YouTube)" : "รับชมสื่อการสอน";
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
            h("span", { class: "muted" }, [document.createTextNode("ที่มา: ช่อง "), channel]),
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
      nodes.push(h("div", { class: "field check" }, [box, h("label", { for: boxId, text: "ศึกษาเนื้อหาวิดีโอครบถ้วนแล้ว" })]));
      nodes.push(
        h("p", {
          class: "note",
          text: "สื่อการสอนจะเปิดในแท็บใหม่ เมื่อศึกษาเสร็จแล้วสามารถทำกิจกรรมในขั้นตอนถัดไปได้ทันที",
        })
      );
    }
    return step("video", 1, "ศึกษาสื่อการสอน", nodes);
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
      box.appendChild(notReady("ห้องปฏิบัติการจำลองของบทนี้กำลังจัดทำ"));
    }
    return step("anim", 2, a && a.title ? "ห้องปฏิบัติการจำลอง: " + a.title : "ห้องปฏิบัติการจำลอง", [box]);
  }

  function gameStep(lesson) {
    var box = h("div", { class: "sim" });
    var g = lesson.game;
    var game = g && window.LPEngines && window.LPEngines.games[g.template];
    var sessionNotified = false;
    if (game) {
      game(box, g.config, {
        onWin: function (attempts, stars, score) {
          var earnedStars = Math.max(1, Math.min(3, stars || (attempts === 1 ? 3 : attempts === 2 ? 2 : 1)));
          setProgress("game", true, { stars: earnedStars, gameScore: score || 100 });
          paintStatus();
          if (!sessionNotified) {
            sessionNotified = true;
            if (window.LPGamify) {
              window.LPGamify.confetti();
              window.LPGamify.showToast("ผ่านภารกิจฝึกทักษะ!", "ได้รับ " + "⭐".repeat(earnedStars) + " และคะแนนสะสม XP", "🎮");
            }
          }
        },
      });
    } else {
      box.appendChild(notReady("กิจกรรมฝึกทักษะของบทนี้กำลังจัดทำ"));
    }
    return step("game", 3, g && g.title ? "กิจกรรมฝึกทักษะ: " + g.title : "กิจกรรมฝึกทักษะ", [box]);
  }

  // ------------------------------------------------------------- แบบทดสอบ
  function quizStep(lesson) {
    var quiz = lesson.quiz;
    if (!quiz || !quiz.questions.length) {
      return step("quiz", 4, "แบบประเมินผลการเรียนรู้", [notReady("แบบประเมินผลของบทนี้กำลังจัดทำ")]);
    }

    var form = h("form", { class: "quiz", novalidate: "novalidate" });
    var resultBox = h("div", { class: "quiz-result", "aria-live": "polite" });
    var submit = h("button", { type: "submit", text: "ส่งตรวจคำตอบ" });
    var retry = h("button", { type: "button", class: "secondary", text: "ทำแบบประเมินอีกครั้ง" });
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
      var checkOneBtn = h("button", { type: "button", class: "secondary q-check-btn", text: "🔍 ตรวจคำตอบข้อนี้" });
      checkOneBtn.addEventListener("click", function () {
        var curAnswers = collect();
        if (curAnswers[q.id] === undefined) {
          mark.className = "mark-line bad";
          mark.textContent = "กรุณาเลือกหรือกรอกคำตอบของข้อนี้ก่อนตรวจ";
          return;
        }
        var single = {};
        single[q.id] = curAnswers[q.id];
        checkOneBtn.disabled = true;
        fetch("/api/quizzes/" + quiz.id + "/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: single }),
        })
          .then(function (res) {
            if (res.status === 401) {
              mark.className = "mark-line bad";
              mark.textContent = "🔒 กรุณาเข้าสู่ระบบก่อนตรวจคำตอบ";
              return null;
            }
            if (!res.ok) throw new Error("bad status");
            return res.json();
          })
          .then(function (data) {
            if (!data || !data.ok || !data.results) return;
            var hit = data.results.filter(function (x) { return x.id === q.id; })[0];
            if (!hit) return;
            applyQuestionMark(hit);
            if (window.LPSound) {
              if (hit.correct && window.LPSound.tick) window.LPSound.tick();
              else if (!hit.correct && window.LPSound.miss) window.LPSound.miss();
            }
          })
          .catch(function () {
            mark.className = "mark-line bad";
            mark.textContent = "ตรวจคำตอบข้อนี้ไม่สำเร็จ กรุณาลองอีกครั้ง";
          })
          .then(function () {
            checkOneBtn.disabled = false;
          });
      });
      fs.appendChild(h("div", { class: "q-practice-row" }, [checkOneBtn]));
      fs.appendChild(mark);
      form.appendChild(fs);
    });

    form.appendChild(h("div", { class: "actions" }, [submit, retry]));
    form.appendChild(resultBox);

    function applyQuestionMark(r) {
      var fs = questionFieldsets[r.id];
      var m = marks[r.id];
      if (!m) return;
      m.textContent = "";
      m.className = "mark-line " + (r.correct ? "ok" : "bad");

      var q = quiz.questions.filter(function (x) {
        return x.id === r.id;
      })[0];

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
    }

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

      data.results.forEach(applyQuestionMark);

      retry.hidden = false;
      setProgress("quiz", data.percent);
      paintStatus();
      if (data.passed) {
        if (window.LPSound) window.LPSound.fanfare();
        if (window.LPGamify) {
          window.LPGamify.confetti();
          var bonusText = data.percent === 100 ? "รับโบนัส +150 XP (เต็ม 100%!)" : "รับโบนัส +100 XP สะสมเข้าโปรไฟล์";
          window.LPGamify.showToast("ผ่านการประเมินผล! (" + data.percent + "%)", bonusText, "🏆");
        }
      } else {
        if (window.LPSound) window.LPSound.miss();
      }
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
          if (res.status === 401) {
            resultBox.textContent = "🔒 กรุณาเข้าสู่ระบบก่อนตรวจคำตอบ";
            return null;
          }
          if (!res.ok) throw new Error("bad status");
          return res.json();
        })
        .then(function (data) {
          if (!data) return;
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

    return step("quiz", 4, "แบบประเมินผลการเรียนรู้", [form]);
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

  function createBookmarkControl() {
    var bm = h("button", { type: "button", class: "bookmark-btn" });
    var bmNote = h("span", { class: "notes-hint" });
    function paintBookmark() {
      var on = window.LPAuth && window.LPAuth.bookmarks.indexOf(slug) !== -1;
      bm.classList.toggle("on", !!on);
      bm.textContent = on ? "⭐ บันทึกบทเรียนแล้ว" : "☆ บันทึกบทนี้";
      bm.setAttribute("aria-pressed", on ? "true" : "false");
    }
    bm.addEventListener("click", function () {
      if (!window.LPAuth || !window.LPAuth.user) {
        bmNote.textContent = "เข้าสู่ระบบด้วย Google ก่อนเพื่อบันทึกบทเรียน";
        return;
      }
      bm.disabled = true;
      window.LPAuth.toggleBookmark(slug).then(function () {
        bm.disabled = false;
        paintBookmark();
        bmNote.textContent = "";
      });
    });
    var wrap = h("div", { class: "bookmark-inline-wrap" }, [bm, bmNote]);
    paintBookmark();
    return {
      element: wrap,
      refresh: paintBookmark,
    };
  }

  function createNotesBox() {
    var area = h("textarea", { id: "lesson-note", maxlength: "5000", "aria-label": "บันทึกย่อส่วนบุคคล", placeholder: "จดสรุปแนวคิดสำคัญ สูตร หรือข้อสังเกตจากบทเรียนนี้..." });
    var saveBtn = h("button", { type: "button", text: "บันทึกข้อความ" });
    var hint = h("span", { class: "notes-hint", role: "status", "aria-live": "polite" });
    var notes = h("div", { class: "notes-box", style: "margin-top: 36px;" }, [
      h("h2", { text: "📝 บันทึกย่อส่วนบุคคล" }),
      area,
      h("div", { class: "notes-actions" }, [saveBtn, hint]),
    ]);

    function loadNote() {
      if (!window.LPAuth || !window.LPAuth.user) return;
      window.LPAuth.api("/api/notes/" + encodeURIComponent(slug)).then(function (data) {
        if (data.ok && data.body) {
          area.value = data.body;
          hint.textContent = "บันทึกข้อความผูกกับบัญชีของคุณแล้ว";
        }
      });
    }

    saveBtn.addEventListener("click", function () {
      var text = area.value.trim();
      if (!window.LPAuth || !window.LPAuth.user) {
        hint.textContent = "🔒 กรุณาเข้าสู่ระบบด้วย Google ก่อนบันทึกข้อความ";
        return;
      }
      saveBtn.disabled = true;
      hint.textContent = "กำลังบันทึก...";
      window.LPAuth.api("/api/notes/" + encodeURIComponent(slug), "POST", { body: text })
        .then(function (data) {
          if (!data.ok) throw new Error("fail");
          hint.textContent = "✓ บันทึกข้อความผูกกับบัญชีของคุณแล้ว";
        })
        .catch(function () {
          hint.textContent = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";
        })
        .then(function () {
          saveBtn.disabled = false;
        });
    });

    loadNote();
    return {
      element: notes,
      refresh: loadNote,
    };
  }

  // ------------------------------------------------ สรุปสูตร & ตัวอย่างวิธีทำ
  var STUDY_GUIDES = {
    projectile: {
      title: "สูตรสำคัญและตัวอย่าง: การเคลื่อนที่แบบโพรเจกไทล์",
      formulas: [
        { eq: "R = (v₀² sin 2θ) / g", desc: "ระยะไกลสุดในแนวระดับ (เมตร)" },
        { eq: "H = (v₀² sin² θ) / (2g)", desc: "ความสูงสูงสุดที่วัตถุขึ้นไปได้ (เมตร)" },
        { eq: "T = (2 v₀ sin θ) / g", desc: "เวลาทั้งหมดในการลอยตัวในอากาศ (วินาที)" },
      ],
      example: {
        problem: "ยิงลูกบอลด้วยความเร็วต้น v₀ = 20 ม./วิ ทำมุม θ = 30° กับแนวราบ (ใช้ g = 10 ม./วิ²)",
        steps: [
          "ขั้นที่ 1 แตกความเร็วต้น: vₓ = 20 cos 30° ≈ 17.32 ม./วิ และ vᵧ = 20 sin 30° = 10 ม./วิ",
          "ขั้นที่ 2 หาเวลาทั้งหมด: T = 2vᵧ / g = (2 × 10) / 10 = 2.0 วินาที",
          "ขั้นที่ 3 หาระยะไกลสุดและความสูงสูงสุด: R = vₓ × T ≈ 34.6 ม., H = vᵧ² / (2g) = 100 / 20 = 5.0 ม."
        ],
        answer: "คำตอบ: ใช้เวลา 2.0 วินาที สูงสุด 5.0 ม. และตกไกลประมาณ 34.6 ม."
      }
    },
    coulomb: {
      title: "สูตรสำคัญและตัวอย่าง: แรงระหว่างประจุไฟฟ้า (กฎของคูลอมบ์)",
      formulas: [
        { eq: "F = k |q₁ q₂| / r²", desc: "แรงดึงดูดหรือแรงผลักระหว่างประจุ (นิวตัน, k = 9×10⁹ N·m²/C²)" },
        { eq: "E = k |q| / r²", desc: "ขนาดของสนามไฟฟ้า ณ ตำแหน่งห่าง r (N/C)" },
      ],
      example: {
        problem: "ประจุ +2 μC และ +3 μC วางห่างกัน r = 0.3 เมตร จงหาแรงผลักระหว่างกัน",
        steps: [
          "ขั้นที่ 1 แปลงหน่วยประจุ: q₁ = 2 × 10⁻⁶ C, q₂ = 3 × 10⁻⁶ C",
          "ขั้นที่ 2 แทนค่าใน F = k|q₁q₂|/r² = (9×10⁹)(2×10⁻⁶)(3×10⁻⁶) / (0.3)²",
          "ขั้นที่ 3 คำนวณ: ตัวเศษ = 54×10⁻³ และ r² = 0.09 จะได้ F = 0.054 / 0.09"
        ],
        answer: "คำตอบ: เกิดแรงผลักขนาด F = 0.60 นิวตัน"
      }
    },
    reflection: {
      title: "สูตรสำคัญและตัวอย่าง: การสะท้อนของแสงบนกระจกเงา",
      formulas: [
        { eq: "θᵢ = θᵣ", desc: "มุมตกกระทบเท่ากับมุมสะท้อน (วัดเทียบกับเส้นปกติ)" },
        { eq: "มุมเบี่ยงเบน δ = 180° − 2θᵢ", desc: "มุมที่รังสีสะท้อนเบี่ยงออกจากทิศเดิมของรังสีตกกระทบ" },
      ],
      example: {
        problem: "รังสีแสงตกกระทบกระจกเงาราบทำมุมตกกระทบ 35° กับเส้นปกติ จงหามุมสะท้อนและมุมรวมระหว่างรังสี",
        steps: [
          "ขั้นที่ 1 จากกฎการสะท้อน มุมสะท้อน θᵣ เท่ากับมุมตกกระทบ θᵢ = 35°",
          "ขั้นที่ 2 มุมระหว่างรังสีตกกระทบกับรังสีสะท้อน = θᵢ + θᵣ = 35° + 35°",
          "ขั้นที่ 3 คำนวณมุมเทียบผิวกระจก = 90° − 35° = 55°"
        ],
        answer: "คำตอบ: มุมสะท้อน = 35° และมุมระหว่างสองรังสี = 70°"
      }
    },
    "ohm-law": {
      title: "สูตรสำคัญและตัวอย่าง: กฎของโอห์มและวงจรไฟฟ้ากระแสตรง",
      formulas: [
        { eq: "V = I R", desc: "ความต่างศักย์ V (โวลต์) เท่ากับ กระแส I (แอมแปร์) × ความต้านทาน R (โอห์ม)" },
        { eq: "P = I V = I² R", desc: "กำลังไฟฟ้าที่ใช้ไปในตัวต้านทาน (วัตต์)" },
      ],
      example: {
        problem: "ต่อแบตเตอรี่ 12 V เข้ากับตัวต้านทานอนุกรม 4 Ω และ 2 Ω จงหากระแส I และกำลังไฟฟ้า P",
        steps: [
          "ขั้นที่ 1 หาความต้านทานรวมอนุกรม: R_total = 4 + 2 = 6 Ω",
          "ขั้นที่ 2 ใช้กฎของโอห์ม: I = V / R_total = 12 / 6 = 2.0 แอมแปร์",
          "ขั้นที่ 3 หากำลังไฟฟ้าทั้งหมด: P = I × V = 2 × 12 = 24 วัตต์"
        ],
        answer: "คำตอบ: กระแสไฟฟ้าในวงจร I = 2.0 A และกำลังไฟฟ้า P = 24 W"
      }
    },
    "snell-law": {
      title: "สูตรสำคัญและตัวอย่าง: การหักเหของแสง (กฎของสเนลล์)",
      formulas: [
        { eq: "n₁ sin θ₁ = n₂ sin θ₂", desc: "ความสัมพันธ์ดัชนีหักเหและมุมเทียบเส้นปกติของตัวกลาง 1 และ 2" },
        { eq: "sin θ_c = n₂ / n₁", desc: "มุมวิกฤตเมื่อแสงเดินทางจากตัวกลางหนาแน่นไปน้อยกว่า (n₁ > n₂)" },
      ],
      example: {
        problem: "แสงเดินทางจากอากาศ (n₁ = 1.0) ด้วยมุม 30° เข้าสู่ตัวกลางใสที่มี n₂ = 1.5 จงหาค่า sin θ₂",
        steps: [
          "ขั้นที่ 1 ตั้งสมการกฎของสเนลล์: 1.0 × sin 30° = 1.5 × sin θ₂",
          "ขั้นที่ 2 แทนค่า sin 30° = 0.5 จะได้ 0.5 = 1.5 × sin θ₂",
          "ขั้นที่ 3 แก้สมการ: sin θ₂ = 0.5 / 1.5 = 1/3 ≈ 0.333 (θ₂ ≈ 19.5°)"
        ],
        answer: "คำตอบ: มุมหักเห θ₂ ≈ 19.5° (เบนเข้าหาเส้นปกติ)"
      }
    },
    "harmonic-wave": {
      title: "สูตรสำคัญและตัวอย่าง: สมบัติคลื่นกลและอัตราเร็วคลื่น",
      formulas: [
        { eq: "v = f λ", desc: "อัตราเร็วคลื่น (ม./วิ) = ความถี่ (Hz) × ความยาวคลื่น (ม.)" },
        { eq: "T = 1 / f", desc: "คาบการสั่น (วินาที) เป็นส่วนกลับของความถี่ (Hz)" },
      ],
      example: {
        problem: "คลื่นน้ำมีความถี่ f = 4 Hz และวัดระยะระหว่างสันคลื่นที่ติดกันได้ λ = 2.5 เมตร จงหาอัตราเร็วคลื่น",
        steps: [
          "ขั้นที่ 1 ระบุตัวแปร: ความถี่ f = 4 Hz และความยาวคลื่น λ = 2.5 ม.",
          "ขั้นที่ 2 แทนค่าใน v = f λ = 4 × 2.5",
          "ขั้นที่ 3 หาคาบคลื่นเพิ่มเติม: T = 1 / 4 = 0.25 วินาที"
        ],
        answer: "คำตอบ: อัตราเร็วคลื่น v = 10.0 ม./วิ และคาบ T = 0.25 วินาที"
      }
    },
    "newton-force": {
      title: "สูตรสำคัญและตัวอย่าง: กฎการเคลื่อนที่ของนิวตันและแรงเสียดทาน",
      formulas: [
        { eq: "ΣF = m a", desc: "แรงลัพธ์ที่กระทำต่อวัตถุ = มวล (กก.) × ความเร่ง (ม./วิ²)" },
        { eq: "f = μ N = μ m g", desc: "แรงเสียดทานจลน์บนพื้นราบ (นิวตัน)" },
      ],
      example: {
        problem: "ออกแรง 30 N ดึงกล่องมวล 5 กก. บนพื้นราบที่มีค่า μ = 0.2 (ใช้ g = 10 ม./วิ²) จงหาความเร่ง a",
        steps: [
          "ขั้นที่ 1 หาแรงเสียดทานจลน์: f = μmg = 0.2 × 5 × 10 = 10 นิวตัน",
          "ขั้นที่ 2 หาแรงลัพธ์แนวระดับ: ΣF = F − f = 30 − 10 = 20 นิวตัน",
          "ขั้นที่ 3 หาความเร่ง: a = ΣF / m = 20 / 5 = 4.0 ม./วิ²"
        ],
        answer: "คำตอบ: กล่องเคลื่อนที่ด้วยความเร่ง a = 4.0 ม./วิ²"
      }
    },
    "linear-motion": {
      title: "สูตรสำคัญและตัวอย่าง: การเคลื่อนที่แนวตรงด้วยความเร่งคงตัว",
      formulas: [
        { eq: "v = u + a t", desc: "ความเร็วปลาย (ม./วิ) จากความเร็วต้น ความเร่ง และเวลา" },
        { eq: "s = u t + ½ a t²", desc: "การกระจัดในเวลา t (เมตร)" },
        { eq: "v² = u² + 2 a s", desc: "สมการเชื่อมความเร็วและการกระจัดเมื่อไม่ทราบเวลา t" },
      ],
      example: {
        problem: "รถทดลองออกวิ่งจากจุดหยุดนิ่ง (u = 0) ด้วยความเร่ง a = 3 ม./วิ² เป็นเวลา 4 วินาที จะได้ระยะทางเท่าไร",
        steps: [
          "ขั้นที่ 1 กำหนดค่า: u = 0 ม./วิ, a = 3 ม./วิ², t = 4 วิ",
          "ขั้นที่ 2 แทนค่าใน s = ut + ½at² = 0 + 0.5 × 3 × (4)²",
          "ขั้นที่ 3 คำนวณ: s = 1.5 × 16 = 24 เมตร (ความเร็วปลาย v = 3 × 4 = 12 ม./วิ)"
        ],
        answer: "คำตอบ: เคลื่อนที่ได้ระยะทาง s = 24 เมตร และความเร็วปลาย 12 ม./วิ"
      }
    },
    "momentum-collision": {
      title: "สูตรสำคัญและตัวอย่าง: โมเมนตัมและการชน",
      formulas: [
        { eq: "p = m v", desc: "โมเมนตัมของวัตถุ (กก.·ม./วิ)" },
        { eq: "m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂", desc: "กฎการอนุรักษ์โมเมนตัมรวมก่อนชน = หลังชน" },
      ],
      example: {
        problem: "รถมวล 2 กก. วิ่งด้วยความเร็ว 6 ม./วิ พุ่งเข้าชนติดกันไปกับรถมวล 4 กก. ที่หยุดนิ่ง จงหาความเร็วหลังชน",
        steps: [
          "ขั้นที่ 1 โมเมนตัมรวมก่อนชน: P_ก่อน = (2 × 6) + (4 × 0) = 12 กก.·ม./วิ",
          "ขั้นที่ 2 หลังชนติดกัน มวลรวม M = 2 + 4 = 6 กก. เคลื่อนที่ด้วยความเร็ว v",
          "ขั้นที่ 3 ใช้กฎอนุรักษ์โมเมนตัม: 12 = 6 × v  =>  v = 12 / 6 = 2.0 ม./วิ"
        ],
        answer: "คำตอบ: รถทั้งสองเคลื่อนที่ติดกันไปด้วยความเร็ว v = 2.0 ม./วิ"
      }
    },
    "circular-shm": {
      title: "สูตรสำคัญและตัวอย่าง: การเคลื่อนที่แบบวงกลมและฮาร์มอนิกอย่างง่าย",
      formulas: [
        { eq: "F_c = m v² / r = m ω² r", desc: "แรงสู่ศูนย์กลางทิศพุ่งเข้าจุดศูนย์กลาง (นิวตัน)" },
        { eq: "T = 2π √(m / k)", desc: "คาบการสั่นของมวลติดปลายสปริง (วินาที)" },
      ],
      example: {
        problem: "แขวนมวล m = 1 กก. ติดสปริงค่า k = 100 นิวตัน/เมตร จงหาอัตราเร็วเชิงมุม ω และคาบ T",
        steps: [
          "ขั้นที่ 1 หาอัตราเร็วเชิงมุม: ω = √(k / m) = √(100 / 1) = 10 rad/s",
          "ขั้นที่ 2 หาคาบการสั่น: T = 2π / ω = 2 × 3.14 / 10 ≈ 0.63 วินาที",
          "ขั้นที่ 3 ความถี่การสั่น: f = 1 / T ≈ 1.59 Hz"
        ],
        answer: "คำตอบ: คาบการสั่น T ≈ 0.63 วินาที (ω = 10 rad/s)"
      }
    },
    "fluid-pressure": {
      title: "สูตรสำคัญและตัวอย่าง: ความดันของไหลและแรงพยุง (อาร์คิมิดิส)",
      formulas: [
        { eq: "P = P₀ + ρ g h", desc: "ความดันสัมบูรณ์ที่ลึก h (kPa) โดยความดันเกจ P_g = ρgh" },
        { eq: "F_B = ρ_ของเหลว V_จม g", desc: "แรงพยุงของของไหล (นิวตัน)" },
      ],
      example: {
        problem: "วัดความดันใต้น้ำบริสุทธิ์ (ρ = 1,000 กก./ม.³) ลึก h = 5 เมตร (g = 9.8, P₀ = 101.3 kPa)",
        steps: [
          "ขั้นที่ 1 หาความดันเกจ: P_g = ρgh = 1000 × 9.8 × 5 = 49,000 Pa = 49.0 kPa",
          "ขั้นที่ 2 รวมความดันบรรยากาศ P₀ = 101.3 kPa",
          "ขั้นที่ 3 ความดันสัมบูรณ์ P_รวม = 101.3 + 49.0 = 150.3 kPa"
        ],
        answer: "คำตอบ: ความดันเกจ = 49.0 kPa และความดันสัมบูรณ์ = 150.3 kPa"
      }
    },
    "ideal-gas": {
      title: "สูตรสำคัญและตัวอย่าง: กฎของแก๊สอุดมคติและพลังงานภายใน",
      formulas: [
        { eq: "P V = n R T", desc: "สมการแก๊สอุดมคติ (T ต้องเป็นเคลวิน K = °C + 273, R = 8.314)" },
        { eq: "U = (3/2) n R T", desc: "พลังงานภายในแก๊สอะตอมเดี่ยว (จูล)" },
      ],
      example: {
        problem: "แก๊สอุดมคติ n = 1 โมล อุณหภูมิ T = 300 K บรรจุในลูกสูบปริมาตร V = 5 ลิตร จงหาความดันแก๊ส",
        steps: [
          "ขั้นที่ 1 แปลงปริมาตรเป็น ลบ.ม.: V = 5 × 10⁻³ ม.³ (หรือใช้สูตรตรงได้หน่วย kPa เมื่อ V เป็นลิตร)",
          "ขั้นที่ 2 คำนวณ P = (n R T) / V_ลิตร = (1 × 8.314 × 300) / 5",
          "ขั้นที่ 3 ได้ P = 2494.2 / 5 = 498.8 kPa และพลังงานภายใน U = 1.5 × 2494.2 ≈ 3,741 J"
        ],
        answer: "คำตอบ: ความดันแก๊ส P ≈ 498.8 kPa และพลังงานภายใน ≈ 3,741 J"
      }
    },
    "thin-lens": {
      title: "สูตรสำคัญและตัวอย่าง: สมการเลนส์บางและกำลังขยาย",
      formulas: [
        { eq: "1/f = 1/s + 1/s'", desc: "เลนส์นูน f > 0, เลนส์เว้า f < 0; s' > 0 คือภาพจริง" },
        { eq: "m = −s' / s = h' / h", desc: "กำลังขยายเชิงเส้นและทิศหัวตั้ง/หัวกลับ" },
      ],
      example: {
        problem: "วางวัตถุห่างจากเลนส์นูน (f = 10 ซม.) เป็นระยะ s = 30 ซม. จงหาระยะภาพ s' และกำลังขยาย",
        steps: [
          "ขั้นที่ 1 แทนค่าในสมการ 1/10 = 1/30 + 1/s'",
          "ขั้นที่ 2 ย้ายข้าง: 1/s' = 1/10 − 1/30 = (3 − 1)/30 = 2/30 = 1/15",
          "ขั้นที่ 3 ได้ s' = +15 ซม. (ภาพจริง) และกำลังขยาย |m| = 15/30 = 0.5 เท่า (หัวกลับ)"
        ],
        answer: "คำตอบ: เกิดภาพจริงหัวกลับหลังเลนส์ที่ระยะ s' = 15 ซม. ขนาด 0.5 เท่า"
      }
    },
    "magnetic-induction": {
      title: "สูตรสำคัญและตัวอย่าง: แรงแม่เหล็กและการเหนี่ยวนำไฟฟ้า",
      formulas: [
        { eq: "F = q v B sin θ", desc: "แรงลอเรนตซ์กระทำต่อประจุวิ่งตัดสนามแม่เหล็ก B (นิวตัน)" },
        { eq: "ε = B L v", desc: "แรงเคลื่อนไฟฟ้าเหนี่ยวนำบนลวดตัวนำยาว L เคลื่อนที่เร็ว v ตัดสนาม B (โวลต์)" },
      ],
      example: {
        problem: "ลวดตัวนำยาว L = 0.5 ม. เคลื่อนที่ด้วยเร็ว v = 8 ม./วิ ตั้งฉากกับสนาม B = 1.2 T จงหา EMF",
        steps: [
          "ขั้นที่ 1 ระบุค่า: B = 1.2 T, L = 0.5 ม., v = 8 ม./วิ",
          "ขั้นที่ 2 คำนวณแรงเคลื่อนไฟฟ้า: ε = B L v = 1.2 × 0.5 × 8",
          "ขั้นที่ 3 ได้ ε = 4.8 โวลต์ (ถ้า R = 2 Ω จะเกิดกระแสเหนี่ยวนำ I = 4.8/2 = 2.4 A)"
        ],
        answer: "คำตอบ: แรงเคลื่อนไฟฟ้าเหนี่ยวนำ ε = 4.8 โวลต์"
      }
    },
    photoelectric: {
      title: "สูตรสำคัญและตัวอย่าง: ปรากฏการณ์โฟโตอิเล็กทริก",
      formulas: [
        { eq: "E = h f", desc: "พลังงานของโฟตอน 1 อนุภาค (h ≈ 4.136×10⁻¹⁵ eV·s)" },
        { eq: "Ek_max = h f − W₀", desc: "พลังงานจลน์สูงสุดของอิเล็กตรอนที่หลุดออกจากผิวโลหะ (eV)" },
      ],
      example: {
        problem: "ฉายแสงความถี่ f = 10 × 10¹⁴ Hz ลงบนโลหะที่มีฟังก์ชันงาน W₀ = 2.2 eV จงหา Ek_max",
        steps: [
          "ขั้นที่ 1 หาพลังงานโฟตอน: E = hf = 0.4136 × 10 = 4.14 eV",
          "ขั้นที่ 2 เทียบกับฟังก์ชันงาน: 4.14 eV > 2.2 eV ดังนั้นอิเล็กตรอนหลุดได้",
          "ขั้นที่ 3 คำนวณ Ek_max = 4.14 − 2.20 = 1.94 eV"
        ],
        answer: "คำตอบ: โฟโตอิเล็กตรอนหลุดออกด้วยพลังงานจลน์สูงสุด Ek_max ≈ 1.94 eV"
      }
    },
    decay: {
      title: "สูตรสำคัญและตัวอย่าง: กัมมันตภาพรังสีและครึ่งชีวิต",
      formulas: [
        { eq: "N(t) = N₀ (½)^(t / T½)", desc: "ปริมาณนิวเคลียสคงเหลือหลังผ่านไปเวลา t" },
        { eq: "A = λ N", desc: "กัมมันตภาพ (อัตราการสลายตัวต่อวินาที, เบ็กเคอเรล Bq)" },
      ],
      example: {
        problem: "ธาตุกัมมันตรังสีมีปริมาณเริ่มต้น N₀ = 1,000 มิลลิกรัม และครึ่งชีวิต T½ = 4 ปี เมื่อเวลาผ่านไป 12 ปีจะเหลือเท่าใด",
        steps: [
          "ขั้นที่ 1 หาจำนวนรอบครึ่งชีวิต: n = t / T½ = 12 / 4 = 3 รอบ",
          "ขั้นที่ 2 ใช้สูตร: N = 1,000 × (½)³ = 1,000 / 8",
          "ขั้นที่ 3 คำนวณ: เหลือสาร 125 มิลลิกรัม (สลายไปแล้ว 87.5%)"
        ],
        answer: "คำตอบ: เหลือสารกัมมันตรังสีคงค้าง 125 มิลลิกรัม (12.5%)"
      }
    },
    relativity: {
      title: "สูตรสำคัญและตัวอย่าง: สัมพัทธภาพพิเศษและพลังงานมวล",
      formulas: [
        { eq: "γ = 1 / √(1 − v²/c²)", desc: "แฟกเตอร์ลอเรนตซ์สำหรับวัตถุเร็วใกล้แสง (v < c)" },
        { eq: "L = L₀ / γ , Δt = γ Δt₀", desc: "ความยาวหดสั้นและเวลาขยายออกเทียบกับผู้สังเกตอยู่นิ่ง" },
      ],
      example: {
        problem: "ยานอวกาศความยาวปกติ L₀ = 100 ม. บินผ่านโลกด้วยความเร็ว v = 0.6c จงหา γ และความยาวที่คนบนโลกวัดได้",
        steps: [
          "ขั้นที่ 1 หา β² = (0.6)² = 0.36 ดังนั้น 1 − β² = 0.64",
          "ขั้นที่ 2 คำนวณ γ = 1 / √0.64 = 1 / 0.8 = 1.25",
          "ขั้นที่ 3 ความยาวหดสั้น L = L₀ / γ = 100 / 1.25 = 80 เมตร"
        ],
        answer: "คำตอบ: แฟกเตอร์ γ = 1.25 และผู้สังเกตบนโลกวัดความยาวได้ 80 เมตร"
      }
    }
  };

  function resolveStudyKey(lesson) {
    if (lesson && lesson.animation && lesson.animation.engine) {
      if (lesson.animation.engine === "modern-quantum") {
        var mode = (lesson.animation.config && lesson.animation.config.mode) || "photoelectric";
        return STUDY_GUIDES[mode] ? mode : "photoelectric";
      }
      if (STUDY_GUIDES[lesson.animation.engine]) return lesson.animation.engine;
    }
    var gMap = {
      "aim-and-shoot": "projectile",
      "match-circuit": "ohm-law",
      "wave-tuner": "harmonic-wave",
      "balance-force": "newton-force",
      "lens-focus": "thin-lens",
      "thermal-piston": "ideal-gas",
      "quantum-lab": "photoelectric"
    };
    if (lesson && lesson.game && gMap[lesson.game.template]) return gMap[lesson.game.template];
    return "projectile";
  }

  function buildStudySection(lesson) {
    var guide = STUDY_GUIDES[resolveStudyKey(lesson)];
    var formulaGrid = h("div", { class: "study-formula-grid" },
      guide.formulas.map(function (f) {
        return h("div", { class: "study-formula-item" }, [
          h("code", { class: "study-eq", text: f.eq }),
          h("span", { class: "study-desc", text: f.desc })
        ]);
      })
    );

    var stepsList = h("ol", { class: "study-steps" },
      guide.example.steps.map(function (stTxt) {
        return h("li", { text: stTxt });
      })
    );

    var exBox = h("div", { class: "study-example-box" }, [
      h("p", { class: "study-ex-prob", text: guide.example.problem }),
      stepsList,
      h("p", { class: "study-ex-ans", text: guide.example.answer })
    ]);

    var exDrawer = h("details", { class: "study-example-drawer" }, [
      h("summary", { class: "study-example-summary", text: "✏️ ดูตัวอย่างโจทย์และวิธีทำทีละขั้น" }),
      exBox
    ]);

    var head = h("h2", null, [
      h("span", { class: "step-no study-badge", text: "📘" }),
      document.createTextNode(guide.title)
    ]);

    return h("section", { class: "step lesson-study-card", id: "step-study" }, [head, formulaGrid, exDrawer]);
  }

  var LESSON_TABS = [
    { key: "study", text: "📖 สรุป & คลิป" },
    { key: "lab", text: "🔬 แล็บ 3 มิติ" },
    { key: "game", text: "🎮 เกม 3 มิติ" },
    { key: "quiz", text: "📝 แบบฝึกหัด" },
    { key: "all", text: "📄 ดูทั้งหมด", isAll: true }
  ];

  function resolveTabFromHash(hashStr) {
    var raw = (hashStr || "").toLowerCase();
    if (raw === "#step-anim" || raw === "#lab") return "lab";
    if (raw === "#step-game" || raw === "#game") return "game";
    if (raw === "#step-quiz" || raw === "#quiz") return "quiz";
    if (raw === "#all") return "all";
    if (raw === "#step-study" || raw === "#step-video" || raw === "#study" || raw === "#video") return "study";
    return "study";
  }

  function buildStepNav(onSelect) {
    var nav = h("nav", {
      class: "lesson-step-nav",
      role: "tablist",
      "aria-label": "แถบเลือกหมวดการเรียนรู้ในบทเรียน"
    });
    var pills = {};
    LESSON_TABS.forEach(function (it) {
      var btn = h("button", {
        type: "button",
        class: "lesson-step-pill" + (it.isAll ? " is-all" : ""),
        role: "tab",
        "data-tab": it.key,
        "aria-selected": "false",
        text: it.text
      });
      btn.addEventListener("click", function () {
        if (onSelect) onSelect(it.key);
      });
      pills[it.key] = btn;
      nav.appendChild(btn);
    });
    return { nav: nav, pills: pills };
  }

  var activeHashListener = null;

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

    // ส่วนหัวบทเรียน: ป้ายระดับชั้น + ปุ่มบุ๊กมาร์ก อยู่แถวเดียวกันอย่างสวยงาม
    var bmCtrl = createBookmarkControl();
    var metaRow = h("div", { class: "lesson-header-meta" }, [
      h("span", { class: "level-badge", text: LEVELS[lesson.level] || lesson.level }),
      bmCtrl.element,
    ]);
    root.appendChild(metaRow);

    // แถบสถานะความคืบหน้าของบทเรียน (แสดงป้ายผ่านแล้ว)
    passedBanner = h("div", { class: "lesson-passed-banner", role: "status", "aria-live": "polite" });
    passedBanner.style.display = "none";
    root.appendChild(passedBanner);

    var currentTab = "study";
    var stepNavCtrl = buildStepNav(function (tabKey) {
      setActiveTab(tabKey);
    });
    root.appendChild(stepNavCtrl.nav);

    // การ์ดสรุปสาระสำคัญ (Key Takeaways Card)
    var summaryCard = null;
    if (lesson.summary) {
      summaryCard = h("div", { class: "summary-card" }, [
        h("h2", { class: "summary-card-title", text: "💡 สาระสำคัญประจำบทเรียน" }),
        h("p", { class: "summary-card-body", text: lesson.summary }),
      ]);
      root.appendChild(summaryCard);
    }

    var studySec = buildStudySection(lesson);
    var videoSec = videoStep(lesson);
    var animSec = animStep(lesson);
    var gameSec = gameStep(lesson);
    var quizSec = quizStep(lesson);
    var notesBoxCtrl = createNotesBox();
    var notesEl = notesBoxCtrl.element;

    root.appendChild(studySec);
    root.appendChild(videoSec);
    root.appendChild(animSec);
    root.appendChild(gameSec);
    root.appendChild(quizSec);

    // กล่องโน้ตย่อส่วนตัว วางไว้ก่อนปุ่มนำทางบทก่อนหน้า/ถัดไป
    root.appendChild(notesEl);

    function toggleHidden(node, hidden) {
      if (!node) return;
      node.classList.toggle("lesson-tab-hidden", !!hidden);
    }

    function notify3DResize() {
      try {
        window.dispatchEvent(new Event("resize"));
        document.dispatchEvent(new CustomEvent("lp:tab-changed", { detail: { tab: currentTab } }));
      } catch (e) {}
    }

    function setActiveTab(tabKey) {
      if (!stepNavCtrl.pills[tabKey]) tabKey = "study";
      currentTab = tabKey;

      Object.keys(stepNavCtrl.pills).forEach(function (k) {
        var isActive = k === tabKey;
        var pill = stepNavCtrl.pills[k];
        pill.classList.toggle("is-active", isActive);
        pill.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      var isAll = tabKey === "all";
      var showStudy = isAll || tabKey === "study";
      var showLab = isAll || tabKey === "lab";
      var showGame = isAll || tabKey === "game";
      var showQuiz = isAll || tabKey === "quiz";

      toggleHidden(summaryCard, !showStudy);
      toggleHidden(studySec, !showStudy);
      toggleHidden(videoSec, !showStudy);
      toggleHidden(animSec, !showLab);
      toggleHidden(gameSec, !showGame);
      toggleHidden(quizSec, !showQuiz);
      toggleHidden(notesEl, !showQuiz);

      if (showLab || showGame) {
        notify3DResize();
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(notify3DResize);
        }
      }
    }

    if (activeHashListener) {
      window.removeEventListener("hashchange", activeHashListener);
    }
    activeHashListener = function () {
      setActiveTab(resolveTabFromHash(location.hash));
    };
    window.addEventListener("hashchange", activeHashListener);
    setActiveTab(resolveTabFromHash(location.hash));

    // แถบปุ่มนำทาง บทก่อนหน้า / บทถัดไป อยู่ล่างสุดของหน้าบทเรียน
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
        text: "✓ ข้อมูลความคืบหน้า คะแนนการประเมิน และบันทึกย่อของคุณถูกซิงค์กับบัญชีผู้ใช้งานโดยอัตโนมัติ (รุ่นทดสอบระบบ Public Beta)",
      })
    );

    function onAuthUpdate() {
      var vb = document.getElementById("video-done");
      if (vb) vb.checked = getProgress().video;
      bmCtrl.refresh();
      notesBoxCtrl.refresh();
      paintStatus();
    }
    document.addEventListener("lp:auth-ready", onAuthUpdate);

    paintStatus();
  }

  function renderLoginGate() {
    document.title = "เข้าสู่ระบบเพื่อเริ่มเรียน | LearnPhysics";
    root.textContent = "";

    var card = h("div", { class: "login-gate-card" });

    var icon = h("div", { class: "login-gate-icon", "aria-hidden": "true" }, [document.createTextNode("🔒")]);
    var title = h("h1", { class: "login-gate-title", text: "กรุณาเข้าสู่ระบบเพื่อเข้าใช้งานบทเรียน" });
    var desc = h("p", {
      class: "login-gate-desc",
      text: "แพลตฟอร์ม LearnPhysics (Public Beta) กำหนดให้เข้าสู่ระบบด้วยบัญชี Google ก่อนเข้าเรียน เพื่อบันทึกความคืบหน้า คะแนนการประเมินผล รายการที่บันทึกไว้ และบันทึกย่อส่วนบุคคลของคุณอย่างปลอดภัยในทุกอุปกรณ์",
    });

    var googleBtn = h("a", {
      class: "button cta-main google-gate-btn",
      href: "/api/auth/google?return_to=" + encodeURIComponent(location.pathname + location.search),
    });
    googleBtn.innerHTML =
      '<svg class="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="margin-right: 8px; vertical-align: middle;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      "<span>เข้าสู่ระบบด้วย Google เพื่อเริ่มเรียน →</span>";

    var backBtn = h("a", {
      class: "button secondary",
      href: "/courses",
      text: "← กลับสู่หน้าโครงสร้างหลักสูตร",
    });

    var actions = h("div", { class: "login-gate-actions" }, [googleBtn, backBtn]);

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(actions);

    root.appendChild(card);
  }

  function fail(text) {
    root.textContent = "";
    root.appendChild(h("h1", { text: "เปิดบทเรียนไม่ได้" }));
    root.appendChild(h("p", { class: "lead", text: text }));
    root.appendChild(h("p", null, [h("a", { class: "back", href: "/courses", text: "กลับไปหน้าหลักสูตร" })]));
  }

  function loadLesson() {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      fail("ไม่พบบทเรียนนี้ ลองเลือกจากหน้าหลักสูตร");
      return;
    }

    fetch("/api/lessons/" + encodeURIComponent(slug))
      .then(function (res) {
        if (res.status === 401) {
          renderLoginGate();
          return null;
        }
        if (res.status === 404) {
          fail("ไม่พบบทเรียนนี้ ลองเลือกจากหน้าหลักสูตร");
          return null;
        }
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (!data.ok) {
          if (data.error === "unauthorized") {
            renderLoginGate();
            return;
          }
          throw new Error("bad data");
        }
        render(data.lesson);
      })
      .catch(function () {
        fail("โหลดบทเรียนไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง");
      });
  }

  // หากล็อกอินสำเร็จขณะที่เปิดหน้านี้อยู่ ให้โหลดบทเรียนใหม่ทันที
  document.addEventListener("lp:auth-ready", function (e) {
    if (e.detail && e.detail.user && !currentLesson) {
      loadLesson();
    }
  });

  loadLesson();
})();
