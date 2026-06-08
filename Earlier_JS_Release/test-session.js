const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');
const session = SMTCMonitor.getCurrentMediaSession();
if (session) {
  console.log(Object.getOwnPropertyNames(session));
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(session)));
} else {
  console.log('No active session. Please start music to inspect.');
}
