// amazonprime.js — Animebook Time Tracker v4.1
// MAIN world. Reads title from Amazon's player SDK elements.
// Injects a manual Track button next to asbplayer's controls at the top.

(function () {
  if (window.__animebookTrackerAmazonLoaded) return;
  window.__animebookTrackerAmazonLoaded = true;

  // ── State ─────────────────────────────────────────────────────────────────
  let trackingEnabled = false;
  let globalTrackingEnabled = false;
  let autoHideEnabled = false;
  let autoHideTimer = null;

  function showOverlayAP() {
    const el = document.getElementById("at-ap-overlay");
    if (el && globalTrackingEnabled) el.style.opacity = "1";
  }

  function scheduleHideAP() {
    if (!autoHideEnabled) return;
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      const el = document.getElementById("at-ap-overlay");
      if (el) el.style.opacity = "0";
    }, 5000);
  }

  function applyAutoHideAP(enabled) {
    autoHideEnabled = enabled;
    const el = document.getElementById("at-ap-overlay");
    if (!el) return;
    if (!enabled) {
      clearTimeout(autoHideTimer);
      el.style.opacity = "1";
      el.style.transition = "";
    } else {
      el.style.transition = "opacity 0.4s";
      scheduleHideAP();
    }
  }

  document.addEventListener("animebook-autohide-state", (e) => {
    applyAutoHideAP(e.detail.enabled);
  });

  document.addEventListener("mousemove", () => {
    if (!autoHideEnabled) return;
    showOverlayAP();
    scheduleHideAP();
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
  let lockedTitle     = null; // Title is locked once player opens to avoid split entries

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function getVideoTitle() {
    if (lockedTitle) return lockedTitle;
    const seriesEl  = document.querySelector("[class*='atvwebplayersdk-title-text']");
    const episodeEl = document.querySelector("[class*='atvwebplayersdk-episode-info']");
    const series  = seriesEl?.textContent?.trim();
    const episode = episodeEl?.textContent?.trim();
    if (series && episode) {
      lockedTitle = `${series} — ${episode}`;
      return lockedTitle;
    }
    if (series) return series;
    return document.title
      .replace(/^Amazon\.[^:]+:\s*/i, "")
      .replace(/\s*を観る\s*/i, "")
      .replace(/\s*\|\s*Prime Video\s*$/i, "")
      .trim() || "Amazon Prime video";
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
      detail: { delta: sessionDelta, today: getLocalDateString(), videoTitle: getVideoTitle(), source: "amazonprime" }
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
      document.dispatchEvent(new CustomEvent("animebook-tracker-save", {
        detail: { delta: elapsed, today: getLocalDateString(), videoTitle: getVideoTitle(), source: "amazonprime" }
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
      const v = findVideo();
      if (v) { video = v; attachVideoListeners(v); }
      if (video && !video.paused && !video.ended) { startTime = Date.now(); startTimerInterval(); }
    } else {
      pauseTracking();
      timerSeconds = 0;
    }
    updateButtonState();
  }

  // ── Find video ────────────────────────────────────────────────────────────
  function findVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    return videos.find(v => v.src && v.src.startsWith("blob:")) ||
           videos.find(v => v.src && v.src.length > 0) ||
           null;
  }

  // ── Video listeners ───────────────────────────────────────────────────────
  function attachVideoListeners(v) {
    if (v._animebookAmazonAttached) return;
    v._animebookAmazonAttached = true;
    v.addEventListener("play",  () => {
      if (!trackingEnabled) return;
      startTime = Date.now(); startTimerInterval();
      if (autoHideEnabled) scheduleHideAP();
    });
    v.addEventListener("pause", () => {
      if (!trackingEnabled) return;
      pauseTracking();
      showOverlayAP();
      clearTimeout(autoHideTimer);
    });
    v.addEventListener("ended", () => { if (!trackingEnabled) return; pauseTracking(); trackingEnabled = false; timerSeconds = 0; updateButtonState(); });
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  function createOverlay() {
    if (overlayEl) return;

    if (!document.getElementById("at-ap-style")) {
      const s = document.createElement("style");
      s.id = "at-ap-style";
      s.textContent = `@keyframes at-ap-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        #at-ap-overlay-inner { display:flex;align-items:center;border-radius:8px;overflow:hidden;
          box-shadow:0 2px 12px rgba(0,0,0,.6);cursor:pointer;user-select:none;
          transition:transform .1s;font-family:'SF Mono','Fira Code',monospace; }
        #at-ap-overlay-inner:hover { transform:scale(1.04); }`;
      document.head.appendChild(s);
    }

    overlayEl = document.createElement("div");
    overlayEl.id = "at-ap-overlay-inner";

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

  const STORAGE_KEY_AP = "overlayPos_amazonprime";
  let savedPosAP = null;

  document.addEventListener("animebook-overlay-pos", (e) => {
    if (e.detail.site !== "amazonprime") return;
    savedPosAP = e.detail.pos;
    const wrapper = document.getElementById("at-ap-overlay");
    if (wrapper && savedPosAP) {
      wrapper.style.left = savedPosAP.left;
      wrapper.style.top  = savedPosAP.top;
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
    if (document.getElementById("at-ap-overlay")) return;
    if (!overlayEl) return;
    const wrapper = document.createElement("div");
    wrapper.id = "at-ap-overlay";
    const pos = savedPosAP;
    wrapper.style.cssText = `position:fixed;top:${pos ? pos.top : "8px"};left:${pos ? pos.left : "calc(50% - 325px)"};z-index:2147483647;pointer-events:auto;visibility:hidden;`;
    wrapper.appendChild(overlayEl);
    document.body.appendChild(wrapper);
    makeDraggableFixed(wrapper, "amazonprime");
    document.dispatchEvent(new CustomEvent("animebook-load-pos", { detail: { site: "amazonprime" } }));
  }

  // Watch for Amazon removing our button from body and immediately re-add it
  let overlayObserver = null;
  function startOverlayObserver() {
    if (overlayObserver) return;
    overlayObserver = new MutationObserver(() => {
      if (!isVideoPage()) return;
      if (!document.getElementById("at-ap-overlay")) {
        if (!overlayEl) createOverlay();
        injectOverlay();
        updateButtonState();
      }
    });
    overlayObserver.observe(document.body, { childList: true, subtree: false });
  }

  function stopOverlayObserver() {
    if (overlayObserver) { overlayObserver.disconnect(); overlayObserver = null; }
  }

  function updateButtonState() {
    if (!overlayEl) return;
    const btn = overlayEl.querySelector("div:last-child");
    if (!btn) return;
    if (trackingEnabled) {
      btn.style.color = "#4ade80";
      dotEl.style.background = "#4ade80"; dotEl.style.boxShadow = "0 0 4px #4ade80";
      dotEl.style.animation = "at-ap-pulse 1.5s ease-in-out infinite";
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

  // ── Page detection ────────────────────────────────────────────────────────
  function isVideoPage() {
    return location.pathname.includes("/gp/video/detail/");
  }

  let playerHasOpened = false; // Sticky — once true, stays true until we leave the page

  // Player is open when SDK title elements are present (only while playing)
  // Once seen, we keep the button visible even when paused
  function isPlayerOpen() {
    if (document.querySelector("[class*='atvwebplayersdk-title-text']")) {
      playerHasOpened = true;
    }
    return playerHasOpened;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  function cleanup() {
    stopOverlayObserver();
    const old = document.getElementById("at-ap-overlay");
    if (old) old.remove();
    if (trackingEnabled) { flushSave(); trackingEnabled = false; }
    overlayEl = null; dotEl = null; labelEl = null; timerEl = null;
    timerSeconds = 0; lockedTitle = null; playerHasOpened = false;
    stopTimerInterval();
  }

  // ── Main poll ─────────────────────────────────────────────────────────────
  setInterval(() => {
    if (!isVideoPage()) { cleanup(); return; }

    const v = findVideo();
    if (v && !v._animebookAmazonAttached) attachVideoListeners(v);
    if (v) video = v;

    if (isPlayerOpen()) {
      if (!lockedTitle) getVideoTitle();
      if (!overlayEl) createOverlay();
      if (!document.getElementById("at-ap-overlay")) {
        injectOverlay();
        document.dispatchEvent(new CustomEvent("animebook-request-state"));
      }
      startOverlayObserver();
    } else if (!findVideo()) {
      cleanup();
    }

  }, 2000);

  window.addEventListener("beforeunload", flushSave);

  // Listen for global tracking toggle from bridge
  document.addEventListener("animebook-tracking-state", (e) => {
    globalTrackingEnabled = e.detail.enabled;
    const overlay = document.getElementById("at-ap-overlay");
    if (!globalTrackingEnabled) {
      if (trackingEnabled) { pauseTracking(); trackingEnabled = false; updateButtonState(); }
      if (overlay) overlay.style.visibility = "hidden";
    } else {
      if (overlay) overlay.style.visibility = "visible";
    }
  });
})();
