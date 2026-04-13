document.addEventListener("DOMContentLoaded", () => {
  const historyDiv   = document.getElementById("history");
  const editToggle   = document.getElementById("editToggle");
  const editToolbar  = document.getElementById("editToolbar");
  const toolbarInfo  = document.getElementById("toolbarInfo");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const deleteBtn    = document.getElementById("deleteSelectedBtn");
  const overlay      = document.getElementById("confirmOverlay");
  const confirmBody  = document.getElementById("confirmBody");
  const confirmCancel= document.getElementById("confirmCancel");

  // ── Theme toggle ────────────────────────────────────────────────────────────
  const histThemeBtn  = document.getElementById("histThemeToggle");
  const histThemeIcon = document.getElementById("histThemeIcon");

  const sunSVG  = '<circle cx="7" cy="7" r="3" fill="currentColor"/><line x1="7" y1="0.5" x2="7" y2="2.5" stroke="currentColor" stroke-width="1.4"/><line x1="7" y1="11.5" x2="7" y2="13.5" stroke="currentColor" stroke-width="1.4"/><line x1="0.5" y1="7" x2="2.5" y2="7" stroke="currentColor" stroke-width="1.4"/><line x1="11.5" y1="7" x2="13.5" y2="7" stroke="currentColor" stroke-width="1.4"/><line x1="2.4" y1="2.4" x2="3.8" y2="3.8" stroke="currentColor" stroke-width="1.4"/><line x1="10.2" y1="10.2" x2="11.6" y2="11.6" stroke="currentColor" stroke-width="1.4"/><line x1="11.6" y1="2.4" x2="10.2" y2="3.8" stroke="currentColor" stroke-width="1.4"/><line x1="3.8" y1="10.2" x2="2.4" y2="11.6" stroke="currentColor" stroke-width="1.4"/>';
  const moonSVG = '<path d="M7 1.5C4.2 1.5 2 3.7 2 6.5s2.2 5 5 5c2.3 0 4.2-1.5 4.8-3.6-.5.1-1 .1-1.5.1-2.8 0-5-2.2-5-5 0-.7.1-1.3.4-1.9C5.3 1.7 4.7 1.5 4 1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>';

  function applyHistTheme(theme) {
    if (theme === "light") {
      document.body.classList.add("light");
      if (histThemeIcon) histThemeIcon.innerHTML = moonSVG;
    } else {
      document.body.classList.remove("light");
      if (histThemeIcon) histThemeIcon.innerHTML = sunSVG;
    }
    // Recolour heatmap cells immediately in sync with theme
    const colours = getHeatmapColours();
    document.querySelectorAll(".hcell[data-intensity]").forEach(cell => {
      cell.style.background = colours[parseInt(cell.dataset.intensity)];
    });
    const legCells = document.querySelectorAll(".heatmap-leg-cell");
    colours.forEach((c, i) => { if (legCells[i]) legCells[i].style.background = c; });
  }

  chrome.storage.local.get(["theme"], (data) => {
    applyHistTheme(data.theme || "dark");
  });

  chrome.storage.onChanged.addListener((changes) => {
    if ("theme" in changes) applyHistTheme(changes.theme.newValue || "dark");
  });

  if (histThemeBtn) {
    histThemeBtn.addEventListener("click", () => {
      const isLight = document.body.classList.contains("light");
      const newTheme = isLight ? "dark" : "light";
      chrome.storage.local.set({ theme: newTheme });
      applyHistTheme(newTheme);
    });
  }
  const confirmDelete= document.getElementById("confirmDelete");

  let editMode  = false;
  let selected  = new Set(); // keys: "date::videoTitle"
  let pendingDeleteFn = null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatTime(seconds) {
    seconds = Math.round(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function fullDate(dateStr) {
    // dateStr is "YYYY-MM-DD"
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    return dt.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }

  function extractCleanTitle(rawTitle) {
    if (!rawTitle) return "";
    let t = rawTitle;
    t = t.replace(/\s*\|\s*Animebook\s*$/i, "");
    t = t.replace(/^\s*\d+(\.\d+)?\s*\|\s*/g, "");
    return t.trim();
  }

  function getSeconds(val) {
    if (typeof val === "number") return val;
    if (typeof val === "object" && val !== null) return val.seconds || 0;
    return 0;
  }

  function getSource(val, title) {
    if (typeof val === "object" && val !== null && val.source) return val.source;
    // Guess from title for old entries
    if (/\.(mp4|mkv|avi|webm|mov|flv|m4v)$/i.test(title)) return "animebook";
    const t = title.toLowerCase();
    if (t.includes("- youtube") || t.includes("youtube.com")) return "youtube";
    if (t.includes("comprehensible japanese") || t.includes("cijapanese")) return "cijapanese";
    return null;
  }

  const SOURCE = {
    animebook:   { badgeClass: "badge-animebook",   label: "Animebook",  color: "#6c63ff" },
    youtube:     { badgeClass: "badge-youtube",     label: "YouTube",    color: "#ff4444" },
    asbplayer:   { badgeClass: "badge-asbplayer",   label: "asbplayer",  color: "#e91e8c" },
    cijapanese:  { badgeClass: "badge-cijapanese",  label: "cijapanese", color: "#f472b6" },
    tver:        { badgeClass: "badge-tver",        label: "TVer",       color: "#2563eb" },
    disneyplus:  { badgeClass: "badge-disneyplus",  label: "Disney+",    color: "#2dd4bf" },
    amazonprime: { badgeClass: "badge-amazonprime", label: "Prime",      color: "#f5c518" },
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Donut chart ───────────────────────────────────────────────────────────
  function renderDonut(watchtime) {
    const perDay = watchtime.perDay || {};
    const totals = {};
    let grandTotal = 0;
    let activityTotal = 0;

    Object.values(perDay).forEach(day => {
      Object.values(day.videos || {}).forEach(v => {
        const src  = (typeof v === "object" ? v.source : null) || "animebook";
        const secs = typeof v === "object" ? (v.seconds || 0) : (v || 0);
        totals[src] = (totals[src] || 0) + secs;
        grandTotal  += secs;
      });
      // Add custom activities
      (day.activities || []).forEach(act => {
        const secs = (act.minutes || 0) * 60;
        activityTotal += secs;
        grandTotal    += secs;
      });
    });

    if (activityTotal > 0) totals["activities"] = activityTotal;

    const sources = Object.keys(totals).filter(s => totals[s] > 0)
      .sort((a, b) => {
        if (a === "activities") return 1;
        if (b === "activities") return -1;
        return totals[b] - totals[a];
      });
    if (sources.length === 0) return;

    const colours = sources.map(s =>
      s === "activities" ? "#4a4a5a" : (SOURCE[s] || SOURCE.animebook).color
    );

    const hrs  = Math.floor(grandTotal / 3600);
    const mins = Math.floor((grandTotal % 3600) / 60);
    document.getElementById("donutTotal").textContent =
      hrs > 0 ? hrs + "h " + mins + "m" : mins + "m";

    const legend = document.getElementById("donutLegend");
    legend.innerHTML = sources.map((s, i) => {
      const pct   = grandTotal > 0 ? Math.round(totals[s] / grandTotal * 100) : 0;
      const label = s === "activities" ? "Activities" : (SOURCE[s] || { label: s }).label;
      return "<div class=\"legend-item\">" +
        "<div class=\"legend-dot\" style=\"background:" + colours[i] + "\"></div>" +
        "<span class=\"legend-name\">" + label + "</span>" +
        "<span class=\"legend-pct\">" + pct + "%</span>" +
        "</div>";
    }).join("");

    // SVG donut using stroke-dasharray technique
    const cx = 60, cy = 60, r = 46, sw = 16;
    const circ = 2 * Math.PI * r;
    const gap = sources.length > 1 ? 1.5 : 0;
    let offset = circ * 0.25;
    let svgInner = "";

    sources.forEach((s, i) => {
      const pct   = totals[s] / grandTotal;
      const dash  = Math.max(0, pct * circ - gap);
      const space = circ - dash;
      svgInner +=
        "<circle cx=\"" + cx + "\" cy=\"" + cy + "\" r=\"" + r + "\"" +
        " fill=\"none\"" +
        " stroke=\"" + colours[i] + "\"" +
        " stroke-width=\"" + sw + "\"" +
        " stroke-dasharray=\"" + dash.toFixed(3) + " " + space.toFixed(3) + "\"" +
        " stroke-dashoffset=\"" + offset.toFixed(3) + "\"" +
        "/>";
      offset -= pct * circ;
    });

    const svgWrap = document.getElementById("donutSvgWrap");
    if (!svgWrap) return;
    svgWrap.innerHTML =
      "<svg width=\"120\" height=\"120\" viewBox=\"0 0 120 120\" style=\"display:block;\">" +
      svgInner + "</svg>" +
      "<div id=\"donutTooltip\" style=\"display:none;position:absolute;background:#1e2235;color:#e8e8ec;font-size:10px;padding:6px 10px;border-radius:6px;border:1px solid #2a2e44;pointer-events:none;white-space:nowrap;z-index:10;\"></div>";

    const tooltip = document.getElementById("donutTooltip");
    const slices  = sources.map(s => (totals[s] / grandTotal) * Math.PI * 2);

    svgWrap.onmousemove = (e) => {
      const rect  = svgWrap.getBoundingClientRect();
      const mx    = e.clientX - rect.left - cx;
      const my    = e.clientY - rect.top  - cy;
      const dist  = Math.sqrt(mx * mx + my * my);
      const inner = cx - sw, outer = cx;

      if (dist < inner || dist > outer) { tooltip.style.display = "none"; return; }

      let a = Math.atan2(my, mx) + Math.PI / 2;
      if (a < 0) a += Math.PI * 2;
      if (a > Math.PI * 2) a -= Math.PI * 2;

      let cum = 0;
      for (let i = 0; i < sources.length; i++) {
        cum += slices[i];
        if (a <= cum) {
          const s    = sources[i];
          const secs = totals[s];
          const h    = Math.floor(secs / 3600);
          const m    = Math.floor((secs % 3600) / 60);
          const sec  = Math.floor(secs % 60);
          const t    = h > 0 ? h + "h " + m + "m" : m > 0 ? m + "m " + sec + "s" : sec + "s";
          const pct  = Math.round(secs / grandTotal * 100);
          const lbl  = s === "activities" ? "Activities" : (SOURCE[s] || { label: s }).label;
          tooltip.textContent = lbl + " - " + t + " (" + pct + "%)";
          tooltip.style.display = "block";
          tooltip.style.left = (e.clientX - rect.left + 12) + "px";
          tooltip.style.top  = (e.clientY - rect.top  - 30) + "px";
          return;
        }
      }
      tooltip.style.display = "none";
    };
    svgWrap.onmouseleave = () => { tooltip.style.display = "none"; };
  }


  function render(watchtime) {
    historyDiv.innerHTML = "";
    renderDonut(watchtime);
    const perDay = watchtime.perDay || {};
    const dates  = Object.keys(perDay).sort().reverse();

    if (dates.length === 0) {
      historyDiv.innerHTML = '<div class="empty">No history yet.</div>';
      return;
    }

    dates.forEach(date => {
      const dayInfo = perDay[date];
      if (!dayInfo) return;

      const videos = dayInfo.videos || {};
      const total  = dayInfo.total || 0;

      // ── Source bar proportions ──
      const sourceTotals = {};
      for (const [title, val] of Object.entries(videos)) {
        const s = getSource(val, title) || "unknown";
        sourceTotals[s] = (sourceTotals[s] || 0) + getSeconds(val);
      }

      // ── Day block ──
      const block = document.createElement("div");
      block.className = "day-block";
      block.dataset.date = date;

      // Header
      const hdr = document.createElement("div");
      hdr.className = "day-header";

      const hdrLeft = document.createElement("div");
      hdrLeft.className = "day-header-left";

      // Day checkbox (edit mode)
      const dayCb = document.createElement("div");
      dayCb.className = "row-checkbox";
      dayCb.dataset.day = date;
      hdrLeft.appendChild(dayCb);

      const dateEl = document.createElement("div");
      dateEl.className = "day-date";
      dateEl.textContent = fullDate(date);
      hdrLeft.appendChild(dateEl);
      hdr.appendChild(hdrLeft);

      const rightSide = document.createElement("div");
      rightSide.style.cssText = "display:flex;align-items:center;gap:10px;";

      const delDayBtn = document.createElement("button");
      delDayBtn.className = "day-delete-btn";
      delDayBtn.textContent = "Delete day";
      delDayBtn.addEventListener("click", () => {
        const count = Object.keys(videos).length;
        showConfirm(
          `Delete all ${count} ${count === 1 ? "entry" : "entries"} for ${fullDate(date)}?`,
          () => deleteDay(date)
        );
      });
      rightSide.appendChild(delDayBtn);

      const totalEl = document.createElement("div");
      totalEl.className = "day-total";
      totalEl.textContent = formatTime(total);
      rightSide.appendChild(totalEl);
      hdr.appendChild(rightSide);
      block.appendChild(hdr);

      // Source bar
      const bar = document.createElement("div");
      bar.className = "source-bar";
      if (total > 0) {
        for (const [src, secs] of Object.entries(sourceTotals)) {
          const seg = document.createElement("div");
          const pct = (secs / total * 100).toFixed(1);
          seg.style.cssText = `width:${pct}%;background:${SOURCE[src]?.color || "#444"};`;
          bar.appendChild(seg);
        }
      }
      block.appendChild(bar);

      // Videos
      const vids = document.createElement("div");
      vids.className = "day-videos";

      if (Object.keys(videos).length > 0) {
        const lbl = document.createElement("div");
        lbl.className = "section-label";
        lbl.textContent = "Videos";
        vids.appendChild(lbl);

        for (const [video, val] of Object.entries(videos)) {
          const secs   = getSeconds(val);
          const source = getSource(val, video);
          const key    = `${date}::${video}`;

          const row = document.createElement("div");
          row.className = "video-row";
          row.dataset.key = key;
          row.dataset.source = source || "animebook";
          if (selected.has(key)) row.classList.add("selected");

          // Checkbox
          const cb = document.createElement("div");
          cb.className = "row-checkbox" + (selected.has(key) ? " checked" : "");
          cb.addEventListener("click", () => toggleSelect(key, cb, row));
          row.appendChild(cb);

          // Badge
          if (source && SOURCE[source]) {
            const badge = document.createElement("span");
            badge.className = `vbadge ${SOURCE[source].badgeClass}`;
            badge.textContent = SOURCE[source].label;
            row.appendChild(badge);
          }

          // Title
          const nameEl = document.createElement("span");
          nameEl.className = "vtitle";
          nameEl.textContent = extractCleanTitle(video);
          row.appendChild(nameEl);

          // Time
          const timeEl = document.createElement("span");
          timeEl.className = "vtime";
          timeEl.textContent = formatTime(secs);
          row.appendChild(timeEl);

          vids.appendChild(row);
        }
      }

      // Day checkbox click — select/deselect all in day
      dayCb.addEventListener("click", () => {
        const dayKeys = Array.from(vids.querySelectorAll(".video-row")).map(r => r.dataset.key);
        const allSelected = dayKeys.every(k => selected.has(k));
        dayKeys.forEach(k => {
          if (allSelected) selected.delete(k);
          else selected.add(k);
        });
        updateUI();
        render(getCurrentWatchtime());
      });

      // ── Custom Activities (inside same block, no extra border) ──
      if (dayInfo.activities && dayInfo.activities.length > 0) {
        const actSection = document.createElement("div");
        actSection.className = "custom-activities-section";

        const actLbl = document.createElement("div");
        actLbl.className = "section-label";
        actLbl.style.paddingTop = "10px";
        actLbl.textContent = "Custom Activities";
        actSection.appendChild(actLbl);

        dayInfo.activities.forEach((act, idx) => {
          const key = `${date}::activity::${idx}`;
          const row = document.createElement("div");
          row.className = "video-row";
          row.dataset.key = key;
          if (selected.has(key)) row.classList.add("selected");

          // Checkbox (edit mode)
          const cb = document.createElement("div");
          cb.className = "row-checkbox" + (selected.has(key) ? " checked" : "");
          cb.addEventListener("click", () => toggleSelect(key, cb, row));
          row.appendChild(cb);

          const nameEl = document.createElement("span");
          nameEl.className = "vtitle";
          nameEl.textContent = act.type || "Activity";
          row.appendChild(nameEl);

          const timeEl = document.createElement("span");
          timeEl.className = "vtime";
          timeEl.textContent = formatTime((act.minutes || 0) * 60);
          row.appendChild(timeEl);

          if (act.notes) row.title = act.notes;

          actSection.appendChild(row);
        });
        vids.appendChild(actSection);
      }

      block.appendChild(vids);
      historyDiv.appendChild(block);
    });

    if (editMode) document.body.classList.add("edit-mode");
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleSelect(key, cb, row) {
    if (selected.has(key)) {
      selected.delete(key);
      cb.classList.remove("checked");
      row.classList.remove("selected");
    } else {
      selected.add(key);
      cb.classList.add("checked");
      row.classList.add("selected");
    }
    updateUI();
  }

  function updateUI() {
    const count = selected.size;
    toolbarInfo.textContent = count === 0
      ? "0 entries selected"
      : `${count} ${count === 1 ? "entry" : "entries"} selected`;
    deleteBtn.disabled = count === 0;
  }

  // ── Edit mode toggle ───────────────────────────────────────────────────────

  editToggle.addEventListener("click", () => {
    editMode = !editMode;
    if (!editMode) {
      selected.clear();
      updateUI();
    }
    editToggle.textContent = editMode ? "Done" : "Edit";
    editToggle.classList.toggle("active", editMode);
    editToolbar.classList.toggle("visible", editMode);
    document.body.classList.toggle("edit-mode", editMode);
  });

  // ── Select all ────────────────────────────────────────────────────────────

  selectAllBtn.addEventListener("click", () => {
    const allRows = document.querySelectorAll(".video-row");
    const allKeys = Array.from(allRows).map(r => r.dataset.key);
    const allSelected = allKeys.every(k => selected.has(k));
    allKeys.forEach(k => allSelected ? selected.delete(k) : selected.add(k));
    selectAllBtn.textContent = allSelected ? "Select all" : "Deselect all";
    updateUI();
    render(getCurrentWatchtime());
  });

  // ── Confirm dialog ────────────────────────────────────────────────────────

  function showConfirm(message, onConfirm) {
    confirmBody.textContent = message;
    pendingDeleteFn = onConfirm;
    overlay.classList.add("visible");
  }

  confirmCancel.addEventListener("click", () => {
    overlay.classList.remove("visible");
    pendingDeleteFn = null;
  });

  confirmDelete.addEventListener("click", () => {
    overlay.classList.remove("visible");
    if (pendingDeleteFn) { pendingDeleteFn(); pendingDeleteFn = null; }
  });

  // ── Delete logic ──────────────────────────────────────────────────────────

  function getCurrentWatchtime() {
    return window.__currentWatchtime || { perDay: {}, perVideo: {} };
  }

  function deleteSelected() {
    const wt = getCurrentWatchtime();
    // Separate activity keys from video keys
    const activityKeys = [...selected].filter(k => k.includes("::activity::"));
    const videoKeys    = [...selected].filter(k => !k.includes("::activity::"));

    // Delete videos
    for (const key of videoKeys) {
      const [date, videoTitle] = key.split("::");
      if (wt.perDay[date] && wt.perDay[date].videos) {
        const secs = getSeconds(wt.perDay[date].videos[videoTitle]);
        wt.perDay[date].total = Math.max(0, (wt.perDay[date].total || 0) - secs);
        delete wt.perDay[date].videos[videoTitle];
        if (Object.keys(wt.perDay[date].videos).length === 0 &&
            !(wt.perDay[date].activities?.length > 0)) {
          delete wt.perDay[date];
        }
      }
      if (wt.perVideo && wt.perVideo[videoTitle]) {
        delete wt.perVideo[videoTitle];
      }
    }

    // Delete activities — group by date first, then remove by index (high→low)
    const actByDate = {};
    for (const key of activityKeys) {
      const parts = key.split("::");
      const date  = parts[0];
      const idx   = parseInt(parts[2]);
      if (!actByDate[date]) actByDate[date] = [];
      actByDate[date].push(idx);
    }
    for (const [date, indices] of Object.entries(actByDate)) {
      if (!wt.perDay[date]?.activities) continue;
      // Remove highest indices first to avoid shifting
      indices.sort((a, b) => b - a).forEach(idx => {
        const act = wt.perDay[date].activities[idx];
        if (act) {
          wt.perDay[date].total = Math.max(0, (wt.perDay[date].total || 0) - (act.minutes || 0) * 60);
          wt.perDay[date].activities.splice(idx, 1);
        }
      });
      // Clean up empty day
      if (Object.keys(wt.perDay[date].videos || {}).length === 0 &&
          wt.perDay[date].activities.length === 0) {
        delete wt.perDay[date];
      }
    }

    selected.clear();
    chrome.storage.local.set({ watchtime: wt }, () => {
      window.__currentWatchtime = wt;
      updateUI();
      render(wt);
      buildFilterPills(wt);
      applyFilter(wt);
    });
  }

  function deleteDay(date) {
    const wt = getCurrentWatchtime();
    if (wt.perDay[date]) {
      // Also clean perVideo
      const videos = wt.perDay[date].videos || {};
      for (const title of Object.keys(videos)) {
        if (wt.perVideo && wt.perVideo[title]) delete wt.perVideo[title];
        selected.delete(`${date}::${title}`);
      }
      delete wt.perDay[date];
    }
    chrome.storage.local.set({ watchtime: wt }, () => {
      window.__currentWatchtime = wt;
      updateUI();
      render(wt);
      buildFilterPills(wt);
      applyFilter(wt);
    });
  }

  deleteBtn.addEventListener("click", () => {
    const count = selected.size;
    showConfirm(
      `Permanently delete ${count} ${count === 1 ? "entry" : "entries"}? This cannot be undone.`,
      deleteSelected
    );
  });

  // ── Source filter ─────────────────────────────────────────────────────────
  let activeFilters = new Set(); // empty = show all

  function getSourcesInHistory(watchtime) {
    const found = new Set();
    Object.values(watchtime.perDay || {}).forEach(day => {
      Object.values(day.videos || {}).forEach(v => {
        const src = (typeof v === "object" ? v.source : null) || "animebook";
        found.add(src);
      });
      if ((day.activities || []).length > 0) found.add("activities");
    });
    return found;
  }

  function buildFilterPills(watchtime) {
    const pillsEl  = document.getElementById("filterPills");
    const resetEl  = document.getElementById("filterReset");
    if (!pillsEl || !resetEl) return;

    const sources = getSourcesInHistory(watchtime);
    pillsEl.innerHTML = "";

    sources.forEach(s => {
      const isActivity = s === "activities";
      const info  = isActivity
        ? { label: "Activities", color: "#4a4a5a", textColor: "#aaa" }
        : { label: (SOURCE[s] || { label: s }).label,
            color: (SOURCE[s] || SOURCE.animebook).color,
            textColor: (SOURCE[s] || SOURCE.animebook).color };

      const pill = document.createElement("span");
      pill.className = "filter-pill" + (activeFilters.size === 0 || activeFilters.has(s) ? " active" : "");
      pill.textContent = info.label;
      const isLight = document.body.classList.contains("light");
      pill.style.background = info.color + (isLight ? "22" : "18");
      pill.style.color = info.textColor;
      pill.style.borderColor = activeFilters.has(s) ? info.textColor : "transparent";
      pill.dataset.source = s;

      pill.addEventListener("click", () => {
        if (activeFilters.has(s)) {
          activeFilters.delete(s);
        } else {
          activeFilters.add(s);
        }
        // If all pills are active or all inactive, treat as "show all"
        if (activeFilters.size === sources.size) activeFilters.clear();
        applyFilter(watchtime);
        buildFilterPills(watchtime);
      });

      pillsEl.appendChild(pill);
    });

    resetEl.style.display = activeFilters.size > 0 ? "block" : "none";
    resetEl.onclick = () => {
      activeFilters.clear();
      applyFilter(watchtime);
      buildFilterPills(watchtime);
    };
  }

  function applyFilter(watchtime) {
    if (activeFilters.size === 0) {
      // Show everything
      document.querySelectorAll(".day-block").forEach(el => el.style.display = "");
      document.querySelectorAll(".video-row, .activity-row").forEach(el => el.style.display = "");
      document.querySelectorAll(".custom-activities-section").forEach(el => el.style.display = "");
      return;
    }

    const perDay = watchtime.perDay || {};

    document.querySelectorAll(".day-block").forEach(dayEl => {
      const date = dayEl.dataset.date;
      const dayInfo = perDay[date];
      if (!dayInfo) { dayEl.style.display = "none"; return; }

      let hasMatch = false;

      // Filter video rows
      dayEl.querySelectorAll(".video-row[data-source]").forEach(row => {
        const src = row.dataset.source || "animebook";
        const show = activeFilters.has(src);
        row.style.display = show ? "" : "none";
        if (show) hasMatch = true;
      });

      // Filter custom activities section
      const actSection = dayEl.querySelector(".custom-activities-section");
      if (actSection) {
        const show = activeFilters.has("activities");
        actSection.style.display = show ? "" : "none";
        if (show) hasMatch = true;
      }

      dayEl.style.display = hasMatch ? "" : "none";
    });
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  const HEATMAP_COLOURS_DARK  = ["#1a1c2a","#2a1f6e","#4a35aa","#6c63ff","#9d8fff"];
  const HEATMAP_COLOURS_LIGHT = ["#eeeef8","#c8c0ff","#9d8fff","#6c63ff","#4a35aa"];
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAY_LABELS  = ["","Mo","","We","","Fr",""];

  let heatmapYear = new Date().getFullYear();

  function getHeatmapColours() {
    return document.body.classList.contains("light") ? HEATMAP_COLOURS_LIGHT : HEATMAP_COLOURS_DARK;
  }

  function buildHeatmap(watchtime, year) {
    const yearEl    = document.getElementById("heatmapYear");
    const monthsEl  = document.getElementById("heatmapMonths");
    const gridEl    = document.getElementById("heatmapGrid");
    const tooltipEl = document.getElementById("heatmapTooltip");
    if (!yearEl || !monthsEl || !gridEl) return;

    yearEl.textContent = year;

    // Build daily totals map for this year
    const perDay = (watchtime && watchtime.perDay) || {};
    const dailyTotals = {};
    let maxSecs = 0;
    Object.entries(perDay).forEach(([date, day]) => {
      if (!date.startsWith(year + "")) return;
      let total = 0;
      Object.values(day.videos || {}).forEach(v => {
        total += typeof v === "object" ? (v.seconds || 0) : (v || 0);
      });
      (day.activities || []).forEach(a => { total += (a.minutes || 0) * 60; });
      if (total > 0) { dailyTotals[date] = total; maxSecs = Math.max(maxSecs, total); }
    });

    // Jan 1 of year — what day of week?
    const jan1 = new Date(year, 0, 1);
    const startOffset = (jan1.getDay() + 6) % 7; // Mon=0
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;
    const totalCols = Math.ceil((daysInYear + startOffset) / 7);
    const colours = getHeatmapColours();

    // Month labels
    monthsEl.innerHTML = "";
    const monthCols = [0];
    for (let m = 1; m < 12; m++) {
      const d = new Date(year, m, 1);
      const dayOfYear = Math.floor((d - jan1) / 86400000);
      monthCols.push(Math.floor((dayOfYear + startOffset) / 7));
    }
    monthCols.forEach((col, i) => {
      const span = document.createElement("span");
      span.className = "heatmap-month";
      span.textContent = MONTH_NAMES[i];
      const nextCol = monthCols[i + 1] || totalCols;
      span.style.flex = (nextCol - col).toString();
      monthsEl.appendChild(span);
    });

    // Grid
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "24px repeat(" + totalCols + ", 1fr)";

    for (let row = 0; row < 7; row++) {
      const lbl = document.createElement("div");
      lbl.className = "heatmap-day-lbl";
      lbl.textContent = DAY_LABELS[row];
      gridEl.appendChild(lbl);

      for (let col = 0; col < totalCols; col++) {
        const dayIndex = col * 7 + row - startOffset;
        const cell = document.createElement("div");

        if (dayIndex < 0 || dayIndex >= daysInYear) {
          cell.style.background = "transparent";
          gridEl.appendChild(cell);
          continue;
        }

        const date = new Date(year, 0, dayIndex + 1);
        const dateStr = date.getFullYear() + "-" +
          String(date.getMonth() + 1).padStart(2, "0") + "-" +
          String(date.getDate()).padStart(2, "0");
        const secs = dailyTotals[dateStr] || 0;

        let intensity = 0;
        if (secs > 0 && maxSecs > 0) {
          intensity = Math.max(1, Math.min(4, Math.ceil((secs / maxSecs) * 4)));
        }

        cell.className = "hcell";
        cell.dataset.intensity = intensity;
        cell.style.background = colours[intensity];

        // Tooltip for every cell
        const monthNames2 = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const day = date.getDate();
        const suffix = day === 1 || day === 21 || day === 31 ? "st" :
                       day === 2 || day === 22 ? "nd" :
                       day === 3 || day === 23 ? "rd" : "th";
        const friendlyDate = monthNames2[date.getMonth()] + " " + day + suffix;
        const secs2 = dailyTotals[dateStr] || 0;
        let timeStr2 = "No activity";
        if (secs2 > 0) {
          const h2 = Math.floor(secs2 / 3600);
          const m2 = Math.floor((secs2 % 3600) / 60);
          timeStr2 = h2 > 0 ? h2 + "h " + m2 + "m" : m2 + "m";
        }
        const label = friendlyDate + " - " + timeStr2;

        cell.addEventListener("mouseenter", () => {
          tooltipEl.textContent = label;
          tooltipEl.style.display = "block";
        });
        cell.addEventListener("mousemove", (e) => {
          tooltipEl.style.left = (e.clientX + 12) + "px";
          tooltipEl.style.top  = (e.clientY - 32) + "px";
        });
        cell.addEventListener("mouseleave", () => {
          tooltipEl.style.display = "none";
        });
        gridEl.appendChild(cell);
      }
    }

    // Update legend colours
    const legCells = document.querySelectorAll(".heatmap-leg-cell");
    colours.forEach((c, i) => { if (legCells[i]) legCells[i].style.background = c; });
  }

  function initHeatmap(watchtime) {
    buildHeatmap(watchtime, heatmapYear);

    document.getElementById("heatmapPrev").addEventListener("click", () => {
      heatmapYear--;
      buildHeatmap(window.__currentWatchtime, heatmapYear);
    });
    document.getElementById("heatmapNext").addEventListener("click", () => {
      heatmapYear++;
      buildHeatmap(window.__currentWatchtime, heatmapYear);
    });
  }

  // Re-colour heatmap cells on theme change without rebuilding
  chrome.storage.onChanged.addListener((changes) => {
    if ("theme" in changes) {
      const colours = getHeatmapColours();
      document.querySelectorAll(".hcell[data-intensity]").forEach(cell => {
        cell.style.background = colours[parseInt(cell.dataset.intensity)];
      });
      const legCells = document.querySelectorAll(".heatmap-leg-cell");
      colours.forEach((c, i) => { if (legCells[i]) legCells[i].style.background = c; });
    }
  });

  // ── Initial load ──────────────────────────────────────────────────────────

  chrome.storage.local.get(["watchtime"], (data) => {
    const wt = data.watchtime || { perDay: {}, perVideo: {} };
    window.__currentWatchtime = wt;
    render(wt);
    buildFilterPills(wt);
    initHeatmap(wt);
  });
});
