// disneyplus-bridge.js — Animebook Time Tracker v4.4
// Runs in ISOLATED world.

if (!window.__animebookDPBridgeLoaded) {
  window.__animebookDPBridgeLoaded = true;

  // ── Save forwarding ────────────────────────────────────────────────────────
  document.addEventListener("animebook-tracker-save", (e) => {
    const { delta, today, videoTitle, source } = e.detail;
    if (!delta || delta <= 0) return;
    chrome.storage.local.get(["trackingEnabled", "watchtime"], (data) => {
      if (data.trackingEnabled === false) return;
      const watchtime = data.watchtime || { perDay: {}, perVideo: {} };
      if (!watchtime.perDay[today]) watchtime.perDay[today] = { total: 0, videos: {} };
      watchtime.perDay[today].total += delta;
      const existing = watchtime.perDay[today].videos[videoTitle];
      if (existing && typeof existing === "object") {
        existing.seconds = (existing.seconds || 0) + delta;
      } else {
        watchtime.perDay[today].videos[videoTitle] = {
          seconds: (typeof existing === "number" ? existing : 0) + delta,
          source: source || "disneyplus"
        };
      }
      watchtime.perVideo[videoTitle] = (watchtime.perVideo[videoTitle] || 0) + delta;
      chrome.storage.local.set({ watchtime });
    });
  });

  // ── Tracking state ─────────────────────────────────────────────────────────
  function notifyTrackingState(enabled) {
    document.dispatchEvent(new CustomEvent("animebook-tracking-state", { detail: { enabled } }));
  }

  function notifyAutoHide(enabled) {
    document.dispatchEvent(new CustomEvent("animebook-autohide-state", { detail: { enabled } }));
  }

  chrome.storage.local.get(["trackingEnabled", "autoHideTrackBtn"], (data) => {
    notifyTrackingState(data.trackingEnabled !== false);
    notifyAutoHide(data.autoHideTrackBtn === true);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if ("trackingEnabled" in changes) notifyTrackingState(changes.trackingEnabled.newValue !== false);
    if ("autoHideTrackBtn" in changes) notifyAutoHide(changes.autoHideTrackBtn.newValue === true);
  });

  document.addEventListener("animebook-request-state", () => {
    chrome.storage.local.get(["trackingEnabled", "autoHideTrackBtn"], (data) => {
      notifyTrackingState(data.trackingEnabled !== false);
      notifyAutoHide(data.autoHideTrackBtn === true);
    });
  });

  // ── Position save/load ─────────────────────────────────────────────────────
  document.addEventListener("animebook-load-pos", (e) => {
    const key = "overlayPos_" + e.detail.site;
    chrome.storage.local.get([key], (data) => {
      document.dispatchEvent(new CustomEvent("animebook-overlay-pos", {
        detail: { site: e.detail.site, pos: data[key] || null }
      }));
    });
  });

  document.addEventListener("animebook-save-pos", (e) => {
    const key = "overlayPos_" + e.detail.site;
    chrome.storage.local.set({ [key]: { left: e.detail.left, top: e.detail.top } });
  });
}
