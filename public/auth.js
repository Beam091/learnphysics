// สคริปต์กลางของระบบสมาชิก (โหลดในทุกหน้าผ่าน Base.astro)
// - ถามเซิร์ฟเวอร์ว่าใครล็อกอินอยู่ (/api/me)
// - ยังไม่ล็อกอิน: แสดงปุ่ม "เข้าสู่ระบบด้วย Google"
// - ล็อกอินแล้ว: ผสานความคืบหน้าในเครื่องกับบนเซิร์ฟเวอร์ แสดงชื่อ/รูป และปุ่มออกจากระบบ
// - ส่งอีเวนต์ "lp:auth-ready" ให้ courses.js และ lesson.js วาดความคืบหน้าใหม่
(function () {
  "use strict";

  var STORE_KEY = "learnphysics.progress.v1";
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

  // รวมค่าสองฝั่งโดยเลือกค่าที่ "ทำได้มากกว่า" เสมอ
  function mergeProgress(a, b) {
    var out = {};
    [a, b].forEach(function (src) {
      Object.keys(src || {}).forEach(function (slug) {
        var p = src[slug] || {};
        var o = out[slug] || { video: false, anim: false, game: false, quiz: null };
        o.video = o.video || !!p.video;
        o.anim = o.anim || !!p.anim;
        o.game = o.game || !!p.game;
        if (typeof p.quiz === "number") o.quiz = o.quiz === null ? p.quiz : Math.max(o.quiz, p.quiz);
        out[slug] = o;
      });
    });
    return out;
  }

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

  function renderLoggedOut() {
    if (!slot) return;
    slot.textContent = "";
    var a = el("a", "auth-login", "เข้าสู่ระบบด้วย Google");
    a.href = "/api/auth/google?return_to=" + encodeURIComponent(location.pathname + location.search);
    slot.appendChild(a);
  }

  function renderLoggedIn(user) {
    if (!slot) return;
    slot.textContent = "";
    var wrap = el("div", "auth-user");
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
    var out = el("button", "auth-logout", "ออกจากระบบ");
    out.type = "button";
    out.addEventListener("click", function () {
      out.disabled = true;
      api("/api/auth/logout", "POST", {}).then(function () {
        location.reload();
      });
    });
    wrap.appendChild(out);
    slot.appendChild(wrap);
  }

  function finish() {
    window.LPAuth.ready = true;
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
