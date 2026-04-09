// background.js — Animebook Time Tracker v3.6

chrome.runtime.onInstalled.addListener(() => {
  console.log("Animebook Time Tracker installed");
});

const SESSION_KEY = "animebook_pending";

async function accumulateInSession(delta, today, videoTitle, source) {
  const data = await chrome.storage.session.get([SESSION_KEY]);
  const pending = data[SESSION_KEY] || {};

  if (!pending[today]) pending[today] = { total: 0, videos: {} };
  pending[today].total = (pending[today].total || 0) + delta;

  const existing = pending[today].videos[videoTitle];
  if (existing && typeof existing === "object") {
    existing.seconds = (existing.seconds || 0) + delta;
  } else {
    pending[today].videos[videoTitle] = {
      seconds: (typeof existing === "number" ? existing : 0) + delta,
      source: source || "youtube"
    };
  }

  await chrome.storage.session.set({ [SESSION_KEY]: pending });
  scheduleFlush();
}

let flushTimer = null;
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushSessionToLocal, 5000);
}

async function flushSessionToLocal() {
  flushTimer = null;
  const data = await chrome.storage.session.get([SESSION_KEY]);
  const pending = data[SESSION_KEY];
  if (!pending || Object.keys(pending).length === 0) return;

  await chrome.storage.session.remove([SESSION_KEY]);

  const local = await chrome.storage.local.get(["watchtime"]);
  const watchtime = local.watchtime || { perDay: {}, perVideo: {} };

  for (const [today, dayData] of Object.entries(pending)) {
    if (!watchtime.perDay[today]) watchtime.perDay[today] = { total: 0, videos: {} };
    watchtime.perDay[today].total = (watchtime.perDay[today].total || 0) + dayData.total;
    for (const [title, val] of Object.entries(dayData.videos)) {
      const secs = typeof val === "object" ? val.seconds : val;
      const source = typeof val === "object" ? val.source : "youtube";
      const existing = watchtime.perDay[today].videos[title];
      if (existing && typeof existing === "object") {
        existing.seconds = (existing.seconds || 0) + secs;
      } else {
        watchtime.perDay[today].videos[title] = {
          seconds: (typeof existing === "number" ? existing : 0) + secs,
          source
        };
      }
      watchtime.perVideo[title] = (watchtime.perVideo[title] || 0) + secs;
    }
  }

  await chrome.storage.local.set({ watchtime });
}

// ── Badge switching ───────────────────────────────────────────────────────────
function setTrackingBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: "" });
  } else {
    chrome.action.setBadgeText({ text: "off" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
  }
}

// Restore badge state on startup
chrome.storage.local.get(["trackingEnabled"], (data) => {
  setTrackingBadge(data.trackingEnabled !== false);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_TRACKING_ENABLED") {
    setTrackingBadge(msg.enabled);
    return false;
  }
  if (msg.type !== "ANIMEBOOK_SAVE_WATCHTIME") return false;
  const { delta, today, videoTitle, source } = msg;
  if (!delta || delta <= 0) return false;
  accumulateInSession(delta, today, videoTitle, source || "youtube").catch(console.error);
  return false;
});

chrome.tabs.onRemoved.addListener(() => {
  flushSessionToLocal().catch(console.error);
});

chrome.alarms.create("animebook-flush", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "animebook-flush") flushSessionToLocal().catch(console.error);
});

const injectedTabs = new Set();
chrome.tabs.onRemoved.addListener((tabId) => { injectedTabs.delete(tabId); });

// Track last injected TVer URL per tab to avoid double-injection
const tverInjectedUrls = new Map();

// ── YouTube: inject on full page load ────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url) return;
  try {
    const url = new URL(tab.url);

    // YouTube
    if (url.hostname === "www.youtube.com") {
      if (injectedTabs.has(tabId)) return;
      if (url.pathname !== "/watch" || !url.searchParams.has("v")) return;
      injectedTabs.add(tabId);
      chrome.scripting.executeScript({ target: { tabId }, files: ["youtube-bridge.js"], world: "ISOLATED" })
        .then(() => chrome.scripting.executeScript({ target: { tabId }, files: ["youtube.js"], world: "MAIN" }))
        .catch(() => { injectedTabs.delete(tabId); });
      return;
    }

    // Disney+
    if ((url.hostname === "www.disneyplus.com" || url.hostname === "disneyplus.com") &&
        url.pathname.includes("/play/")) {
      const key = "dp-" + tabId + "-" + url.pathname;
      if (injectedTabs.has(key)) return;
      injectedTabs.add(key);
      chrome.scripting.executeScript({ target: { tabId }, files: ["disneyplus-bridge.js"], world: "ISOLATED" })
        .then(() => chrome.scripting.executeScript({ target: { tabId }, files: ["disneyplus.js"], world: "MAIN" }))
        .catch(() => { injectedTabs.delete(key); });
      return;
    }

    // Amazon Prime Video — all amazon.* domains
    if (/amazon\.(com|co\.jp|co\.uk|de|fr|it|es|ca|com\.au|com\.br|com\.mx|nl|pl|se|com\.be|com\.tr)$/.test(url.hostname) &&
        url.pathname.includes("/gp/video/detail/")) {
      const key = "ap-" + tabId + "-" + url.pathname;
      if (injectedTabs.has(key)) return;
      injectedTabs.add(key);
      chrome.scripting.executeScript({ target: { tabId }, files: ["amazonprime-bridge.js"], world: "ISOLATED" })
        .then(() => chrome.scripting.executeScript({ target: { tabId }, files: ["amazonprime.js"], world: "MAIN" }))
        .catch(() => { injectedTabs.delete(key); });
      return;
    }

    injectTver(tabId, tab.url);
  } catch (e) {}
});

// ── TVer: inject on SPA navigation (pushState/replaceState) ──────────────────
function injectTver(tabId, url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "tver.jp") return;
    if (!u.pathname.startsWith("/episodes/")) return;
    const last = tverInjectedUrls.get(tabId);
    if (last === url) return;
    tverInjectedUrls.set(tabId, url);
    chrome.scripting.executeScript({ target: { tabId }, files: ["tver.js"] })
      .catch((e) => { tverInjectedUrls.delete(tabId); });
  } catch (e) {}
}

// Fires on SPA navigation within tver.jp
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  injectTver(details.tabId, details.url);
}, { url: [{ hostEquals: "tver.jp", pathPrefix: "/episodes/" }] });

// Also fire on full page load (direct URL paste)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url) return;
  injectTver(tabId, tab.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tverInjectedUrls.delete(tabId);
});
