/* ============================================================
   Rendering & interaction. Content lives in data.js / art.js.
   ============================================================ */
(function () {
  "use strict";

  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const boldSelf = s => esc(s).replace(/Guang Li/g, "<b>Guang Li</b>");
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------- Generic date/text list ---------- */
  function renderPlainList(el, items) {
    el.innerHTML = items.map(it =>
      `<li><span class="when">${it.date}</span><span>${it.html}</span></li>`
    ).join("");
  }

  /* ---------- News: grouped by year, first N visible ---------- */
  // Show all items from the latest year; hide earlier years behind the toggle
  const LATEST_YEAR = NEWS[0].date.split("/")[0];
  const NEWS_VISIBLE = NEWS.filter(n => n.date.startsWith(LATEST_YEAR)).length;
  const newsContainer = document.getElementById("newsContainer");
  const newsToggle = document.getElementById("newsToggle");

  function newsItemHTML(n) {
    const [, m] = n.date.split("/");
    return `<li><span class="news-text">${n.html}</span><span class="news-date">${MONTHS[parseInt(m, 10)] || n.date}</span></li>`;
  }
  function groupedNewsHTML(items) {
    const byYear = new Map();
    items.forEach(n => {
      const y = n.date.split("/")[0];
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(n);
    });
    return [...byYear.entries()].map(([y, arr]) =>
      `<h3 class="news-year">${y}</h3><ul class="news-list">${arr.map(newsItemHTML).join("")}</ul>`
    ).join("");
  }

  newsContainer.innerHTML =
    `<div class="news-recent">${groupedNewsHTML(NEWS.slice(0, NEWS_VISIBLE))}</div>` +
    `<div class="news-older" hidden>${groupedNewsHTML(NEWS.slice(NEWS_VISIBLE))}</div>`;
  if (NEWS.length <= NEWS_VISIBLE) newsToggle.hidden = true;

  const hiddenCount = Math.max(0, NEWS.length - NEWS_VISIBLE);
  newsToggle.textContent = `Show earlier news (+${hiddenCount}) ▾`;
  newsToggle.addEventListener("click", () => {
    const older = newsContainer.querySelector(".news-older");
    const expanded = newsToggle.getAttribute("aria-expanded") === "true";
    older.hidden = expanded;
    newsToggle.setAttribute("aria-expanded", String(!expanded));
    newsToggle.textContent = expanded ? `Show earlier news (+${hiddenCount}) ▾` : "Show less ▴";
  });

  /* ---------- All Publications ---------- */
  const GROUPS = [
    ["preprint", "Preprints"],
    ["conference", "Conference Papers"],
    ["journal", "Journal Papers"]
  ];
  const container = document.getElementById("pubContainer");

  function pubHTML(p) {
    const badge = p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
    const note = p.note
      ? `<div class="pub-note">${p.note.split(" · ").map(s => esc(s)).join("<br>")}</div>`
      : "";
    const links = p.links.length
      ? `<div class="pub-links">${p.links.map(([label, url]) => url
          ? `<a href="${url}" target="_blank" rel="noopener">${esc(label)}</a>`
          : `<span class="pending" title="Link coming soon">${esc(label)}</span>`).join("")}</div>`
      : "";
    // Venue full name + publication info on ONE line (e.g. "Knowledge-Based Systems, vol. 316, ...")
    let venueLine = "";
    if (p.type !== "preprint" && (p.venueFull || p.pubinfo)) {
      const full = p.venueFull ? `<i>${esc(p.venueFull)}</i>` : "";
      const info = p.pubinfo ? esc(p.pubinfo) : "";
      venueLine = `<div class="pub-venue-full">${[full, info].filter(Boolean).join(", ")}</div>`;
    }
    return `<li class="pub" data-type="${p.type}" data-year="${p.year}">
      <span class="venue">${esc(p.venue)}${badge}</span>
      <div>
        <div class="pub-title">${esc(p.title)}</div>
        <div class="pub-authors">${boldSelf(p.authors)}</div>
        ${venueLine}${note}${links}
      </div></li>`;
  }

  container.innerHTML = GROUPS.map(([type, label]) => {
    const items = PUBS.filter(p => p.type === type);
    const foot = PUB_FOOTNOTES[type]
      ? `<p class="pub-more" data-group="${type}">${PUB_FOOTNOTES[type]}</p>` : "";
    return `<h3 class="pub-group" data-group="${type}">${label}</h3>
      <ul class="pub-list" data-group="${type}">${items.map(pubHTML).join("")}</ul>${foot}`;
  }).join("");

  /* ---------- Recent Publications (top-venue papers, list style) ---------- */
  const selGrid = document.getElementById("selGrid");
  // Sort by acceptance date (newest first); fall back to year when absent
  const SELECTED = PUBS.filter(p => p.selected).sort((a, b) => {
    const ka = a.accepted || String(a.year), kb = b.accepted || String(b.year);
    return kb.localeCompare(ka);
  });
  selGrid.innerHTML = `<ul class="pub-list">${SELECTED.map(pubHTML).join("")}</ul>`;

  // Year dropdown from data
  const yearSel = document.getElementById("pubYear");
  [...new Set(PUBS.map(p => p.year))].sort((a, b) => b - a).forEach(y => {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    yearSel.appendChild(o);
  });

  const searchInput = document.getElementById("pubSearch");
  const countEl = document.getElementById("pubCount");
  const filterGroup = document.getElementById("pubFilter");
  let currentFilter = "selected";

  function applyFilters() {
    // "Recent" tab shows the curated list; other tabs show the full filtered list
    const selectedMode = currentFilter === "selected";
    selGrid.hidden = !selectedMode;
    container.hidden = selectedMode;
    if (selectedMode) {
      countEl.textContent = `${SELECTED.length} recent publications`;
      return;
    }

    const q = searchInput.value.trim().toLowerCase();
    const year = yearSel.value;
    let shown = 0;

    document.querySelectorAll("#pubContainer .pub").forEach(li => {
      const typeOK = currentFilter === "all" || li.dataset.type === currentFilter;
      const yearOK = year === "all" || li.dataset.year === year;
      const textOK = !q || li.textContent.toLowerCase().includes(q);
      const show = typeOK && yearOK && textOK;
      li.hidden = !show;
      if (show) shown++;
    });

    const pristine = currentFilter === "all" && year === "all" && !q;
    document.querySelectorAll("#pubContainer .pub-group").forEach(h => {
      const list = document.querySelector(`#pubContainer .pub-list[data-group="${h.dataset.group}"]`);
      h.hidden = !list.querySelector(".pub:not([hidden])");
    });
    document.querySelectorAll("#pubContainer .pub-more").forEach(f => { f.hidden = !pristine; });

    countEl.textContent = pristine
      ? `${PUBS.length + PUB_UNLISTED.intlConf + PUB_UNLISTED.domesticConf + PUB_UNLISTED.journal} publications in total`
      : `${shown} publication${shown === 1 ? "" : "s"} shown`;
  }

  filterGroup.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    filterGroup.querySelectorAll("button").forEach(b => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
  function switchToAllIfSelected() {
    if (currentFilter !== "selected") return;
    currentFilter = "all";
    filterGroup.querySelectorAll("button").forEach(b => {
      const active = b.dataset.filter === "all";
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }
  searchInput.addEventListener("input", () => { switchToAllIfSelected(); applyFilters(); });
  yearSel.addEventListener("change", () => { switchToAllIfSelected(); applyFilters(); });
  applyFilters();

  /* ---------- Other data-driven sections ---------- */
  renderPlainList(document.getElementById("talksList"), TALKS);
  renderPlainList(document.getElementById("awardsPersonal"), AWARDS_PERSONAL);
  renderPlainList(document.getElementById("awardsStudents"), AWARDS_STUDENTS);
  renderPlainList(document.getElementById("fundingList"), FUNDING);
  renderPlainList(document.getElementById("mediaList"), MEDIA);

  /* ---------- Scrollspy: highlight current section in top nav ---------- */
  const navLinks = [...document.querySelectorAll(".topnav-links a")];
  // Map sections to nav anchors (some nav links cover several sections)
  const NAV_MAP = {
    about: "#about", experience: "#about",
    news: "#news",
    publications: "#publications", projects: "#publications",
    awards: "#awards", funding: "#funding",
    talks: "#talks", media: "#media",
    service: "#service"
  };
  const sections = [...document.querySelectorAll("main section[id]")];

  const navStrip = document.querySelector(".topnav-links");
  function setActive(href) {
    navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === href));
    // Scroll ONLY the nav strip horizontally (scrollIntoView would scroll the page too)
    const chip = navStrip.querySelector(`a[href="${href}"]`);
    if (chip && navStrip.scrollWidth > navStrip.clientWidth) {
      const target = chip.offsetLeft - (navStrip.clientWidth - chip.offsetWidth) / 2;
      navStrip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
  }

  // When a nav link is clicked, set it active immediately and ignore
  // observer updates while the page smooth-scrolls to the target.
  let spyLock = 0;
  navStrip.addEventListener("click", e => {
    const a = e.target.closest("a");
    if (!a) return;
    setActive(a.getAttribute("href"));
    spyLock = Date.now() + 900;
  });

  // Pick whichever section crosses a line one-third down the viewport.
  // (Ratio-based picking skipped short sections such as Media entirely.)
  function updateSpy() {
    if (Date.now() < spyLock) return;
    const vh = window.innerHeight;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const remaining = maxScroll - window.scrollY;

    // Reference line sits a third down the viewport, but sweeps toward the
    // bottom over the final screen so short trailing sections still get their
    // turn (otherwise the page runs out of scroll before they reach the line).
    let line = vh / 3;
    if (remaining < vh) {
      const t = 1 - Math.max(0, remaining) / vh;   // 0 → 1 across the last screen
      line = vh / 3 + (vh - 10 - vh / 3) * t;
    }

    let current = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line) current = s;
    }
    if (current && NAV_MAP[current.id]) setActive(NAV_MAP[current.id]);
  }

  let spyTicking = false;
  window.addEventListener("scroll", () => {
    if (spyTicking) return;
    spyTicking = true;
    requestAnimationFrame(() => { updateSpy(); spyTicking = false; });
  }, { passive: true });
  window.addEventListener("resize", updateSpy, { passive: true });
  updateSpy();
  /* ---------- Projects: drag-to-scroll carousel ---------- */
  const carousel = document.querySelector(".proj-grid");
  if (carousel) {
    let isDown = false, startX = 0, startScroll = 0, dragged = false;
    carousel.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse") return; // touch scrolls natively
      isDown = true; dragged = false;
      startX = e.clientX; startScroll = carousel.scrollLeft;
    });
    window.addEventListener("pointermove", e => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { dragged = true; carousel.classList.add("dragging"); }
      carousel.scrollLeft = startScroll - dx;
    });
    window.addEventListener("pointerup", () => {
      isDown = false;
      carousel.classList.remove("dragging");
    });
    // Swallow the click that follows a drag so links don't fire
    carousel.addEventListener("click", e => {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
    }, true);
  }
})();
