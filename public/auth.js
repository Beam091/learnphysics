// สคริปต์กลางของระบบสมาชิก (โหลดในทุกหน้าผ่าน Base.astro)
// - ถามเซิร์ฟเวอร์ว่าใครล็อกอินอยู่ (/api/me)
// - ยังไม่ล็อกอิน: แสดงปุ่ม "เข้าสู่ระบบด้วย Google"
// - ล็อกอินแล้ว: ผสานความคืบหน้าในเครื่องกับบนเซิร์ฟเวอร์ แสดงชื่อ/รูป และปุ่มออกจากระบบ
// - ส่งอีเวนต์ "lp:auth-ready" ให้ courses.js และ lesson.js วาดความคืบหน้าใหม่
(function () {
  "use strict";

  var STORE_KEY = "learnphysics.progress.v1";
  var GAMIFY_KEY = "learnphysics.gamification.v1";
  var SOUND_KEY = "learnphysics.sound.v1";
  var slot = document.getElementById("authSlot");

  window.LPAuth = { user: null, bookmarks: [], ready: false };

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeLocal(map) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(map));
    } catch (e) {
      /* เก็บไม่ได้ก็ใช้งานต่อได้ */
    }
  }

  // รวมค่าสองฝั่งโดยเลือกค่าที่ "ทำได้มากกว่า" เสมอ (รวมถึงดาวและคะแนนมินิเกม)
  function mergeProgress(a, b) {
    var out = {};
    [a, b].forEach(function (src) {
      Object.keys(src || {}).forEach(function (slug) {
        var p = src[slug] || {};
        var o = out[slug] || { video: false, anim: false, game: false, quiz: null, stars: 0, gameScore: 0 };
        o.video = o.video || !!p.video;
        o.anim = o.anim || !!p.anim;
        o.game = o.game || !!p.game;
        if (typeof p.quiz === "number") o.quiz = o.quiz === null ? p.quiz : Math.max(o.quiz, p.quiz);
        if (typeof p.stars === "number") o.stars = Math.max(o.stars || 0, Math.min(3, Math.max(0, Math.round(p.stars))));
        if (typeof p.gameScore === "number") o.gameScore = Math.max(o.gameScore || 0, Math.max(0, Math.round(p.gameScore)));
        out[slug] = o;
      });
    });
    return out;
  }

  // ---------------------------------------------------------------- ระบบเสียงสังเคราะห์ (Web Audio API)
  var audioCtx = null;
  function getAudioCtx() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  function readSoundPref() {
    try {
      var v = localStorage.getItem(SOUND_KEY);
      return v !== "0" && v !== "false";
    } catch (e) {
      return true;
    }
  }

  function playTone(freqStart, freqEnd, durationMs, type, gainVal, delaySec) {
    if (!window.LPSound || !window.LPSound.enabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    try {
      var now = ctx.currentTime + (delaySec || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd && freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationMs / 1000);
      }
      gain.gain.setValueAtTime(gainVal || 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.01);
    } catch (e) {}
  }

  window.LPSound = {
    enabled: readSoundPref(),
    toggle: function () {
      window.LPSound.enabled = !window.LPSound.enabled;
      try {
        localStorage.setItem(SOUND_KEY, window.LPSound.enabled ? "1" : "0");
      } catch (e) {}
      if (window.LPSound.enabled) window.LPSound.click();
      document.dispatchEvent(new CustomEvent("lp:sound-changed", { detail: { enabled: window.LPSound.enabled } }));
      return window.LPSound.enabled;
    },
    click: function () {
      playTone(600, 800, 45, "sine", 0.06, 0);
    },
    launch: function () {
      playTone(220, 660, 180, "triangle", 0.08, 0);
    },
    win: function (stars) {
      var notes = stars >= 3 ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
      notes.forEach(function (freq, idx) {
        playTone(freq, freq, 140, "triangle", 0.09, idx * 0.075);
      });
    },
    miss: function () {
      playTone(260, 220, 90, "sawtooth", 0.05, 0);
      playTone(210, 180, 120, "sawtooth", 0.05, 0.08);
    },
    fanfare: function () {
      var notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
      notes.forEach(function (freq, idx) {
        playTone(freq, freq, idx === 4 ? 260 : 120, "triangle", 0.09, idx * 0.07);
      });
    },
  };

  // ---------------------------------------------------------------- ระบบ Gamification (XP, เลเวล, เหรียญรางวัล, พลุ)
  function computeRankTitle(level) {
    if (level <= 2) return "🌱 นักสำรวจฟิสิกส์";
    if (level <= 5) return "🔬 นักทดลองห้องแล็บ";
    if (level <= 10) return "⚡ วิศวกรพลังงานคลื่น";
    if (level <= 20) return "🚀 นักฟิสิกส์โพรเจกไทล์";
    if (level <= 35) return "🌌 ผู้เชี่ยวชาญควอนตัม";
    return "👑 ปรมาจารย์ฟิสิกส์";
  }

  function readSeenAchievements() {
    try {
      return JSON.parse(localStorage.getItem(GAMIFY_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeSeenAchievements(map) {
    try {
      localStorage.setItem(GAMIFY_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  window.LPGamify = {
    getStats: function () {
      var all = readLocal();
      var totalXP = 0;
      var totalStars = 0;
      var passedCount = 0;
      var gameWinCount = 0;
      var animCount = 0;
      var perfectQuizCount = 0;
      var maxStarsInOneGame = 0;
      var activeLessonCount = 0;

      Object.keys(all).forEach(function (slug) {
        var p = all[slug];
        if (!p || typeof p !== "object") return;
        var hasActivity = false;
        if (p.video) {
          totalXP += 25;
          hasActivity = true;
        }
        if (p.anim) {
          totalXP += 25;
          animCount += 1;
          hasActivity = true;
        }
        if (p.game) {
          var s = typeof p.stars === "number" && p.stars > 0 ? Math.min(3, p.stars) : 1;
          totalXP += 50 + s * 25;
          totalStars += s;
          gameWinCount += 1;
          if (s > maxStarsInOneGame) maxStarsInOneGame = s;
          hasActivity = true;
        }
        var hasQuiz = typeof p.quiz === "number";
        if (hasQuiz) {
          hasActivity = true;
          if (p.quiz >= 60) totalXP += 100;
          if (p.quiz === 100) {
            totalXP += 50;
            perfectQuizCount += 1;
          }
        }
        if ((hasQuiz && p.quiz >= 60) || (p.video && p.anim && p.game)) {
          passedCount += 1;
        }
        if (hasActivity) activeLessonCount += 1;
      });

      var level = Math.floor(totalXP / 250) + 1;
      var xpForNext = 250;
      var xpInLevel = totalXP % xpForNext;
      var xpPercent = Math.round((xpInLevel / xpForNext) * 100);
      var rankTitle = computeRankTitle(level);
      var bookmarkCount = (window.LPAuth && window.LPAuth.bookmarks ? window.LPAuth.bookmarks.length : 0);

      var achievements = [
        {
          id: "first_step",
          icon: "🎯",
          title: "ก้าวแรกสู่วงการฟิสิกส์",
          desc: "เรียนผ่านอย่างน้อย 1 บทเรียน",
          unlocked: passedCount >= 1,
        },
        {
          id: "sharpshooter",
          icon: "🌟",
          title: "นักแม่นปืน 3 ดาว",
          desc: "ชนะเกมฝึกทักษะระดับ 3 ดาว ⭐⭐⭐",
          unlocked: maxStarsInOneGame >= 3,
        },
        {
          id: "lab_explorer",
          icon: "🔬",
          title: "นักทดลองตัวจริง",
          desc: "ทดลองห้องปฏิบัติการจำลองครบ 5 บท",
          unlocked: animCount >= 5,
        },
        {
          id: "quiz_ace",
          icon: "💯",
          title: "สอบเต็มร้อย!",
          desc: "ทำแบบประเมินผลได้ 100% เต็ม",
          unlocked: perfectQuizCount >= 1,
        },
        {
          id: "streak_5",
          icon: "🔥",
          title: "ขาลุย 5 บทเรียน",
          desc: "เรียนผ่านครบ 5 บทเรียน",
          unlocked: passedCount >= 5,
        },
        {
          id: "star_collector",
          icon: "⭐",
          title: "นักสะสมดวงดาว",
          desc: "สะสมดาวจากมินิเกมครบ 15 ดวง",
          unlocked: totalStars >= 15,
        },
        {
          id: "junior_master",
          icon: "⚡",
          title: "ขาประจำคลังความรู้",
          desc: "บันทึกบทเรียนที่ชอบหรือทำกิจกรรมครบ 10 บท",
          unlocked: bookmarkCount >= 10 || activeLessonCount >= 10,
        },
        {
          id: "physicist_pro",
          icon: "🏆",
          title: "ยอดนักฟิสิกส์เลเวล 5",
          desc: "อัปเกรดเลเวลผู้เรียนถึง Lv.5",
          unlocked: level >= 5,
        },
      ];

      return {
        totalXP: totalXP,
        level: level,
        xpInLevel: xpInLevel,
        xpForNext: xpForNext,
        xpPercent: xpPercent,
        rankTitle: rankTitle,
        totalStars: totalStars,
        passedCount: passedCount,
        gameWinCount: gameWinCount,
        animCount: animCount,
        perfectQuizCount: perfectQuizCount,
        maxStarsInOneGame: maxStarsInOneGame,
        achievements: achievements,
      };
    },

    checkNewAchievements: function (silent) {
      var stats = window.LPGamify.getStats();
      var seen = readSeenAchievements();
      var unlockedNow = seen.unlocked || {};
      var newlyUnlocked = [];
      stats.achievements.forEach(function (ach) {
        if (ach.unlocked && !unlockedNow[ach.id]) {
          unlockedNow[ach.id] = Date.now();
          newlyUnlocked.push(ach);
        }
      });
      if (newlyUnlocked.length) {
        seen.unlocked = unlockedNow;
        writeSeenAchievements(seen);
        if (!silent) {
          newlyUnlocked.forEach(function (ach, i) {
            setTimeout(function () {
              window.LPGamify.showToast("ปลดล็อกเหรียญรางวัล: " + ach.title, ach.desc, ach.icon);
              if (window.LPSound) window.LPSound.fanfare();
            }, i * 600);
          });
        }
      }
      return newlyUnlocked;
    },

    confetti: function () {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      try {
        var canvas = document.createElement("canvas");
        canvas.className = "lp-confetti-canvas";
        canvas.setAttribute("aria-hidden", "true");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        var ctx = canvas.getContext("2d");
        if (!ctx) { canvas.remove(); return; }

        var colors = ["#2f5bea", "#ffd84d", "#e5484d", "#15803d", "#38bdf8", "#f97316"];
        var parts = [];
        for (var i = 0; i < 55; i++) {
          var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          var speed = 6 + Math.random() * 10;
          parts.push({
            x: canvas.width * (0.2 + Math.random() * 0.6),
            y: canvas.height * 0.55 + (Math.random() - 0.5) * 80,
            vx: Math.cos(angle) * speed * 1.4,
            vy: Math.sin(angle) * speed - 3,
            w: 6 + Math.random() * 6,
            h: 4 + Math.random() * 5,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.25,
            color: colors[i % colors.length],
          });
        }

        var start = performance.now();
        var duration = 1800;
        function tick(now) {
          var elapsed = now - start;
          if (elapsed >= duration) {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          var alpha = elapsed > 1200 ? 1 - (elapsed - 1200) / 600 : 1;
          ctx.globalAlpha = Math.max(0, alpha);
          parts.forEach(function (p) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35;
            p.vx *= 0.99;
            p.rot += p.vRot;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
          });
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      } catch (e) {}
    },

    showToast: function (title, subtitle, icon) {
      try {
        var existing = document.querySelectorAll(".lp-toast");
        var offset = existing.length * 76;
        var toast = el("div", "lp-toast");
        toast.setAttribute("role", "status");
        toast.style.bottom = (20 + offset) + "px";

        var iconEl = el("div", "lp-toast-icon", icon || "🏆");
        var bodyEl = el("div", "lp-toast-body");
        bodyEl.appendChild(el("div", "lp-toast-title", title || ""));
        if (subtitle) bodyEl.appendChild(el("div", "lp-toast-sub", subtitle));

        toast.appendChild(iconEl);
        toast.appendChild(bodyEl);
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
          toast.classList.add("show");
        });
        setTimeout(function () {
          toast.classList.remove("show");
          setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
          }, 300);
        }, 3500);
      } catch (e) {}
    },
  };

  function api(path, method, body) {
    var init = { method: method || "GET", credentials: "same-origin", headers: {} };
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(path, init).then(function (res) {
      return res.json().then(function (data) {
        data.httpStatus = res.status;
        return data;
      });
    });
  }
  window.LPAuth.api = api;

  // ส่งความคืบหน้าของบทเดียวขึ้นเซิร์ฟเวอร์ (lesson.js เรียกใช้)
  window.LPAuth.pushProgress = function (slug) {
    if (!window.LPAuth.user) return Promise.resolve();
    var all = readLocal();
    var one = {};
    one[slug] = all[slug] || {};
    return api("/api/progress/sync", "POST", { progress: one }).catch(function () {});
  };

  window.LPAuth.toggleBookmark = function (slug) {
    return api("/api/bookmarks/toggle", "POST", { slug: slug }).then(function (data) {
      if (data.ok) {
        var list = window.LPAuth.bookmarks.filter(function (s) {
          return s !== slug;
        });
        if (data.bookmarked) list.unshift(slug);
        window.LPAuth.bookmarks = list;
      }
      return data;
    });
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var GOOGLE_SVG =
    '<svg class="google-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
    '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
    '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>' +
    '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>' +
    '</svg>';

  function renderLoggedOut() {
    if (!slot) return;
    slot.textContent = "";
    var a = el("a", "auth-login");
    a.href = "/api/auth/google?return_to=" + encodeURIComponent(location.pathname + location.search);
    a.innerHTML =
      GOOGLE_SVG +
      '<span class="auth-login-text">เข้าสู่ระบบด้วย Google</span>' +
      '<span class="auth-login-short">เข้าสู่ระบบ</span>';
    slot.appendChild(a);
  }

  function updateHeaderLevelBadge() {
    var badge = document.getElementById("headerLevelBadge");
    if (!badge || !window.LPGamify) return;
    var st = window.LPGamify.getStats();
    badge.textContent = "⚡ Lv." + st.level;
    badge.title = st.rankTitle + " (" + st.totalXP + " XP • ⭐ " + st.totalStars + " ดวง)";
  }

  function renderLoggedIn(user) {
    if (!slot) return;
    slot.textContent = "";
    var wrap = el("div", "auth-user");
    var st = window.LPGamify ? window.LPGamify.getStats() : { level: 1, rankTitle: "", totalXP: 0, totalStars: 0 };
    var lvlBadge = el("a", "auth-level-badge", "⚡ Lv." + st.level);
    lvlBadge.id = "headerLevelBadge";
    lvlBadge.href = "/courses#gamifyDashboard";
    lvlBadge.title = st.rankTitle + " (" + st.totalXP + " XP • ⭐ " + st.totalStars + " ดวง)";
    wrap.appendChild(lvlBadge);
    if (user.avatarUrl) {
      var img = el("img", "auth-avatar");
      img.src = user.avatarUrl;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.width = 28;
      img.height = 28;
      wrap.appendChild(img);
    }
    wrap.appendChild(el("span", "auth-name", user.name || user.email));
    var privacy = el("a", "auth-link", "บัญชี");
    privacy.href = "/privacy";
    wrap.appendChild(privacy);
    var out = el("button", "auth-logout");
    out.type = "button";
    out.setAttribute("aria-label", "ออกจากระบบ");
    out.innerHTML = '<span class="auth-logout-text">ออกจากระบบ</span><span class="auth-logout-short">ออก</span>';
    out.addEventListener("click", function () {
      out.disabled = true;
      api("/api/auth/logout", "POST", {}).then(function () {
        location.reload();
      });
    });
    wrap.appendChild(out);
    slot.appendChild(wrap);
  }

  document.addEventListener("lp:progress-updated", function () {
    updateHeaderLevelBadge();
    if (window.LPGamify && window.LPAuth && window.LPAuth.ready) {
      window.LPGamify.checkNewAchievements(false);
    }
  });

  function finish() {
    window.LPAuth.ready = true;
    if (window.LPAuth.user) {
      updateHeaderLevelBadge();
      if (window.LPGamify) window.LPGamify.checkNewAchievements(true);
    }
    document.dispatchEvent(new CustomEvent("lp:auth-ready", { detail: { user: window.LPAuth.user } }));
  }

  api("/api/me")
    .then(function (me) {
      if (!me.ok || !me.user) {
        renderLoggedOut();
        finish();
        return;
      }
      window.LPAuth.user = me.user;
      window.LPAuth.bookmarks = me.bookmarks || [];
      renderLoggedIn(me.user);

      // ผสานของในเครื่อง (ที่ทำไว้ก่อนล็อกอิน) กับของบนเซิร์ฟเวอร์
      var local = readLocal();
      var merged = mergeProgress(local, me.progress);
      writeLocal(merged);
      if (Object.keys(local).length) {
        return api("/api/progress/sync", "POST", { progress: local })
          .then(function (res) {
            if (res.ok && res.progress) writeLocal(mergeProgress(merged, res.progress));
          })
          .catch(function () {});
      }
    })
    .catch(function () {
      renderLoggedOut();
    })
    .then(finish);

  // ข้อความเมื่อ Google login ไม่สำเร็จ
  try {
    var err = new URLSearchParams(location.search).get("login_error");
    if (err) {
      var bar = el("div", "auth-error", "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      bar.setAttribute("role", "alert");
      var main = document.querySelector("main");
      if (main) main.insertBefore(bar, main.firstChild);
    }
  } catch (e) {}
})();
