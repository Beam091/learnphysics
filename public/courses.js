// หน้าหลักสูตร: โหลดหลักสูตรจาก /api/catalog พร้อมแถบค้นหา ตัวกรองระดับชั้น และความคืบหน้า
(function () {
  "use strict";

  var box = document.getElementById("catalog");
  if (!box) return;

  var STORE_KEY = "learnphysics.progress.v1";

  // เก็บสถานะของ UI ข้ามการเรนเดอร์ซ้ำ (เช่น เมื่อ lp:auth-ready ทำงาน)
  var activeFilter = "all";
  var activeSearchQuery = "";
  var openChapterSet = null; // Set ของ chapter slug ที่เปิดอยู่ (null = ครั้งแรกให้เปิดทั้งหมด)
  var isAllExpanded = true;
  var hasScrolledToHash = false;
  var loadedCategories = null;

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

  function isJuniorCategory(cat) {
    if (!cat) return false;
    return cat.slug === "junior" || cat.slug === "m-ton" || (cat.title && cat.title.indexOf("ม.ต้น") !== -1);
  }

  function render(categories) {
    box.textContent = "";
    var isLoggedIn = !!(window.LPAuth && window.LPAuth.user);
    var progressMap = isLoggedIn ? readProgress() : {};
    var bookmarkSet = isLoggedIn ? (window.LPAuth && window.LPAuth.bookmarks) || [] : [];

    var totalLessons = 0;
    var juniorCount = 0;
    var seniorCount = 0;
    var passedCount = 0;

    // ถ้ายังไม่เคยเก็บ openChapterSet ให้เตรียม Set ว่างไว้
    var firstLoad = openChapterSet === null;
    if (firstLoad) {
      openChapterSet = new Set();
    }

    // นับสถิติบทเรียน
    categories.forEach(function (cat) {
      var isJuniorCat = isJuniorCategory(cat);
      cat.chapters.forEach(function (ch) {
        if (firstLoad) {
          openChapterSet.add(ch.slug);
        }
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
    var isLoggedIn = !!(window.LPAuth && window.LPAuth.user);

    // 1. แถบความคืบหน้ารวม (Overall Progress Banner)
    var banner = make("div", "progress-banner" + (!isLoggedIn ? " progress-banner-guest" : ""));

    if (!isLoggedIn) {
      var guestWrap = make("div", "progress-guest-wrap");
      var guestMsg = make(
        "p",
        "progress-guest-text",
        "🔒 ระบบอยู่ในช่วงเปิดทดสอบ (Public Beta) — กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อเข้าใช้งานบทเรียนทั้ง 155 บท และบันทึกความคืบหน้าการเรียนอัตโนมัติ"
      );
      var guestLoginBtn = make("a", "button cta-main progress-guest-btn", "เข้าสู่ระบบด้วย Google");
      guestLoginBtn.href = "/api/auth/google?return_to=" + encodeURIComponent("/courses");

      guestWrap.appendChild(guestMsg);
      guestWrap.appendChild(guestLoginBtn);
      banner.appendChild(guestWrap);
    } else {
      var bannerHead = make("div", "progress-header");
      var bannerTitle = make("strong", null, "ความคืบหน้าการเรียนของคุณ: ");
      var bannerInfo = document.createTextNode(
        "สำเร็จแล้ว " + passedCount + " จาก " + totalLessons + " บทเรียน (" + percentPassed + "%)"
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
    }
    box.appendChild(banner);

    // 2. แถบเครื่องมือค้นหาและกรอง (Course Toolbar)
    var toolbar = make("div", "course-toolbar");

    var searchBox = make("div", "course-search-wrap");
    var searchInput = make("input", "course-search-input");
    searchInput.type = "search";
    searchInput.id = "courseSearch";
    searchInput.placeholder = "ค้นหาชื่อบทเรียนหรือหัวข้อ เช่น โอห์ม, เลนส์, โพรเจกไทล์...";
    searchInput.setAttribute("aria-label", "ค้นหาบทเรียน");
    searchInput.value = activeSearchQuery;
    searchBox.appendChild(searchInput);
    toolbar.appendChild(searchBox);

    var tabsWrap = make("div", "filter-tabs");
    tabsWrap.setAttribute("role", "tablist");
    tabsWrap.setAttribute("aria-label", "ตัวกรองระดับชั้น");

    var filterTabs = [
      { id: "all", label: "ทั้งหมด (" + totalLessons + ")" },
      { id: "junior", label: "ม.ต้น (" + juniorCount + ")" },
      { id: "senior", label: "ม.ปลาย (" + seniorCount + ")" },
      { id: "passed", label: "สำเร็จแล้ว (" + passedCount + ")" },
      { id: "bookmarks", label: "⭐ บันทึกไว้ (" + bookmarkSet.length + ")" },
    ];

    var tabButtons = {};

    filterTabs.forEach(function (tab) {
      var isActive = tab.id === activeFilter;
      var btn = make("button", "filter-tab" + (isActive ? " active" : "") + (tab.id === "bookmarks" ? " bm-tab" : ""), tab.label);
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("data-filter", tab.id);
      tabButtons[tab.id] = btn;
      tabsWrap.appendChild(btn);
    });
    toolbar.appendChild(tabsWrap);

    var toolbarActions = make("div", "toolbar-actions");
    var toggleAllBtn = make("button", "toggle-all-btn", isAllExpanded ? "ย่อทั้งหมด" : "ขยายทั้งหมด");
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
        var isOpen = openChapterSet.has(ch.slug);
        card.open = isOpen;
        allDetails.push(card);

        // บันทึกสถานะเมื่อผู้ใช้เปิด/ปิด
        (function (chapterSlug, detailsEl) {
          detailsEl.addEventListener("toggle", function () {
            if (detailsEl.open) {
              openChapterSet.add(chapterSlug);
            } else {
              openChapterSet.delete(chapterSlug);
            }
          });
        })(ch.slug, card);

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
            var isBookmarked = bookmarkSet.indexOf(l.slug) !== -1;

            if (!isLoggedIn) {
              item.appendChild(make("span", "badge-lock", "🔒 ต้องเข้าสู่ระบบ"));
            } else {
              if (lStatus.passed) {
                var badgeText = lStatus.score !== null ? "✔ ผ่านแล้ว (" + lStatus.score + "%)" : "✔ ผ่านแล้ว";
                item.appendChild(make("span", "badge-done", badgeText));
              } else if (lStatus.inProgress) {
                item.appendChild(make("span", "badge-prog", "กำลังเรียน"));
              }

              if (isBookmarked) {
                item.appendChild(make("span", "badge-bm", "⭐ บันทึกไว้"));
              }
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
              level: l.level || (isJuniorCategory(cat) ? "junior" : "senior"),
              status: lStatus,
              isBookmarked: isBookmarked,
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
      activeSearchQuery = searchInput.value;
      var filter = activeFilter;
      var anyVisible = false;

      // จัดเก็บชุดของ chapters และ sections ที่มีบทเรียนแสดงผล
      var visibleCards = new Set();
      var visibleSections = new Set();

      allLessonItems.forEach(function (rec) {
        var matchFilter = true;
        if (filter === "junior") {
          matchFilter = rec.level === "junior" || isJuniorCategory({ slug: rec.catSlug, title: rec.catTitle });
        } else if (filter === "senior") {
          matchFilter = rec.level === "senior" || !isJuniorCategory({ slug: rec.catSlug, title: rec.catTitle });
        } else if (filter === "passed") {
          matchFilter = rec.status.passed;
        } else if (filter === "bookmarks") {
          matchFilter = rec.isBookmarked || bookmarkSet.indexOf(rec.slug) !== -1;
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
      if (!f || f === activeFilter) return;

      activeFilter = f;
      for (var k in tabButtons) {
        var btn = tabButtons[k];
        if (k === activeFilter) {
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
    toggleAllBtn.addEventListener("click", function () {
      isAllExpanded = !isAllExpanded;
      allDetails.forEach(function (d) {
        d.open = isAllExpanded;
      });
      categories.forEach(function (cat) {
        cat.chapters.forEach(function (ch) {
          if (isAllExpanded) {
            openChapterSet.add(ch.slug);
          } else {
            openChapterSet.delete(ch.slug);
          }
        });
      });
      toggleAllBtn.textContent = isAllExpanded ? "ย่อทั้งหมด" : "ขยายทั้งหมด";
    });

    // ถ้ามี URL hash เช่น #cat-junior ให้เลื่อนไปหาจุดนั้นอย่างนุ่มนวล
    if (window.location.hash && !hasScrolledToHash) {
      hasScrolledToHash = true;
      setTimeout(function () {
        try {
          var targetEl = document.querySelector(window.location.hash);
          if (targetEl) {
            var insideDetails = targetEl.querySelectorAll("details.ch-card");
            for (var i = 0; i < insideDetails.length; i++) {
              insideDetails[i].open = true;
            }
            targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } catch (e) {}
      }, 150);
    }

    // เรียก applyFilter ทันทีเพื่อคงค่าฟิลเตอร์หรือคำค้นหาเดิม
    applyFilter();
  }

  // เมื่อระบบล็อกอินพร้อม (ผสานความคืบหน้าและบุ๊กมาร์กจากเซิร์ฟเวอร์แล้ว) วาดหน้าใหม่
  document.addEventListener("lp:auth-ready", function () {
    if (loadedCategories) {
      render(loadedCategories);
    }
  });

  fetch("/api/catalog")
    .then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    })
    .then(function (data) {
      if (!data.ok || !Array.isArray(data.categories)) throw new Error("bad data");
      loadedCategories = data.categories;
      render(data.categories);
    })
    .catch(function () {
      box.textContent = "โหลดหลักสูตรไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง";
    });
})();
