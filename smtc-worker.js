const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');

setInterval(() => {
  try {
    const session = SMTCMonitor.getCurrentMediaSession();
    if (session && session.media) {
      process.send({
        type: 'media-update',
        media: {
          title: session.media.title,
          artist: session.media.artist || session.sourceAppId || 'Unknown Artist',
          album: session.media.albumTitle || 'System Media',
          status: session.playback ? session.playback.playbackStatus : 0,
          thumbnail: session.media.thumbnail ? session.media.thumbnail.toString('base64') : null,
          appId: session.sourceAppId
        }
      });
    } else {
      process.send({ type: 'media-update', media: null });
    }
  } catch (e) {}
}, 500);
