// content.js — Animebook Time Tracker
let currentVideo = null;
let startTime = null;
let watchedSeconds = 0;
let intervalId = null;

function getVideoTitle() {
  let title;
  if (window.vm && window.vm.videoFileName) {
    title = window.vm.videoFileName;
  } else {
    title = (document.title || "Animebook Video").replace(/\s*\|\s*Animebook$/, "");
  }
  // Strip common video file extensions so titles match asbplayer entries
  return title.replace(/\.(mp4|mkv|avi|webm|mov|flv|m4v)$/i, "").trim();
}

function saveWatchtime(delta) {
  if (delta <= 0) return;
  chrome.storage.local.get(["trackingEnabled", "watchtime"], (data) => {
    if (data.trackingEnabled === false) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const videoTitle = getVideoTitle();
    const watchtime = data.watchtime || { perDay: {}, perVideo: {} };
    if (!watchtime.perDay[today]) watchtime.perDay[today] = { total: 0, videos: {} };
    watchtime.perDay[today].total += delta;
    const existing = watchtime.perDay[today].videos[videoTitle];
    if (existing && typeof existing === "object") {
      existing.seconds = (existing.seconds || 0) + delta;
    } else {
      watchtime.perDay[today].videos[videoTitle] = {
        seconds: (typeof existing === "number" ? existing : 0) + delta,
        source: "animebook"
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

function stopTrackingVideo() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (currentVideo && startTime) saveWatchtime((Date.now() - startTime) / 1000);
  currentVideo = null; startTime = null; watchedSeconds = 0;
}

function trackVideo(video) {
  if (currentVideo === video) return;
  stopTrackingVideo();
  currentVideo = video;
  watchedSeconds = 0;
  if (!video.paused && !video.ended) { startTime = Date.now(); startInterval(video); }
  video.addEventListener("play", () => { startTime = Date.now(); startInterval(video); });
  video.addEventListener("pause", () => {
    if (startTime) { saveWatchtime((Date.now()-startTime)/1000); startTime = null; }
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  });
  video.addEventListener("ended", () => {
    if (startTime) { saveWatchtime((Date.now()-startTime)/1000); startTime = null; }
    stopTrackingVideo();
  });
}

function watchForVideo() {
  const observer = new MutationObserver(() => {
    const video = document.querySelector("#ab-video-element");
    if (video) trackVideo(video);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const existingVideo = document.querySelector("#ab-video-element");
  if (existingVideo) trackVideo(existingVideo);
}

watchForVideo();
window.addEventListener("beforeunload", () => { stopTrackingVideo(); });
