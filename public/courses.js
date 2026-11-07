// โหลดหลักสูตรจาก /api/catalog แล้วแสดงเป็นหมวด > บท
(function () {
  "use strict";

  var box = document.getElementById("catalog");
  if (!box) return;

  function make(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function render(categories) {
    box.textContent = "";
    var total = 0;

    categories.forEach(function (cat) {
      var planned = cat.chapters.reduce(function (s, c) { return s + c.plannedLessons; }, 0);
      total += planned;

      var section = make("section", "cat");
      var head = make("h2", null, cat.title);
      head.appendChild(make("span", "cat-count", planned + " บทเรียน"));
      section.appendChild(head);

      var list = make("ul", "chapters");
      cat.chapters.forEach(function (ch) {
        var li = make("li");
        var row = make("div", "row");
        row.appendChild(make("span", "ch-title", ch.title));
        var status = ch.publishedLessons > 0
          ? ch.publishedLessons + "/" + ch.plannedLessons + " เปิดแล้ว"
          : String(ch.plannedLessons);
        row.appendChild(make("span", "ch-count", status));
        li.appendChild(row);
        if (ch.lessons && ch.lessons.length) {
          var links = make("ul", "lesson-links");
          ch.lessons.forEach(function (l) {
            var item = make("li");
            var a = make("a", null, l.title);
            a.href = "/lesson?s=" + encodeURIComponent(l.slug);
            item.appendChild(a);
            links.appendChild(item);
          });
          li.appendChild(links);
        }
        list.appendChild(li);
      });
      section.appendChild(list);
      box.appendChild(section);
    });

    box.insertBefore(make("p", "total", "รวมทั้งหมด " + total + " บทเรียนที่วางแผนไว้"), box.firstChild);
  }

  fetch("/api/catalog")
    .then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    })
    .then(function (data) {
      if (!data.ok || !Array.isArray(data.categories)) throw new Error("bad data");
      render(data.categories);
    })
    .catch(function () {
      box.textContent = "โหลดหลักสูตรไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง";
    });
})();
