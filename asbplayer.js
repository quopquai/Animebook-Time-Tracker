// asbplayer.js — Animebook Time Tracker v3.6

(function () {
  if (window.__animebookTrackerAsbplayer) return;
  window.__animebookTrackerAsbplayer = true;

  let currentVideo = null;
  let startTime    = null;
  let intervalId   = null;

  function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function getVideoTitle() {
    const el = document.querySelector("h6.MuiTypography-noWrap");
    if (el) {
      const t = el.textContent?.trim();
      if (t) return t;
    }
    return "asbplayer video";
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
          source: "asbplayer"
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
    video.addEventListener("play",  () => { startTime = Date.now(); startInterval(video); });
    video.addEventListener("pause", () => {
      if (startTime) { saveWatchtime((Date.now()-startTime)/1000); startTime = null; }
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    });
    video.addEventListener("ended", () => {
      if (startTime) { saveWatchtime((Date.now()-startTime)/1000); startTime = null; }
      stopTracking();
    });
  }

  function findVideo() {
    const v = document.querySelector("video");
    if (v) return v;
    for (const frame of document.querySelectorAll("iframe")) {
      try {
        const fv = frame.contentDocument?.querySelector("video");
        if (fv) return fv;
      } catch (e) {}
    }
    return null;
  }

  setInterval(() => {
    const v = findVideo();
    if (v && v !== currentVideo) trackVideo(v);
    else if (!v && currentVideo) stopTracking();
  }, 1000);

  window.addEventListener("beforeunload", stopTracking);
})();
