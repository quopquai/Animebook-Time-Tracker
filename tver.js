// tver.js — Animebook Time Tracker v3.9
// Injected by background.js on tver.jp/episodes/* via webNavigation.

(function () {
  // Teardown any previous instance (SPA navigation)
  if (window.__animebookTrackerTverStop) {
    window.__animebookTrackerTverStop();
  }

  if (!location.pathname.startsWith("/episodes/")) return;

  let currentVideo = null;
  let startTime    = null;
  let intervalId   = null;
  let lockedTitle  = null;
  let findDebounce = null;

  function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function buildTitle() {
    // Read series and episode titles directly from the episode page DOM
    const seriesEl  = document.querySelector("h2.EpisodeDescription_seriesTitle__Z2k3j");
    const episodeEl = document.querySelector("h1.EpisodeDescription_title__ZuCXz");
    const series  = seriesEl?.textContent?.trim();
    const episode = episodeEl?.textContent?.trim();
    if (series && episode) return `${series} — ${episode}`;
    if (episode) return episode;
    if (series) return series;
    // Fallback to page title
    const raw = document.title || "";
    return raw.replace(/\s*\|.*$/, "").trim() || "TVer video";
  }

  function getVideoTitle() {
    if (!lockedTitle) lockedTitle = buildTitle();
    return lockedTitle || "TVer video";
  }

  function isMainVideo(video) {
    if (video.muted) return false;
    if (video.duration && video.duration < 60) return false;
    return true;
  }

  function saveWatchtime(delta) {
    if (delta <= 0) return;
    const today      = getLocalDateString();
    const videoTitle = getVideoTitle();
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
          source: "tver"
        };
      }
      watchtime.perVideo[videoTitle] = (watchtime.perVideo[videoTitle] || 0) + delta;
      chrome.storage.local.set({ watchtime });
    });
  }

  function startInterval(video) {
    if (intervalId) return;
    intervalId = setInterval(() => {
      if (!video.paused && !video.ended && startTime) {
        const delta = (Date.now() - startTime) / 1000;
        saveWatchtime(delta);
        startTime = Date.now();
      }
    }, 1000);
  }

  function stopTracking() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (findDebounce) { clearTimeout(findDebounce); findDebounce = null; }
    if (currentVideo && startTime) saveWatchtime((Date.now() - startTime) / 1000);
    currentVideo = null; startTime = null; lockedTitle = null;
  }

  window.__animebookTrackerTverStop = stopTracking;

  function trackVideo(video) {
    if (currentVideo === video) return;
    stopTracking();
    currentVideo = video;
    window.__animebookTrackerTverStop = stopTracking;

    if (!video.paused && !video.ended) { startTime = Date.now(); startInterval(video); }

    video.addEventListener("play", () => {
      if (!isMainVideo(video)) return;
      startTime = Date.now(); startInterval(video);
    });
    video.addEventListener("pause", () => {
      if (startTime) { saveWatchtime((Date.now()-startTime)/1000); startTime = null; }
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    });
    video.addEventListener("ended", () => {
      if (startTime) { saveWatchtime((Date.now()-startTime)/1000); startTime = null; }
      stopTracking();
    });
    video.addEventListener("durationchange", () => {
      if (!isMainVideo(video) && startTime) {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        startTime = null; currentVideo = null;
      }
    });
  }

  function findAndTrack() {
    const videos = Array.from(document.querySelectorAll("video"));
    const main   = videos.find(v => isMainVideo(v));
    if (main && main !== currentVideo) trackVideo(main);
    else if (!main && currentVideo) stopTracking();
  }

  const observer = new MutationObserver(() => {
    if (findDebounce) return;
    findDebounce = setTimeout(() => { findDebounce = null; findAndTrack(); }, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  findAndTrack();

  window.addEventListener("beforeunload", stopTracking);
})();
