// หน้าหลักสูตร: โหลดหลักสูตรจาก /api/catalog พร้อมแถบค้นหา ตัวกรองระดับชั้น และความคืบหน้า
(function () {
  "use strict";

  var box = document.getElementById("catalog");
  if (!box) return;

  var STORE_KEY = "learnphysics.progress.v1";

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getLessonStatus(slug, progressMap) {
    var p = progressMap && progressMap[slug];
    if (!p) return { passed: false, inProgress: false, score: null };
    var hasQuiz = typeof p.quiz === "number";
    var quizPassed = hasQuiz && p.quiz >= 60;
    var allSteps = !!(p.video && p.anim && p.game);
    var passed = quizPassed || allSteps;
    var inProgress = !passed && !!(p.video || p.anim || p.game || (hasQuiz && p.quiz > 0));
    return {
      passed: passed,
      inProgress: inProgress,
      score: hasQuiz ? p.quiz : null,
    };
  }

  function make(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function render(categories) {
    box.textContent = "";
    var progressMap = readProgress();
    var bookmarkSet = (window.LPAuth && window.LPAuth.bookmarks) || [];

    var totalLessons = 0;
    var juniorCount = 0;
    var seniorCount = 0;
    var passedCount = 0;

    // นับสถิติบทเรียน
    categories.forEach(function (cat) {
      var isJuniorCat = cat.slug === "junior";
      cat.chapters.forEach(function (ch) {
        var lessons = ch.lessons || [];
        lessons.forEach(function (l) {
          totalLessons++;
          var isJunior = l.level === "junior" || isJuniorCat;
          if (isJunior) {
            juniorCount++;
          } else {
            seniorCount++;
          }
          var status = getLessonStatus(l.slug, progressMap);
          if (status.passed) {
            passedCount++;
          }
        });
      });
    });

    var percentPassed = totalLessons > 0 ? Math.round((passedCount / totalLessons) * 100) : 0;

    // 1. แถบความคืบหน้ารวม (Overall Progress Banner)
    var banner = make("div", "progress-banner");
    var bannerHead = make("div", "progress-header");
    var bannerTitle = make("strong", null, "ความคืบหน้าของคุณ: ");
    var bannerInfo = document.createTextNode(
      "เรียนผ่านแล้ว " + passedCount + " จาก " + totalLessons + " บทเรียน (" + percentPassed + "%)"
    );
    bannerHead.appendChild(bannerTitle);
    bannerHead.appendChild(bannerInfo);

    var barWrap = make("div", "progress-bar");
    barWrap.setAttribute("role", "progressbar");
    barWrap.setAttribute("aria-valuenow", String(percentPassed));
    barWrap.setAttribute("aria-valuemin", "0");
    barWrap.setAttribute("aria-valuemax", "100");
    barWrap.setAttribute("aria-label", "ความคืบหน้ารวมในการเรียน");

    var barFill = make("div", "progress-fill");
    barFill.style.width = percentPassed + "%";
    barWrap.appendChild(barFill);

    banner.appendChild(bannerHead);
    banner.appendChild(barWrap);
    box.appendChild(banner);

    // 2. แถบเครื่องมือค้นหาและกรอง (Course Toolbar)
    var toolbar = make("div", "course-toolbar");

    var searchBox = make("div", "course-search-wrap");
    var searchInput = make("input", "course-search-input");
    searchInput.type = "search";
    searchInput.id = "courseSearch";
    searchInput.placeholder = "ค้นหาชื่อบทเรียนหรือหัวข้อ เช่น โอห์ม, เลนส์, โพรเจกไทล์...";
    searchInput.setAttribute("aria-label", "ค้นหาบทเรียน");
    searchBox.appendChild(searchInput);
    toolbar.appendChild(searchBox);

    var tabsWrap = make("div", "filter-tabs");
    tabsWrap.setAttribute("role", "tablist");
    tabsWrap.setAttribute("aria-label", "ตัวกรองระดับชั้น");

    var filterTabs = [
      { id: "all", label: "ทั้งหมด (" + totalLessons + ")" },
      { id: "junior", label: "ม.ต้น (" + juniorCount + ")" },
      { id: "senior", label: "ม.ปลาย (" + seniorCount + ")" },
      { id: "passed", label: "ที่เรียนแล้ว (" + passedCount + ")" },
      { id: "bookmarks", label: "⭐ ที่บันทึกไว้ (Bookmarks)" },
    ];

    var tabButtons = {};
    var currentFilter = "all";

    filterTabs.forEach(function (tab) {
      var btn = make("button", "filter-tab" + (tab.id === "all" ? " active" : ""), tab.label);
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab.id === "all" ? "true" : "false");
      btn.setAttribute("data-filter", tab.id);
      tabButtons[tab.id] = btn;
      tabsWrap.appendChild(btn);
    });
    toolbar.appendChild(tabsWrap);

    var toolbarActions = make("div", "toolbar-actions");
    var toggleAllBtn = make("button", "toggle-all-btn", "ย่อทั้งหมด");
    toggleAllBtn.type = "button";
    toolbarActions.appendChild(toggleAllBtn);
    toolbar.appendChild(toolbarActions);

    box.appendChild(toolbar);

    // 3. รายการหมวดวิชาและบทเรียน
    var catalogGrid = make("div", "catalog-grid");
    var allDetails = [];
    var allLessonItems = [];

    categories.forEach(function (cat) {
      var section = make("section", "cat");
      section.id = "cat-" + cat.slug;

      var planned = cat.chapters.reduce(function (s, c) {
        return s + (c.plannedLessons || 0);
      }, 0);

      var head = make("h2", null, cat.title);
      head.appendChild(make("span", "cat-count", planned + " บทเรียน"));
      section.appendChild(head);

      var chaptersWrap = make("div", "chapters-wrap");

      cat.chapters.forEach(function (ch) {
        var card = make("details", "ch-card");
        card.open = true;
        allDetails.push(card);

        var summary = make("summary", "ch-summary");
        var row = make("div", "row");
        row.appendChild(make("span", "ch-title", ch.title));
        var status = ch.publishedLessons > 0
          ? ch.publishedLessons + "/" + ch.plannedLessons + " บทเรียน"
          : String(ch.plannedLessons);
        row.appendChild(make("span", "ch-count", status));
        summary.appendChild(row);
        card.appendChild(summary);

        var lessons = ch.lessons || [];
        if (lessons.length) {
          var links = make("ul", "lesson-links");
          lessons.forEach(function (l) {
            var item = make("li");
            var a = make("a", null, l.title);
            a.href = "/lesson?s=" + encodeURIComponent(l.slug);
            item.appendChild(a);

            var lStatus = getLessonStatus(l.slug, progressMap);
            if (lStatus.passed) {
              var badgeText = lStatus.score !== null ? "✔ ผ่านแล้ว (" + lStatus.score + "%)" : "✔ ผ่านแล้ว";
              item.appendChild(make("span", "badge-done", badgeText));
            } else if (lStatus.inProgress) {
              item.appendChild(make("span", "badge-prog", "กำลังเรียน"));
            }

            links.appendChild(item);

            allLessonItems.push({
              item: item,
              card: card,
              section: section,
              catSlug: cat.slug,
              catTitle: cat.title,
              chTitle: ch.title,
              slug: l.slug,
              title: l.title,
              level: l.level || (cat.slug === "junior" ? "junior" : "senior"),
              status: lStatus,
            });
          });
          card.appendChild(links);
        } else {
          var emptyNote = make("p", "note", "กำลังจัดเตรียมเนื้อหา");
          card.appendChild(emptyNote);
        }

        chaptersWrap.appendChild(card);
      });

      section.appendChild(chaptersWrap);
      catalogGrid.appendChild(section);
    });

    var noResults = make("div", "no-results", "ไม่พบบทเรียนที่ตรงกับคำค้นหา");
    noResults.style.display = "none";
    catalogGrid.appendChild(noResults);

    box.appendChild(catalogGrid);

    // ฟังก์ชันกรองแบบ Real-time
    function applyFilter() {
      var query = searchInput.value.trim().toLowerCase();
      var filter = currentFilter;
      var anyVisible = false;

      // จัดเก็บชุดของ chapters และ sections ที่มีบทเรียนแสดงผล
      var visibleCards = new Set();
      var visibleSections = new Set();

      allLessonItems.forEach(function (rec) {
        var matchFilter = true;
        if (filter === "junior") {
          matchFilter = rec.level === "junior" || rec.catSlug === "junior";
        } else if (filter === "senior") {
          matchFilter = rec.level === "senior" || rec.catSlug !== "junior";
        } else if (filter === "passed") {
          matchFilter = rec.status.passed;
        } else if (filter === "bookmarks") {
          matchFilter = bookmarkSet.indexOf(rec.slug) !== -1;
        }

        var matchSearch = true;
        if (query) {
          var textToSearch = (rec.title + " " + rec.chTitle + " " + rec.catTitle).toLowerCase();
          matchSearch = textToSearch.indexOf(query) !== -1;
        }

        var isVisible = matchFilter && matchSearch;
        rec.item.style.display = isVisible ? "" : "none";

        if (isVisible) {
          visibleCards.add(rec.card);
          visibleSections.add(rec.section);
          anyVisible = true;
        }
      });

      // จัดการการแสดงผลของ card (chapter)
      allDetails.forEach(function (card) {
        if (visibleCards.has(card)) {
          card.style.display = "";
          if (query || filter !== "all") {
            card.open = true;
          }
        } else {
          card.style.display = "none";
        }
      });

      // จัดการการแสดงผลของแต่ละหมวด (section)
      var sections = catalogGrid.querySelectorAll("section.cat");
      for (var s = 0; s < sections.length; s++) {
        var sec = sections[s];
        sec.style.display = visibleSections.has(sec) ? "" : "none";
      }

      noResults.style.display = anyVisible ? "none" : "block";
    }

    // Event listeners
    searchInput.addEventListener("input", applyFilter);

    tabsWrap.addEventListener("click", function (e) {
      var target = e.target;
      if (!target || !target.classList.contains("filter-tab")) return;
      var f = target.getAttribute("data-filter");
      if (!f || f === currentFilter) return;

      currentFilter = f;
      for (var k in tabButtons) {
        var btn = tabButtons[k];
        if (k === currentFilter) {
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
        } else {
          btn.classList.remove("active");
          btn.setAttribute("aria-selected", "false");
        }
      }
      applyFilter();
    });

    // ปุ่ม ย่อทั้งหมด / ขยายทั้งหมด
    var allExpanded = true;
    toggleAllBtn.addEventListener("click", function () {
      allExpanded = !allExpanded;
      allDetails.forEach(function (d) {
        d.open = allExpanded;
      });
      toggleAllBtn.textContent = allExpanded ? "ย่อทั้งหมด" : "ขยายทั้งหมด";
    });

    // ถ้ามี URL hash เช่น #cat-junior ให้เลื่อนไปหาจุดนั้นอย่างนุ่มนวล
    if (window.location.hash) {
      setTimeout(function () {
        var targetEl = document.querySelector(window.location.hash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }

  var loadedCategories = null;

  // เมื่อระบบล็อกอินพร้อม (ผสานความคืบหน้าและบุ๊กมาร์กจากเซิร์ฟเวอร์แล้ว) วาดหน้าใหม่
  document.addEventListener("lp:auth-ready", function () {
    if (loadedCategories && window.LPAuth && window.LPAuth.user) render(loadedCategories);
  });

  fetch("/api/catalog")
    .then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    })
    .then(function (data) {
      if (!data.ok || !Array.isArray(data.categories)) throw new Error("bad data");
      render(data.categories);
      loadedCategories = data.categories;
    })
    .catch(function () {
      box.textContent = "โหลดหลักสูตรไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง";
    });
})();
