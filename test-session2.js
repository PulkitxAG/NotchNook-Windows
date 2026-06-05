const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');
const session = SMTCMonitor.getCurrentMediaSession();
if (session) {
  console.log(session.media);
  console.log(session.playback);
} else {
  console.log('No active session.');
}
