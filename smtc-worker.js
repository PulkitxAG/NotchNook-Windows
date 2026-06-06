const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');

let lastTitle = null;
let lastStatus = null;
let lastAppId = null;
let intervalId = null;

function pollMedia() {
  try {
    const session = SMTCMonitor.getCurrentMediaSession();
    if (session && session.media) {
      const currentTitle = session.media.title;
      const currentStatus = session.playback ? session.playback.playbackStatus : 0;
      const currentAppId = session.sourceAppId;

      if (currentTitle === lastTitle && currentStatus === lastStatus && currentAppId === lastAppId) {
        return;
      }

      lastTitle = currentTitle;
      lastStatus = currentStatus;
      lastAppId = currentAppId;

      process.send({
        type: 'media-update',
        media: {
          title: currentTitle,
          artist: session.media.artist || currentAppId || 'Unknown Artist',
          album: session.media.albumTitle || 'System Media',
          status: currentStatus,
          thumbnail: session.media.thumbnail ? session.media.thumbnail.toString('base64') : null,
          appId: currentAppId
        }
      });
    } else {
      if (lastTitle !== null) {
        lastTitle = null;
        lastStatus = null;
        lastAppId = null;
        process.send({ type: 'media-update', media: null });
      }
    }
  } catch (e) {}
}

function startPolling() {
  if (intervalId) return;
  pollMedia();
  intervalId = setInterval(pollMedia, 3000);
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Start immediately
startPolling();

// Listen for sleep/wake hooks from OS
process.on('message', (msg) => {
  if (msg === 'suspend') stopPolling();
  else if (msg === 'resume') startPolling();
});
