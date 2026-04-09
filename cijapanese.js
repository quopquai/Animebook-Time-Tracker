// cijapanese.js — Animebook Time Tracker v3.6

(function () {
  if (window.__animebookTrackerCijapanese) return;
  window.__animebookTrackerCijapanese = true;

  let currentVideo = null;
  let startTime    = null;
  let intervalId   = null;

  function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function getVideoTitle() {
    const t = document.title.trim();
    return t.replace(/\s*\|.*$/, "").trim() || "cijapanese video";
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
          source: "cijapanese"
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
    if (currentVideo && startTime) saveWatchtime((Date.now() - startTime) / 1000);
    currentVideo = null; startTime = null;
  }

  function trackVideo(video) {
    if (currentVideo === video) return;
    stopTracking();
    currentVideo = video;
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
  }

  function findAndTrack() {
    const videos = Array.from(document.querySelectorAll("video"));
    const main = videos.find(v => isMainVideo(v));
    if (main && main !== currentVideo) trackVideo(main);
  }

  const observer = new MutationObserver(findAndTrack);
  observer.observe(document.body, { childList: true, subtree: true });
  findAndTrack();
  window.addEventListener("beforeunload", stopTracking);
})();
