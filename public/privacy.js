// หน้า /privacy: ปุ่มลบบัญชีและข้อมูลทั้งหมด (PDPA)
(function () {
  "use strict";
  var box = document.getElementById("accountBox");
  if (!box) return;

  function render(user) {
    box.textContent = "";
    if (!user) {
      var p = document.createElement("p");
      p.textContent = "คุณยังไม่ได้เข้าสู่ระบบ จึงไม่มีข้อมูลบัญชีบนเซิร์ฟเวอร์ให้ลบ";
      var a = document.createElement("a");
      a.className = "button";
      a.href = "/api/auth/google?return_to=/privacy";
      a.textContent = "เข้าสู่ระบบด้วย Google";
      box.appendChild(p);
      box.appendChild(a);
      return;
    }
    var info = document.createElement("p");
    info.textContent = "เข้าสู่ระบบเป็น " + (user.name || "") + " (" + user.email + ")";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "danger";
    btn.textContent = "ลบบัญชีและข้อมูลการเรียนทั้งหมดของฉัน";
    var msg = document.createElement("p");
    msg.setAttribute("role", "status");
    btn.addEventListener("click", function () {
      if (!confirm("ยืนยันลบบัญชีและข้อมูลการเรียนทั้งหมดของคุณ?\nการลบนี้กู้คืนไม่ได้")) return;
      btn.disabled = true;
      fetch("/api/me", { method: "DELETE", credentials: "same-origin" })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (!data.ok) throw new Error("fail");
          try {
            localStorage.removeItem("learnphysics.progress.v1");
            localStorage.removeItem("learnphysics.notes.v1");
          } catch (e) {}
          box.textContent = "ลบบัญชีและข้อมูลทั้งหมดของคุณเรียบร้อยแล้ว";
          setTimeout(function () {
            location.href = "/";
          }, 2500);
        })
        .catch(function () {
          btn.disabled = false;
          msg.textContent = "ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        });
    });
    box.appendChild(info);
    box.appendChild(btn);
    box.appendChild(msg);
  }

  function start() {
    if (window.LPAuth && window.LPAuth.ready) render(window.LPAuth.user);
    else document.addEventListener("lp:auth-ready", function () { render(window.LPAuth.user); });
  }
  start();
})();
