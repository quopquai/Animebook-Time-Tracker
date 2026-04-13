// popup.js

document.addEventListener("DOMContentLoaded", function () {

  // ==============================
  // VERSION
  // ==============================
  const version = chrome.runtime.getManifest().version;
  const versionEl = document.getElementById("version");
  if (versionEl) versionEl.textContent = `v${version}`;

  // ==============================
  // THEME TOGGLE
  // ==============================
  const themeToggleBtn = document.getElementById("themeToggle");
  const themeIcon      = document.getElementById("themeIcon");

  const sunSVG = `<circle cx="7" cy="7" r="3" fill="currentColor"/>
    <line x1="7" y1="0.5" x2="7" y2="2.5" stroke="currentColor" stroke-width="1.4"/>
    <line x1="7" y1="11.5" x2="7" y2="13.5" stroke="currentColor" stroke-width="1.4"/>
    <line x1="0.5" y1="7" x2="2.5" y2="7" stroke="currentColor" stroke-width="1.4"/>
    <line x1="11.5" y1="7" x2="13.5" y2="7" stroke="currentColor" stroke-width="1.4"/>
    <line x1="2.4" y1="2.4" x2="3.8" y2="3.8" stroke="currentColor" stroke-width="1.4"/>
    <line x1="10.2" y1="10.2" x2="11.6" y2="11.6" stroke="currentColor" stroke-width="1.4"/>
    <line x1="11.6" y1="2.4" x2="10.2" y2="3.8" stroke="currentColor" stroke-width="1.4"/>
    <line x1="3.8" y1="10.2" x2="2.4" y2="11.6" stroke="currentColor" stroke-width="1.4"/>`;

  const moonSVG = `<path d="M7 1.5C4.2 1.5 2 3.7 2 6.5s2.2 5 5 5c2.3 0 4.2-1.5 4.8-3.6-.5.1-1 .1-1.5.1-2.8 0-5-2.2-5-5 0-.7.1-1.3.4-1.9C5.3 1.7 4.7 1.5 4 1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>`;

  function applyTheme(theme) {
    if (theme === "light") {
      document.body.classList.add("light");
      themeIcon.innerHTML = moonSVG;
    } else {
      document.body.classList.remove("light");
      themeIcon.innerHTML = sunSVG;
    }
  }

  // Load saved theme
  chrome.storage.local.get(["theme"], (data) => {
    applyTheme(data.theme || "dark");
  });

  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.contains("light");
    const newTheme = isLight ? "dark" : "light";
    chrome.storage.local.set({ theme: newTheme });
    applyTheme(newTheme);
  });
  const toggleEl     = document.getElementById("trackingToggle");
  const pausedBanner = document.getElementById("pausedBanner");
  const bodyEl       = document.body;

  function applyTrackingState(enabled) {
    toggleEl.checked = enabled;
    if (enabled) {
      bodyEl.classList.remove("tracking-disabled");
      pausedBanner.classList.remove("visible");
    } else {
      bodyEl.classList.add("tracking-disabled");
      pausedBanner.classList.add("visible");
    }
    chrome.runtime.sendMessage({ type: "SET_TRACKING_ENABLED", enabled });
  }

  // Load saved state
  chrome.storage.local.get(["trackingEnabled"], (data) => {
    const enabled = data.trackingEnabled !== false; // default on
    applyTrackingState(enabled);
  });

  toggleEl.addEventListener("change", () => {
    const enabled = toggleEl.checked;
    chrome.storage.local.set({ trackingEnabled: enabled });
    applyTrackingState(enabled);
  });

  chrome.storage.local.get(["watchtime", "dailyGoalMinutes"], (data) => {
    const watchtime = data.watchtime || { perDay: {}, perVideo: {} };
    let perDay = watchtime.perDay || {};
    window._perDay = perDay;

    let dailyGoalMinutes = data.dailyGoalMinutes ?? 15;

    // Poll storage every second — pauseable so modals don't get overwritten
    let pollerPaused = false;
    setInterval(() => {
      if (pollerPaused) return;
      chrome.storage.local.get(["watchtime"], (res) => {
        const wt = res.watchtime || { perDay: {}, perVideo: {} };
        perDay = wt.perDay || {};
        window._perDay = perDay;
        calculateTotals();
        renderLevelProgressBar();
      });
    }, 1000);

    // ==============================
    // HELPERS
    // ==============================

    function formatTime(seconds) {
      seconds = Math.round(seconds);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    }

    function formatToday(seconds) {
      seconds = Math.round(seconds);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }

    function formatAllTime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    }

    function formatDateLocal(d) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${day}`;
    }

    function getDates() {
      return Object.keys(window._perDay || {}).sort();
    }

    // ==============================
    // LEVEL SYSTEM
    // ==============================

    const DEFAULT_LEVELS = [
      { name: "Complete Beginner",  min: 0,    max: 100,  color: "#4ade80" },
      { name: "Beginner",           min: 100,  max: 300,  color: "#22c55e" },
      { name: "Lower Intermediate", min: 300,  max: 600,  color: "#38bdf8" },
      { name: "Upper Intermediate", min: 600,  max: 1200, color: "#3b82f6" },
      { name: "Lower Advanced",     min: 1200, max: 2000, color: "#fb923c" },
      { name: "Upper Advanced",     min: 2000, max: 3000, color: "#ef4444" }
    ];

    let levelConfig = [];

    chrome.storage.local.get(["levelConfig"], (res) => {
      levelConfig = (Array.isArray(res.levelConfig) && res.levelConfig.length)
        ? res.levelConfig
        : DEFAULT_LEVELS;
      if (!res.levelConfig) chrome.storage.local.set({ levelConfig });
      buildLevelSettingsUI();
      renderLevelProgressBar();
    });



    // ==============================
    // CALCULATE & DISPLAY TOTALS
    // ==============================

    // Returns the Monday of the current calendar week as a Date
    function getThisMonday() {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
      const daysFromMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysFromMonday);
      monday.setHours(0, 0, 0, 0);
      return monday;
    }

    function calculateTotals() {
      const now = new Date();
      const thisMonday = getThisMonday();
      const thisSunday = new Date(thisMonday);
      thisSunday.setDate(thisMonday.getDate() + 6);
      thisSunday.setHours(23, 59, 59, 999);

      let today = 0, week = 0, month = 0, allTime = 0, daysImmersed = 0;

      getDates().forEach(date => {
        const dayInfo = perDay[date];
        if (!dayInfo) return;
        const totalSec = dayInfo.total || 0;
        allTime += totalSec;

        if (totalSec > 0 || (dayInfo.activities && dayInfo.activities.length > 0)) {
          daysImmersed++;
        }

        const d = new Date(date + "T00:00:00");

        if (date === formatDateLocal(now)) today += totalSec;
        if (d >= thisMonday && d <= thisSunday) week += totalSec;
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month += totalSec;
      });

      // Count unique videos directly from perDay — no extra storage read needed
      const allVideos = new Set();
      Object.values(perDay).forEach(dayInfo => {
        if (dayInfo.videos) Object.keys(dayInfo.videos).forEach(v => allVideos.add(v));
      });

      document.getElementById("today").textContent   = formatToday(today);
      document.getElementById("week").textContent    = formatTime(week);
      document.getElementById("month").textContent   = formatTime(month);
      document.getElementById("alltime-stat").textContent = formatAllTime(allTime);


      const daysEl   = document.getElementById("days-immersed");
      const videosEl = document.getElementById("videos-watched");
      if (daysEl)   daysEl.textContent   = daysImmersed;
      if (videosEl) videosEl.textContent = allVideos.size;

      updateDailyGoal(today);
    }

    calculateTotals();

    // Auto-refresh at midnight
    let lastDate = formatDateLocal(new Date());
    setInterval(() => {
      const currentDate = formatDateLocal(new Date());
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        calculateTotals();
      }
    }, 60 * 1000);

    // ==============================
    // DAILY GOAL RENDER
    // ==============================

    function updateDailyGoal(todaySeconds) {
      const bar  = document.getElementById("daily-goal-bar");
      const text = document.getElementById("daily-goal-text");
      if (!bar || !text) return;
      const todayMinutes = Math.floor(todaySeconds / 60);
      const percent = Math.min(100, (todayMinutes / dailyGoalMinutes) * 100);
      bar.style.width = percent + "%";
      text.textContent = `${todayMinutes}m / ${dailyGoalMinutes}m`;
      // highlight active preset
      document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.minutes) === dailyGoalMinutes);
      });
      const customInput = document.getElementById("goal-custom-input");
      if (customInput) customInput.value = dailyGoalMinutes;
    }

    // ==============================
    // GOAL MODAL
    // ==============================

    const goalOverlay   = document.getElementById("goal-modal-overlay");
    const goalClose     = document.getElementById("goal-modal-close");
    const goalSaveBtn   = document.getElementById("goal-save-btn");
    const goalCustomInput = document.getElementById("goal-custom-input");

    document.getElementById("edit-daily-goal").addEventListener("click", () => {
      goalCustomInput.value = dailyGoalMinutes;
      document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.minutes) === dailyGoalMinutes);
      });
      pollerPaused = true;
      goalOverlay.classList.add("open");
    });

    goalClose.addEventListener("click", () => {
      goalOverlay.classList.remove("open");
      pollerPaused = false;
    });
    goalOverlay.addEventListener("click", (e) => {
      if (e.target === goalOverlay) {
        goalOverlay.classList.remove("open");
        pollerPaused = false;
      }
    });

    // Preset buttons
    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        goalCustomInput.value = btn.dataset.minutes;
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Typing in custom input clears active preset
    goalCustomInput.addEventListener("input", () => {
      const val = Number(goalCustomInput.value);
      document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.minutes) === val);
      });
    });

    goalSaveBtn.addEventListener("click", () => {
      const value = parseInt(goalCustomInput.value, 10);
      if (isNaN(value) || value <= 0) return;
      dailyGoalMinutes = value;
      chrome.storage.local.set({ dailyGoalMinutes });
      goalOverlay.classList.remove("open");
      pollerPaused = false;
      calculateTotals();
    });

    // ==============================
    // LEVEL SETTINGS MODAL
    // ==============================

    const levelOverlay = document.getElementById("level-modal-overlay");
    const levelClose   = document.getElementById("level-modal-close");
    const levelList    = document.getElementById("level-settings-list");
    const saveBtn      = document.getElementById("save-level-settings");

    document.getElementById("level-settings-cog").addEventListener("click", () => {
      levelOverlay.classList.add("open");
    });
    levelClose.addEventListener("click", () => levelOverlay.classList.remove("open"));
    levelOverlay.addEventListener("click", (e) => {
      if (e.target === levelOverlay) levelOverlay.classList.remove("open");
    });

    // ── Settings modal ────────────────────────────────────────────────────────
    const settingsOverlay   = document.getElementById("settingsOverlay");
    const settingsClose     = document.getElementById("settings-modal-close");
    const settingsBtn       = document.getElementById("settingsBtn");
    const autoHideToggle    = document.getElementById("autoHideToggle");

    // Load saved auto-hide state
    chrome.storage.local.get(["autoHideTrackBtn"], (data) => {
      autoHideToggle.checked = data.autoHideTrackBtn === true;
    });

    settingsBtn.addEventListener("click", () => {
      settingsOverlay.classList.add("open");
      // Try to load decks when modal opens
      if (ankiToggle.checked) loadAnkiDecks();
    });
    settingsClose.addEventListener("click", () => settingsOverlay.classList.remove("open"));
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay) settingsOverlay.classList.remove("open");
    });

    autoHideToggle.addEventListener("change", () => {
      chrome.storage.local.set({ autoHideTrackBtn: autoHideToggle.checked });
    });

    // ── Anki integration ──────────────────────────────────────────────────────
    const ankiToggle     = document.getElementById("ankiToggle");
    const ankiDeckWrap   = document.getElementById("ankiDeckWrap");
    const ankiDeckSelect = document.getElementById("ankiDeckSelect");
    const ankiStatus     = document.getElementById("ankiStatus");
    const ankiStat       = document.getElementById("anki-stat");
    const ankiCardsEl    = document.getElementById("anki-cards");
    const ankiDeckLabel  = document.getElementById("anki-deck-label");

    const ANKI_URL = "http://127.0.0.1:8765";

    async function ankiRequest(action, params = {}) {
      const resp = await fetch(ANKI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: 6, params })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    }

    async function loadAnkiDecks() {
      ankiStatus.textContent = "Connecting to Anki...";
      ankiDeckSelect.innerHTML = "<option value=''>-- Loading... --</option>";
      try {
        const decks = await ankiRequest("deckNames");
        ankiDeckSelect.innerHTML = decks.map(d =>
          `<option value="${d}">${d}</option>`
        ).join("");
        // Restore saved selection and fetch count
        chrome.storage.local.get(["ankiDeck"], (data) => {
          if (data.ankiDeck) {
            ankiDeckSelect.value = data.ankiDeck;
            fetchAnkiCardCount(data.ankiDeck);
          }
        });
        ankiStatus.textContent = decks.length + " decks found";
      } catch (e) {
        ankiDeckSelect.innerHTML = "<option value=''>-- Anki not reachable --</option>";
        ankiStatus.textContent = "Could not connect to AnkiConnect. Is Anki running?";
      }
    }

    async function fetchAnkiCardCount(deck) {
      try {
        const cards = await ankiRequest("findCards", { query: `deck:"${deck}"` });
        const count = cards.length;
        chrome.storage.local.set({ ankiCardCount: count });
        ankiCardsEl.textContent = count.toLocaleString();
        ankiDeckLabel.textContent = deck;
        ankiStat.style.display = "";
      } catch (e) {
        // Anki offline — show cached count
        chrome.storage.local.get(["ankiCardCount", "ankiDeck"], (data) => {
          const cached = data.ankiCardCount;
          const cachedDeck = data.ankiDeck || deck;
          if (cached !== undefined) {
            ankiCardsEl.textContent = cached.toLocaleString();
            ankiDeckLabel.textContent = "offline";
          } else {
            ankiCardsEl.textContent = "—";
            ankiDeckLabel.textContent = "offline";
          }
          ankiStat.style.display = "";
        });
      }
    }

    function applyAnkiState(enabled, deck) {
      ankiDeckWrap.style.display = enabled ? "block" : "none";
      if (enabled && deck) {
        fetchAnkiCardCount(deck);
      } else {
        ankiStat.style.display = "none";
      }
    }

    // Load saved Anki state on open
    chrome.storage.local.get(["ankiEnabled", "ankiDeck", "ankiCardCount"], (data) => {
      ankiToggle.checked = data.ankiEnabled === true;
      applyAnkiState(data.ankiEnabled === true, data.ankiDeck);
    });

    ankiToggle.addEventListener("change", () => {
      const enabled = ankiToggle.checked;
      chrome.storage.local.set({ ankiEnabled: enabled });
      ankiDeckWrap.style.display = enabled ? "block" : "none";
      if (enabled) {
        loadAnkiDecks();
      } else {
        ankiStat.style.display = "none";
      }
    });

    ankiDeckSelect.addEventListener("change", () => {
      const deck = ankiDeckSelect.value;
      if (!deck) return;
      chrome.storage.local.set({ ankiDeck: deck });
      fetchAnkiCardCount(deck);
    });

    function buildLevelSettingsUI() {
      if (!levelList) return;
      levelList.innerHTML = "";
      levelConfig.forEach((lvl, i) => {
        const row = document.createElement("div");
        row.className = "level-setting-row";
        row.innerHTML = `
          <span class="level-setting-name">${lvl.name}</span>
          <input type="number" class="level-num-input" min="0" value="${lvl.min}" data-i="${i}" data-k="min">
          <input type="number" class="level-num-input" min="0" value="${lvl.max}" data-i="${i}" data-k="max">
          <input type="color" class="level-color-input" value="${lvl.color}" data-i="${i}" data-k="color">
        `;
        levelList.appendChild(row);
      });
    }

    saveBtn.addEventListener("click", () => {
      levelList.querySelectorAll("input").forEach(inp => {
        const i   = Number(inp.dataset.i);
        const key = inp.dataset.k;
        levelConfig[i][key] = key === "color" ? inp.value : Number(inp.value);
      });
      chrome.storage.local.set({ levelConfig }, () => {
        levelOverlay.classList.remove("open");
        renderLevelProgressBar();
      });
    });

    // ==============================
    // LEVEL PROGRESS BAR
    // ==============================

    function renderLevelProgressBar() {
      chrome.storage.local.get(["watchtime", "levelConfig"], (res) => {
        const wt     = res.watchtime || {};
        const levels = res.levelConfig || DEFAULT_LEVELS;

        let allTimeSeconds = 0;
        if (wt.perDay) {
          for (const day of Object.values(wt.perDay)) {
            allTimeSeconds += day.total || 0;
          }
        }

        const hours = allTimeSeconds / 3600;
        let current = levels[levels.length - 1];
        for (const lvl of levels) {
          if (hours >= lvl.min && hours < lvl.max) { current = lvl; break; }
        }

        const range   = current.max - current.min;
        const percent = Math.max(0, Math.min(100, ((hours - current.min) / range) * 100));

        const fill   = document.getElementById("level-progress-fill");
        const name   = document.getElementById("level-name");
        const badge  = document.getElementById("level-number");
        const meta   = document.getElementById("level-meta");

        if (!fill || !name || !meta) return;

        fill.style.width      = percent + "%";
        fill.style.background = current.color;
        name.textContent      = current.name;
        if (badge) badge.textContent = `Level ${levels.indexOf(current) + 1}`;
        meta.textContent      = `${hours.toFixed(1)} / ${current.max} hours`;
      });
    }

    // ==============================
    // CHART FACTORY
    // ==============================

    Chart.defaults.color = "#555";

    function createChart(ctxId, type, labelText, bgColor, borderColor) {
      const ctx = document.getElementById(ctxId).getContext("2d");
      return new Chart(ctx, {
        type,
        data: {
          labels: [],
          datasets: [{
            label: labelText,
            data: [],
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: 1,
            fill: type === "line",
            tension: 0.3,
            pointBackgroundColor: borderColor,
            pointRadius: 3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: false },
            legend: { display: false },
            tooltip: {
              backgroundColor: "#181b27",
              borderColor: "#22263a",
              borderWidth: 1,
              titleColor: "#888",
              bodyColor: "#e8e8ec",
              callbacks: { label: (ctx) => formatTime(ctx.raw) }
            }
          },
          scales: {
            x: {
              grid: { color: "#22263a" },
              ticks: { color: "#555", font: { family: "'SF Mono', monospace", size: 10 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: "#22263a" },
              ticks: {
                color: "#555",
                font: { family: "'SF Mono', monospace", size: 10 },
                callback: (value) => {
                  const h = Math.floor(value / 3600);
                  const m = Math.floor((value % 3600) / 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                }
              }
            }
          }
        }
      });
    }

    const weeklyChart  = createChart("chart-weekly",  "bar",  "Daily Watchtime",   "rgba(108,99,255,0.3)",  "rgba(108,99,255,1)");
    const monthlyChart = createChart("chart-monthly", "line", "Daily Watchtime",   "rgba(74,222,128,0.15)", "rgba(74,222,128,1)");
    const yearlyChart  = createChart("chart-yearly",  "bar",  "Monthly Watchtime", "rgba(251,146,60,0.3)",  "rgba(251,146,60,1)");

    // ==============================
    // RENDER WEEKLY
    // ==============================

    let weekOffset = 0;

    function renderWeekly(offset = 0) {
      const today = new Date();

      // Find the most recent Monday (start of current calendar week)
      const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      const daysFromMonday = (dayOfWeek + 6) % 7; // days since last Monday
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - daysFromMonday);
      thisMonday.setHours(0, 0, 0, 0);

      // Shift back by the offset (each offset = one full week)
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - 7 * offset);
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // Sunday

      const labels = [], values = [];
      const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDateLocal(d);
        labels.push(`${dayNames[d.getDay()]} ${d.getDate()}`);
        values.push(perDay[key]?.total || 0);
      }

      weeklyChart.data.labels           = labels;
      weeklyChart.data.datasets[0].data = values;

      const opts = { month: "short", day: "numeric" };
      const rangeEl = document.getElementById("week-range");
      if (rangeEl) rangeEl.textContent =
        `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`;

      const weekTotal = values.reduce((a, b) => a + b, 0);
      const weekSubEl = document.getElementById("weekly-subtotal");
      if (weekSubEl) weekSubEl.textContent = formatTime(weekTotal);

      weeklyChart.update();
    }

    // ==============================
    // RENDER MONTHLY
    // ==============================

    let monthOffset = 0;

    function renderMonthly(offset = 0) {
      const today  = new Date();
      const target = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const month  = target.getMonth();
      const year   = target.getFullYear();
      const days   = new Date(year, month + 1, 0).getDate();

      const labels = [], values = [];
      for (let i = 1; i <= days; i++) {
        const d   = new Date(year, month, i);
        const key = formatDateLocal(d);
        labels.push(String(i));
        values.push(perDay[key]?.total || 0);
      }

      monthlyChart.data.labels           = labels;
      monthlyChart.data.datasets[0].data = values;

      const rangeEl = document.getElementById("month-range");
      if (rangeEl) rangeEl.textContent =
        target.toLocaleDateString(undefined, { month: "long", year: "numeric" });

      const monthTotal = values.reduce((a, b) => a + b, 0);
      const monthSubEl = document.getElementById("monthly-subtotal");
      if (monthSubEl) monthSubEl.textContent = formatTime(monthTotal);

      monthlyChart.update();
    }

    // ==============================
    // RENDER YEARLY
    // ==============================

    let yearOffset = 0;

    function renderYearly(offset = 0) {
      const year   = new Date().getFullYear() - offset;
      const labels = [], values = [];
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

      for (let m = 0; m < 12; m++) {
        const key = `${year}-${String(m + 1).padStart(2, "0")}`;
        let total = 0;
        getDates().forEach(date => {
          if (date.startsWith(key)) total += perDay[date]?.total || 0;
        });
        labels.push(monthNames[m]);
        values.push(total);
      }

      yearlyChart.data.labels           = labels;
      yearlyChart.data.datasets[0].data = values;

      const rangeEl = document.getElementById("year-range");
      if (rangeEl) rangeEl.textContent = String(year);

      const yearTotal = values.reduce((a, b) => a + b, 0);
      const yearSubEl = document.getElementById("yearly-subtotal");
      if (yearSubEl) yearSubEl.textContent = formatTime(yearTotal);

      yearlyChart.update();
    }

    let alltimeMode = "30days";

    // ==============================
    // ALL TIME CUMULATIVE CHART
    // ==============================

    let alltimeChart = null; // created on first tab click

    renderWeekly(0);
    renderMonthly(0);
    renderYearly(0);

    document.getElementById("week-prev").onclick  = () => { weekOffset++;  renderWeekly(weekOffset); };
    document.getElementById("week-next").onclick  = () => { if (weekOffset  > 0) { weekOffset--;  renderWeekly(weekOffset);  } };
    document.getElementById("month-prev").onclick = () => { monthOffset++; renderMonthly(monthOffset); };
    document.getElementById("month-next").onclick = () => { if (monthOffset > 0) { monthOffset--; renderMonthly(monthOffset); } };
    document.getElementById("year-prev").onclick  = () => { yearOffset++;  renderYearly(yearOffset); };
    document.getElementById("year-next").onclick  = () => { if (yearOffset  > 0) { yearOffset--;  renderYearly(yearOffset);  } };


    // ==============================
    // ALL TIME CUMULATIVE CHART
    // ==============================


    function buildCumulativeData(fromDate) {
      const today = new Date();
      const todayKey = formatDateLocal(today);
      const labels = [], values = [];
      const sortedDates = getDates().sort();
      if (!sortedDates.length) return { labels, values };

      // Normalize fromDate to midnight so date comparisons are clean
      const fromMidnight = new Date(fromDate);
      fromMidnight.setHours(0, 0, 0, 0);
      const fromKey = formatDateLocal(fromMidnight);

      // Sum everything strictly before fromDate (exclude fromDate itself)
      let cumulative = 0;
      sortedDates.forEach(date => {
        if (date < fromKey) cumulative += perDay[date]?.total || 0;
      });

      // Build from fromDate to today (inclusive), adding each day exactly once
      let d = new Date(fromMidnight);
      const todayMidnight = new Date(today);
      todayMidnight.setHours(0, 0, 0, 0);
      while (d <= todayMidnight) {
        const key = formatDateLocal(d);
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        labels.push(`${mo}/${day}`);
        cumulative += perDay[key]?.total || 0;
        values.push(cumulative / 3600);
        d.setDate(d.getDate() + 1);
      }
      return { labels, values };
    }

    function renderAllTime(mode = "30days") {
      const chart = alltimeChart;
      if (!chart) return;

      const today = new Date();
      let fromDate;

      if (mode === "30days") {
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 29);
        chart.data.datasets[0].pointRadius = 3;
        chart.data.datasets[0].pointHoverRadius = 5;
        document.getElementById("alltime-range-label").textContent = "Last 30 days";
        document.getElementById("alltime-btn-30").classList.add("active");
        document.getElementById("alltime-btn-all").classList.remove("active");
      } else {
        const sortedDates = getDates().sort();
        fromDate = sortedDates.length
          ? new Date(sortedDates[0] + "T00:00:00")
          : new Date(today);
        chart.data.datasets[0].pointRadius = 0;
        chart.data.datasets[0].pointHoverRadius = 4;
        document.getElementById("alltime-range-label").textContent = "From your first session";
        document.getElementById("alltime-btn-all").classList.add("active");
        document.getElementById("alltime-btn-30").classList.remove("active");
      }

      const { labels, values } = buildCumulativeData(fromDate);
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;

      const totalSeconds = getDates().reduce((sum, date) => sum + (perDay[date]?.total || 0), 0);
      const subEl = document.getElementById("alltime-total");
      if (subEl) subEl.textContent = formatAllTime(totalSeconds);

      chart.update();
    }



    document.getElementById("alltime-btn-30").addEventListener("click", () => {
      alltimeMode = "30days";
      renderAllTime("30days");
    });
    document.getElementById("alltime-btn-all").addEventListener("click", () => {
      alltimeMode = "alltime";
      renderAllTime("alltime");
    });

    // ==============================
    // TAB SWITCHING
    // ==============================

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
        if (tab.dataset.tab === "alltime") {
          if (!alltimeChart) {
            // First click only — create inside timeout so canvas is fully painted
            setTimeout(() => {
              alltimeChart = createChart(
                "chart-alltime", "line", "Cumulative Watchtime",
                "rgba(108,99,255,0.12)", "rgba(108,99,255,1)"
              );
              alltimeChart.data.datasets[0].fill = true;
              alltimeChart.data.datasets[0].tension = 0.4;
              alltimeChart.options.scales.y.ticks.callback = (v) => {
                const h = Math.floor(v);
                const m = Math.round((v - h) * 60);
                return m > 0 ? `${h}h ${m}m` : `${h}h`;
              };
              alltimeChart.options.scales.y.beginAtZero = true;
              alltimeChart.options.plugins.tooltip.callbacks.label = (c) => {
                const h = Math.floor(c.raw);
                const m = Math.round((c.raw - h) * 60);
                return `${h}h ${m}m total`;
              };
              renderAllTime(alltimeMode);
            }, 100);
          } else {
            renderAllTime(alltimeMode);
          }
        }
        if (tab.dataset.tab === "custom") renderRecentEntries();
      });
    });

    // ==============================
    // CUSTOM ACTIVITY
    // ==============================

    function renderRecentEntries() {
      const container = document.getElementById("recent-entries");
      if (!container) return;
      container.innerHTML = "";

      const entries = [];
      getDates().slice().reverse().forEach(date => {
        const dayInfo = perDay[date];
        if (!dayInfo || !dayInfo.activities) return;
        dayInfo.activities.forEach(act => entries.push({ ...act, date }));
      });

      const recent = entries.slice(0, 5);
      if (recent.length === 0) {
        container.innerHTML = `<div style="font-size:11px;color:#444;text-align:center;padding:8px 0;">No entries yet</div>`;
        return;
      }

      recent.forEach(entry => {
        const el = document.createElement("div");
        el.className = "recent-entry";
        el.innerHTML = `
          <div class="entry-left">
            <span class="entry-type">${entry.type}</span>
            <span class="entry-date">${entry.date}</span>
          </div>
          <div class="entry-right">
            <span class="entry-mins">${entry.minutes} min</span>
            ${entry.notes ? `<span class="entry-notes">${entry.notes}</span>` : ""}
          </div>
        `;
        container.appendChild(el);
      });
    }

    // Set today's date as default
    document.getElementById("custom-date").value = formatDateLocal(new Date());

    document.getElementById("custom-submit").addEventListener("click", () => {
      const date    = document.getElementById("custom-date").value    || formatDateLocal(new Date());
      const type    = document.getElementById("custom-type").value.trim();
      const minutes = parseInt(document.getElementById("custom-minutes").value, 10);
      const notes   = document.getElementById("custom-notes").value.trim();

      if (!type || !minutes || minutes <= 0) {
        alert("Please enter a valid activity type and minutes.");
        return;
      }

      chrome.storage.local.get(["watchtime"], (data) => {
        const wt = data.watchtime || { perDay: {}, perVideo: {} };
        if (!wt.perDay[date]) wt.perDay[date] = { total: 0, videos: {}, activities: [] };
        if (!wt.perDay[date].activities) wt.perDay[date].activities = [];

        wt.perDay[date].activities.push({ type, minutes, notes });
        wt.perDay[date].total += minutes * 60;

        chrome.storage.local.set({ watchtime: wt }, () => {
          const feedback = document.getElementById("custom-feedback");
          feedback.textContent = "✅ Activity added!";
          setTimeout(() => { feedback.textContent = ""; }, 3000);

          document.getElementById("custom-type").value    = "";
          document.getElementById("custom-minutes").value = "";
          document.getElementById("custom-notes").value   = "";

          // refresh local state
          perDay = wt.perDay;
          window._perDay = perDay;

          calculateTotals();
          renderRecentEntries();
        });
      });
    });



    // ==============================
    // HISTORY, EXPORT, IMPORT
    // ==============================

    document.getElementById("see-more").addEventListener("click", () => {
      chrome.tabs.create({ url: "history.html" });
    });

    // ── Export ───────────────────────────────────────────────────────────────
    document.getElementById("exportBtn").addEventListener("click", () => {
      chrome.storage.local.get(["watchtime"], (data) => {
        const json = JSON.stringify(data.watchtime || {}, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "watchtime.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    // ── Import (with overwrite warning) ──────────────────────────────────────
    let pendingImportData = null;

    document.getElementById("importBtn").addEventListener("click", () => {
      document.getElementById("importFile").click();
    });

    document.getElementById("importFile").addEventListener("change", (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.perDay && imported.perVideo) {
            pendingImportData = imported;
            document.getElementById("import-modal-overlay").style.display = "flex";
            pollerPaused = true;
          } else {
            alert("Invalid file format.");
          }
        } catch {
          alert("Failed to parse JSON file.");
        }
      };
      reader.readAsText(file);
    });

    function closeImportModal() {
      document.getElementById("import-modal-overlay").style.display = "none";
      pendingImportData = null;
      pollerPaused = false;
    }

    document.getElementById("importModalClose").addEventListener("click", closeImportModal);
    document.getElementById("importCancelBtn").addEventListener("click", closeImportModal);

    document.getElementById("importConfirmBtn").addEventListener("click", () => {
      if (!pendingImportData) return;
      const imported = pendingImportData;
      closeImportModal();
      chrome.storage.local.set({ watchtime: imported }, () => {
        const btn = document.getElementById("importBtn");
        btn.textContent = "✓ Imported";
        btn.style.color = "#4ade80";
        setTimeout(() => {
          btn.textContent = "Import";
          btn.style.color = "";
        }, 3000);
      });
    });

    // ── Merge (cijapanese) ───────────────────────────────────────────────────
    let pendingCijData = null;

    document.getElementById("cijImportBtn").addEventListener("click", () => {
      document.getElementById("cijImportFile").click();
    });

    document.getElementById("cijImportFile").addEventListener("change", (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target.result);

          // Validate: must be an array with date and duration fields
          if (!Array.isArray(raw) || !raw[0]?.date || raw[0]?.duration === undefined) {
            alert("This doesn't look like a cijapanese export file.");
            return;
          }

          const videoEntries    = raw.filter(r => r.title);
          const activityEntries = raw.filter(r => !r.title);
          const days = new Set(raw.map(r => r.date));
          pendingCijData = raw;

          let summary = `Found <strong style="color:#e0dff8">${days.size} days</strong> of cijapanese history:<br>`;
          summary += `<span style="color:#4ade80">▸ ${videoEntries.length} video entries</span>`;
          if (activityEntries.length > 0) {
            summary += `<br><span style="color:#f5b84a">▸ ${activityEntries.length} custom ${activityEntries.length === 1 ? "activity" : "activities"}</span>`;
          }

          document.getElementById("cijModalBody").innerHTML = summary;
          document.getElementById("cij-modal-overlay").style.display = "flex";
          pollerPaused = true;
        } catch {
          alert("Failed to parse file.");
        }
      };
      reader.readAsText(file);
    });

    function closeCijModal() {
      document.getElementById("cij-modal-overlay").style.display = "none";
      pendingCijData = null;
      pollerPaused = false;
    }

    document.getElementById("cijModalClose").addEventListener("click", closeCijModal);
    document.getElementById("cijCancelBtn").addEventListener("click", closeCijModal);

    document.getElementById("cijConfirmBtn").addEventListener("click", () => {
      if (!pendingCijData) return;
      const entries = pendingCijData;
      closeCijModal();

      chrome.storage.local.get(["watchtime"], (data) => {
        const watchtime = data.watchtime || { perDay: {}, perVideo: {} };
        let videoCount    = 0;
        let activityCount = 0;

        for (const entry of entries) {
          const { date, duration, title, type, userNotes } = entry;
          if (!date || !duration) continue;
          const secs = Math.round(duration);
          if (secs <= 0) continue;

          if (!watchtime.perDay[date]) watchtime.perDay[date] = { total: 0, videos: {} };
          watchtime.perDay[date].total = (watchtime.perDay[date].total || 0) + secs;

          if (title) {
            // ── Video entry ──
            const existing = watchtime.perDay[date].videos[title];
            if (existing && typeof existing === "object") {
              existing.seconds = (existing.seconds || 0) + secs;
            } else {
              watchtime.perDay[date].videos[title] = {
                seconds: (typeof existing === "number" ? existing : 0) + secs,
                source: "cijapanese"
              };
            }
            watchtime.perVideo[title] = (watchtime.perVideo[title] || 0) + secs;
            videoCount++;
          } else {
            // ── Custom activity ──
            if (!watchtime.perDay[date].activities) watchtime.perDay[date].activities = [];
            const label = userNotes || type || "cijapanese activity";
            const mins  = Math.round(secs / 60);
            watchtime.perDay[date].activities.push({
              type:    label,
              minutes: mins,
              notes:   `Imported from cijapanese`
            });
            activityCount++;
          }
        }

        chrome.storage.local.set({ watchtime }, () => {
          const btn = document.getElementById("cijImportBtn");
          const original = btn.textContent;
          let successMsg = `✓ ${videoCount} merged`;
          if (activityCount > 0) successMsg += ` + ${activityCount} activities`;
          btn.textContent = successMsg;
          btn.style.color = "#4ade80";
          setTimeout(() => {
            btn.textContent = original;
            btn.style.color = "#10b981";
          }, 4000);
        });
      });
    });

  }); // end chrome.storage.local.get
}); // end DOMContentLoaded
