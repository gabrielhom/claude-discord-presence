// Background process: watches the session state file and mirrors it to Discord.
// usage: node daemon.js <stateFile> <clientId>
// Exits when the state file disappears (SessionEnd) or goes stale (orphan).
const fs = require('fs');
const { Discord } = require('./ipc');

const [stateFile, clientId] = process.argv.slice(2);
const ORPHAN_MS = 8 * 3600e3; // ponytail: hooks can't tell us Claude's pid across WSL→Windows, so stale-file timeout it is
const POLL_MS = 2000, RECONNECT_MS = 15000;
const rpc = new Discord(clientId);
let last = '';

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; }
}

async function connect() {
  try { await rpc.connect(); last = ''; rpc.sock.on('close', () => { rpc.sock = null; setTimeout(connect, RECONNECT_MS); }); }
  catch { setTimeout(connect, RECONNECT_MS); }
}

function tick() {
  const st = readState();
  if (!st || Date.now() - (st.updated || 0) > ORPHAN_MS) { rpc.close(); process.exit(0); }
  const activity = {
    details: st.details, state: st.state,
    timestamps: { start: st.start },
    ...(st.largeImage ? { assets: { large_image: st.largeImage, large_text: 'Claude Code' } } : {}),
  };
  const key = JSON.stringify(activity);
  if (key !== last && rpc.setActivity(activity)) last = key;
}

connect();
setInterval(tick, POLL_MS);
