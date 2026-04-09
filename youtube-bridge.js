// youtube-bridge.js — Animebook Tracker v4.4
// Runs in ISOLATED world. Bridges youtube.js (MAIN) → background.js.

if (!window.__animebookBridgeLoaded) {
  window.__animebookBridgeLoaded = true;

  // ── Save forwarding ────────────────────────────────────────────────────────
  document.addEventListener("animebook-tracker-save", (e) => {
    const { delta, today, videoTitle, source } = e.detail;
    if (!delta || delta <= 0) return;
    chrome.storage.local.get(["trackingEnabled"], (data) => {
      if (data.trackingEnabled === false) return;
      chrome.runtime.sendMessage({
        type: "ANIMEBOOK_SAVE_WATCHTIME",
        delta, today, videoTitle,
        source: source || "youtube"
      }).catch(() => {});
    });
  });

  // ── Tracking state ─────────────────────────────────────────────────────────
  function notifyTrackingState(enabled) {
    document.dispatchEvent(new CustomEvent("animebook-tracking-state", { detail: { enabled } }));
  }

  chrome.storage.local.get(["trackingEnabled"], (data) => {
    notifyTrackingState(data.trackingEnabled !== false);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if ("trackingEnabled" in changes) notifyTrackingState(changes.trackingEnabled.newValue !== false);
  });

  // Re-send all state when MAIN world requests it (after button injection)
  document.addEventListener("animebook-request-state", () => {
    chrome.storage.local.get(["trackingEnabled", "autoHideTrackBtn"], (data) => {
      notifyTrackingState(data.trackingEnabled !== false);
      notifyAutoHide(data.autoHideTrackBtn === true);
    });
  });

  // ── Auto-hide state ────────────────────────────────────────────────────────
  function notifyAutoHide(enabled) {
    document.dispatchEvent(new CustomEvent("animebook-autohide-state", { detail: { enabled } }));
  }

  chrome.storage.local.get(["autoHideTrackBtn"], (data) => {
    notifyAutoHide(data.autoHideTrackBtn === true);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if ("autoHideTrackBtn" in changes) notifyAutoHide(changes.autoHideTrackBtn.newValue === true);
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
