// youtube.js — Animebook Tracker v3.4
// Injected once per tab. Uses a single slow poll (3s) only while on a
// watch page. Stops completely on other pages. No YouTube event listeners.

(function () {
  if (window.__animebookTrackerLoaded) return;
  window.__animebookTrackerLoaded = true;

  // ==============================
  // STATE
  // ==============================
  let trackingEnabled = false;
  let startTime       = null;
  let timerIntervalId = null;
  let timerSeconds    = 0;
  let sessionDelta    = 0;
  let video           = null;
  let overlayEl       = null;
  let dotEl           = null;
  let labelEl         = null;
  let timerEl         = null;
  let lastVideoId     = null;
  let onWatchPage     = false;

  // ==============================
  // HELPERS
  // ==============================
  function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function getVideoTitle() {
    const h1 = document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
    if (h1?.textContent?.trim()) return h1.textContent.trim();
    return document.title.replace(/\s*-\s*YouTube\s*$/, "").trim() || "YouTube Video";
  }

  function formatTimer(secs) {
    secs = Math.floor(secs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  function currentVideoId() {
    return new URLSearchParams(location.search).get("v") || null;
  }

  function isWatchPage() {
    return location.pathname === "/watch" && !!currentVideoId();
  }

  // ==============================
  // SAVE
  // ==============================
  function flushSave() {
    if (startTime) {
      sessionDelta += (Date.now() - startTime) / 1000;
      startTime = null;
    }
    if (sessionDelta <= 0) return;
    document.dispatchEvent(new CustomEvent("animebook-tracker-save", {
      detail: { delta: sessionDelta, today: getLocalDateString(), videoTitle: getVideoTitle(), source: "youtube" }
    }));
    sessionDelta = 0;
  }

  // ==============================
  // TRACKING
  // ==============================
  function startTimerInterval() {
    if (timerIntervalId) return;
    timerIntervalId = setInterval(() => {
      if (!trackingEnabled || !startTime) return;
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      timerSeconds += elapsed;
      sessionDelta += elapsed;
      startTime = now;
      updateButtonTimer();
    }, 1000);
  }

  function stopTimerInterval() {
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
  }

  function pauseTracking() {
    flushSave();
    stopTimerInterval();
    updateButtonTimer();
  }

  function toggleTracking() {
    trackingEnabled = !trackingEnabled;
    if (trackingEnabled) {
      if (video && !video.paused && !video.ended) {
        startTime = Date.now();
        startTimerInterval();
      }
    } else {
      pauseTracking();
      timerSeconds = 0;
    }
    updateButtonState();
  }

  function resetForNewVideo() {
    flushSave();
    stopTimerInterval();
    trackingEnabled = false;
    timerSeconds    = 0;
    sessionDelta    = 0;
    startTime       = null;
    video           = null;
    updateButtonState();
  }

  function leavingWatchPage() {
    flushSave();
    stopTimerInterval();
    trackingEnabled = false;
    timerSeconds    = 0;
    sessionDelta    = 0;
    startTime       = null;
    video           = null;
    lastVideoId     = null;
    onWatchPage     = false;
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null; dotEl = null; labelEl = null; timerEl = null;
    }
    const style = document.getElementById("at-style");
    if (style) style.remove();
  }

  // ==============================
  // OVERLAY
  // ==============================
  // ── Drag support (position saved/loaded via bridge events) ────────────────
  let savedPosYT = null;

  // Listen for position loaded from bridge
  document.addEventListener("animebook-overlay-pos", (e) => {
    if (e.detail.site !== "youtube") return;
    savedPosYT = e.detail.pos;
    const el = document.getElementById("at-overlay");
    if (el && savedPosYT) {
      el.style.left = savedPosYT.left;
      el.style.top  = savedPosYT.top;
    }
  });

  function makeDraggableYT(el) {
    let dragging = false, didDrag = false, startX, startY, startLeft, startTop;

    el.addEventListener("mousedown", (e) => {
      if (e.target.dataset && e.target.dataset.atBadge) {
        dragging = true;
        didDrag = false;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(el.style.left) || 12;
        startTop  = parseInt(el.style.top)  || 12;
        el.style.transition = "none";
        el.style.cursor = "grabbing";
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      didDrag = true;
      const player = document.querySelector("#movie_player");
      if (!player) return;
      const rect = player.getBoundingClientRect();
      const newLeft = Math.max(0, Math.min(startLeft + (e.clientX - startX), rect.width  - el.offsetWidth));
      const newTop  = Math.max(0, Math.min(startTop  + (e.clientY - startY), rect.height - el.offsetHeight));
      el.style.left = newLeft + "px";
      el.style.top  = newTop  + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "pointer";
      el.style.transition = "transform .1s";
      if (didDrag) {
        document.dispatchEvent(new CustomEvent("animebook-save-pos", {
          detail: { site: "youtube", left: el.style.left, top: el.style.top }
        }));
      }
    });

    // Suppress click after a drag
    el.addEventListener("click", (e) => {
      if (didDrag) { didDrag = false; e.stopPropagation(); }
    }, true);
  }

  function createOverlay() {
    if (overlayEl) return;
    if (!document.getElementById("at-style")) {
      const s = document.createElement("style");
      s.id = "at-style";
      s.textContent = `@keyframes at-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`;
      document.head.appendChild(s);
    }
    overlayEl = document.createElement("div");
    overlayEl.id = "at-overlay";
    overlayEl.style.cssText = `
      position:absolute;top:12px;left:12px;display:flex;align-items:center;
      border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.5);
      cursor:pointer;user-select:none;z-index:9999;transition:transform .1s;
      font-family:'SF Mono','Fira Code',monospace;
    `;
    overlayEl.addEventListener("mouseenter", () => overlayEl.style.transform = "scale(1.04)");
    overlayEl.addEventListener("mouseleave", () => overlayEl.style.transform = "scale(1)");
    const badge = document.createElement("div");
    badge.textContent = "AT";
    badge.dataset.atBadge = "1";
    badge.style.cssText = `background:linear-gradient(135deg,#6c63ff,#c84bfa);padding:7px 9px;font-size:11px;font-weight:700;color:white;letter-spacing:-.5px;cursor:grab;`;
    dotEl = document.createElement("span");
    dotEl.style.cssText = `width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;background:#555;margin-right:6px;`;
    labelEl = document.createElement("span");
    labelEl.textContent = "Track";
    labelEl.style.cssText = `font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;`;
    timerEl = document.createElement("span");
    timerEl.style.cssText = `font-size:10px;margin-left:6px;max-width:0;overflow:hidden;opacity:0;transition:all .3s;white-space:nowrap;`;
    const btn = document.createElement("div");
    btn.style.cssText = `background:rgba(15,17,23,.92);padding:7px 12px;display:flex;align-items:center;color:#888;`;
    btn.appendChild(dotEl); btn.appendChild(labelEl); btn.appendChild(timerEl);
    overlayEl.appendChild(badge); overlayEl.appendChild(btn);
    overlayEl.addEventListener("click", e => { e.stopPropagation(); toggleTracking(); });
    makeDraggableYT(overlayEl);
    // Apply saved position if already loaded
    if (savedPosYT) { overlayEl.style.left = savedPosYT.left; overlayEl.style.top = savedPosYT.top; }
    // Request position from bridge
    document.dispatchEvent(new CustomEvent("animebook-load-pos", { detail: { site: "youtube" } }));
  }

  function injectOverlay() {
    if (overlayEl && document.getElementById("at-overlay")) return;
    const player = document.querySelector("#movie_player");
    if (player && overlayEl) {
      const old = document.getElementById("at-overlay");
      if (old) old.remove();
      player.style.position = "relative";
      overlayEl.style.visibility = "hidden";
      overlayEl.style.opacity = "1";
      player.appendChild(overlayEl);
      // Ask bridge for current state immediately after injection
      document.dispatchEvent(new CustomEvent("animebook-request-state"));
    }
  }

  function updateButtonState() {
    if (!overlayEl) return;
    const btn = overlayEl.querySelector("div:last-child");
    if (!btn) return;
    if (trackingEnabled) {
      btn.style.color = "#4ade80";
      dotEl.style.background = "#4ade80"; dotEl.style.boxShadow = "0 0 4px #4ade80";
      dotEl.style.animation = "at-pulse 1.5s ease-in-out infinite";
      labelEl.textContent = "Tracking";
      timerEl.style.maxWidth = "70px"; timerEl.style.opacity = "1";
    } else {
      btn.style.color = "#888";
      dotEl.style.background = "#555"; dotEl.style.boxShadow = "none";
      dotEl.style.animation = "none";
      labelEl.textContent = "Track";
      timerEl.style.maxWidth = "0"; timerEl.style.opacity = "0"; timerEl.textContent = "";
    }
  }

  function updateButtonTimer() {
    if (timerEl && trackingEnabled) timerEl.textContent = formatTimer(timerSeconds);
  }

  // ==============================
  // VIDEO LISTENERS
  // ==============================
  function attachVideoListeners(v) {
    if (v._animebookAttached) return;
    v._animebookAttached = true;
    video = v;
    v.addEventListener("play", () => {
      if (!trackingEnabled) return;
      startTime = Date.now(); startTimerInterval();
      if (autoHideEnabled) scheduleHide();
    });
    v.addEventListener("pause", () => {
      if (!trackingEnabled) return;
      pauseTracking();
      if (autoHideEnabled) { showOverlay(); clearTimeout(autoHideTimer); }
    });
    v.addEventListener("ended", () => { if (!trackingEnabled) return; pauseTracking(); trackingEnabled = false; timerSeconds = 0; updateButtonState(); });
  }

  // ==============================
  // MAIN POLL — runs every 3 seconds
  // Does almost nothing on non-watch pages
  // ==============================
  setInterval(() => {
    const nowOnWatch = isWatchPage();
    const vid = currentVideoId();

    if (!nowOnWatch) {
      if (onWatchPage) leavingWatchPage();
      return;
    }

    onWatchPage = true;

    if (vid !== lastVideoId) {
      lastVideoId = vid;
      resetForNewVideo();
    }

    const v = document.querySelector("video");
    if (v && v !== video) attachVideoListeners(v);

    if (!overlayEl) createOverlay();
    injectOverlay();

  }, 3000);

  window.addEventListener("beforeunload", flushSave);

  let globalTrackingEnabled = false; // updated by bridge events
  let autoHideEnabled = false;
  let autoHideTimer = null;

  function showOverlay() {
    const el = document.getElementById("at-overlay");
    if (el && el.style.visibility !== "hidden") el.style.opacity = "1";
  }

  function scheduleHide() {
    if (!autoHideEnabled) return;
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      const el = document.getElementById("at-overlay");
      if (el && el.style.visibility !== "hidden") el.style.opacity = "0";
    }, 5000);
  }

  function applyAutoHide(enabled) {
    autoHideEnabled = enabled;
    const el = document.getElementById("at-overlay");
    if (!el) return;
    if (!enabled) {
      clearTimeout(autoHideTimer);
      if (el.style.visibility !== "hidden") el.style.opacity = "1";
      el.style.transition = "";
    } else {
      el.style.transition = "opacity 0.4s";
      scheduleHide();
    }
  }

  document.addEventListener("animebook-autohide-state", (e) => {
    applyAutoHide(e.detail.enabled);
  });

  // Show on mouse move over player, hide after 5s idle
  document.addEventListener("mousemove", () => {
    if (!autoHideEnabled) return;
    showOverlay();
    scheduleHide();
  });

  // Listen for global tracking toggle from bridge
  document.addEventListener("animebook-tracking-state", (e) => {
    globalTrackingEnabled = e.detail.enabled;
    const overlay = document.getElementById("at-overlay");
    if (!globalTrackingEnabled) {
      if (trackingEnabled) { pauseTracking(); trackingEnabled = false; updateButtonState(); }
      if (overlay) overlay.style.visibility = "hidden";
    } else {
      if (overlay) {
        overlay.style.visibility = "visible";
        overlay.style.opacity = "1";
        if (autoHideEnabled) scheduleHide();
      }
    }
  });

})();
