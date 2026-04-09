// disneyplus.js — Animebook Time Tracker v4.0
// MAIN world. Intercepts JSON.parse for title, injects Track button
// next to asbplayer's controls at the top of the player.

(function () {
  if (window.__animebookTrackerDisneyLoaded) return;
  window.__animebookTrackerDisneyLoaded = true;

  // ── Title capture ─────────────────────────────────────────────────────────
  let capturedTitle = null;
  const _origParse = JSON.parse;
  JSON.parse = function () {
    const result = _origParse.apply(this, arguments);
    try {
      if (result?.data?.playerExperience?.title) {
        let t = result.data.playerExperience.title;
        if (result.data.playerExperience.subtitle) t += " — " + result.data.playerExperience.subtitle;
        capturedTitle = t;
      }
    } catch (e) {}
    return result;
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let trackingEnabled = false;
  let globalTrackingEnabled = false;
  let autoHideEnabled = false;
  let autoHideTimer = null;

  function showOverlayDP() {
    const el = document.getElementById("at-dp-overlay");
    if (el && globalTrackingEnabled) el.style.opacity = "1";
  }

  function scheduleHideDP() {
    if (!autoHideEnabled) return;
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      const el = document.getElementById("at-dp-overlay");
      if (el) el.style.opacity = "0";
    }, 5000);
  }

  function applyAutoHideDP(enabled) {
    autoHideEnabled = enabled;
    const el = document.getElementById("at-dp-overlay");
    if (!el) return;
    if (!enabled) {
      clearTimeout(autoHideTimer);
      el.style.opacity = "1";
      el.style.transition = "";
    } else {
      el.style.transition = "opacity 0.4s";
      scheduleHideDP();
    }
  }

  document.addEventListener("animebook-autohide-state", (e) => {
    applyAutoHideDP(e.detail.enabled);
  });

  document.addEventListener("mousemove", () => {
    if (!autoHideEnabled) return;
    showOverlayDP();
    scheduleHideDP();
  });
  let startTime       = null;
  let timerIntervalId = null;
  let timerSeconds    = 0;
  let sessionDelta    = 0;
  let video           = null;
  let overlayEl       = null;
  let dotEl           = null;
  let labelEl         = null;
  let timerEl         = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function getVideoTitle() {
    if (capturedTitle) return capturedTitle;
    return document.title.replace(/\s*\|\s*Disney\+\s*$/i, "").trim() || "Disney+ video";
  }

  function formatTimer(secs) {
    secs = Math.floor(secs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function flushSave() {
    if (startTime) { sessionDelta += (Date.now() - startTime) / 1000; startTime = null; }
    if (sessionDelta <= 0) return;
    document.dispatchEvent(new CustomEvent("animebook-tracker-save", {
      detail: { delta: sessionDelta, today: getLocalDateString(), videoTitle: getVideoTitle(), source: "disneyplus" }
    }));
    sessionDelta = 0;
  }

  // ── Tracking ──────────────────────────────────────────────────────────────
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
      // Save every second so the popup updates live
      document.dispatchEvent(new CustomEvent("animebook-tracker-save", {
        detail: { delta: elapsed, today: getLocalDateString(), videoTitle: getVideoTitle(), source: "disneyplus" }
      }));
      sessionDelta = 0;
    }, 1000);
  }

  function stopTimerInterval() {
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
  }

  function pauseTracking() { flushSave(); stopTimerInterval(); }

  function toggleTracking() {
    trackingEnabled = !trackingEnabled;
    if (trackingEnabled) {
      // Find video at toggle time — works even if not found during poll
      const v = findVideo();
      if (v) { video = v; attachVideoListeners(v); }
      if (video && !video.paused && !video.ended) { startTime = Date.now(); startTimerInterval(); }
    } else {
      pauseTracking();
      timerSeconds = 0;
    }
    updateButtonState();
  }

  // ── Find video — skips hidden dummy elements ──────────────────────────────
  function findVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    // Prefer a visible, non-hidden video
    const visible = videos.find(v => v.style.display !== "none" && v.style.visibility !== "hidden");
    if (visible) return visible;
    // Fallback: search shadow roots
    for (const el of document.querySelectorAll("*")) {
      if (el.shadowRoot) {
        const v = el.shadowRoot.querySelector("video");
        if (v && v.style.display !== "none") return v;
      }
    }
    return null;
  }

  // ── Video listeners ───────────────────────────────────────────────────────
  function attachVideoListeners(v) {
    if (v._animebookDPAttached) return;
    v._animebookDPAttached = true;
    v.addEventListener("play",  () => {
      if (!trackingEnabled) return;
      startTime = Date.now(); startTimerInterval();
      if (autoHideEnabled) scheduleHideDP();
    });
    v.addEventListener("pause", () => {
      if (!trackingEnabled) return;
      pauseTracking();
      showOverlayDP();
      clearTimeout(autoHideTimer);
    });
    v.addEventListener("ended", () => { if (!trackingEnabled) return; pauseTracking(); trackingEnabled = false; timerSeconds = 0; updateButtonState(); });
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  function createOverlay() {
    if (overlayEl) return;

    if (!document.getElementById("at-dp-style")) {
      const s = document.createElement("style");
      s.id = "at-dp-style";
      s.textContent = `@keyframes at-dp-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        #at-dp-overlay { display:flex;align-items:center;border-radius:8px;overflow:hidden;
          box-shadow:0 2px 12px rgba(0,0,0,.6);cursor:pointer;user-select:none;
          transition:transform .1s;font-family:'SF Mono','Fira Code',monospace; }
        #at-dp-overlay:hover { transform:scale(1.04); }`;
      document.head.appendChild(s);
    }

    overlayEl = document.createElement("div");
    overlayEl.id = "at-dp-overlay";

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
    overlayEl.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); toggleTracking(); });
  }

  const STORAGE_KEY_DP = "overlayPos_disneyplus";
  let savedPosDP = null;

  document.addEventListener("animebook-overlay-pos", (e) => {
    if (e.detail.site !== "disneyplus") return;
    savedPosDP = e.detail.pos;
    const wrapper = document.getElementById("at-dp-overlay");
    if (wrapper && savedPosDP) {
      wrapper.style.left = savedPosDP.left;
      wrapper.style.top  = savedPosDP.top;
    }
  });

  function makeDraggableFixed(wrapperEl, site) {
    let dragging = false, didDrag = false, startX, startY, startLeft, startTop;

    wrapperEl.addEventListener("mousedown", (e) => {
      if (e.target.dataset && e.target.dataset.atBadge) {
        dragging = true;
        didDrag = false;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = wrapperEl.getBoundingClientRect().left;
        startTop  = wrapperEl.getBoundingClientRect().top;
        wrapperEl.style.transition = "none";
        wrapperEl.style.cursor = "grabbing";
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      didDrag = true;
      const newLeft = Math.max(0, Math.min(startLeft + (e.clientX - startX), window.innerWidth  - wrapperEl.offsetWidth));
      const newTop  = Math.max(0, Math.min(startTop  + (e.clientY - startY), window.innerHeight - wrapperEl.offsetHeight));
      wrapperEl.style.left = newLeft + "px";
      wrapperEl.style.top  = newTop  + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      wrapperEl.style.cursor = "";
      if (didDrag) {
        document.dispatchEvent(new CustomEvent("animebook-save-pos", {
          detail: { site, left: wrapperEl.style.left, top: wrapperEl.style.top }
        }));
      }
    });

    // Suppress click after a drag
    wrapperEl.addEventListener("click", (e) => {
      if (didDrag) { didDrag = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  function injectOverlay() {
    if (document.getElementById("at-dp-overlay")) return;
    if (!overlayEl) return;

    const wrapper = document.createElement("div");
    wrapper.id = "at-dp-overlay";
    const pos = savedPosDP;
    wrapper.style.cssText = `position:fixed;top:${pos ? pos.top : "8px"};left:${pos ? pos.left : "calc(50% - 277px)"};z-index:2147483647;visibility:hidden;`;
    wrapper.appendChild(overlayEl);
    document.body.appendChild(wrapper);
    makeDraggableFixed(wrapper, "disneyplus");
    document.dispatchEvent(new CustomEvent("animebook-load-pos", { detail: { site: "disneyplus" } }));
  }

  function updateButtonState() {
    if (!overlayEl) return;
    const btn = overlayEl.querySelector("div:last-child");
    if (!btn) return;
    if (trackingEnabled) {
      btn.style.color = "#4ade80";
      dotEl.style.background = "#4ade80"; dotEl.style.boxShadow = "0 0 4px #4ade80";
      dotEl.style.animation = "at-dp-pulse 1.5s ease-in-out infinite";
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

  // ── Main poll ─────────────────────────────────────────────────────────────
  setInterval(() => {
    if (!location.pathname.includes("/play/")) {
      const old = document.getElementById("at-dp-overlay");
      if (old) { flushSave(); old.remove(); overlayEl = null; dotEl = null; labelEl = null; timerEl = null; trackingEnabled = false; timerSeconds = 0; }
      return;
    }

    const v = findVideo();
    if (v && !v._animebookDPAttached) attachVideoListeners(v);
    if (v) video = v;

    if (!overlayEl) createOverlay();
    if (!document.getElementById("at-dp-overlay")) {
      injectOverlay();
      document.dispatchEvent(new CustomEvent("animebook-request-state"));
    }

  }, 2000);

  window.addEventListener("beforeunload", flushSave);

  // Listen for global tracking toggle from bridge
  document.addEventListener("animebook-tracking-state", (e) => {
    globalTrackingEnabled = e.detail.enabled;
    const overlay = document.getElementById("at-dp-overlay");
    if (!globalTrackingEnabled) {
      if (trackingEnabled) { pauseTracking(); trackingEnabled = false; updateButtonState(); }
      if (overlay) overlay.style.visibility = "hidden";
    } else {
      if (overlay) overlay.style.visibility = "visible";
    }
  });
})();
