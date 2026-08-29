// Single background process: watches every session state file in <stateDir>, mirrors the
// most recently active one to Discord. Exits when no sessions remain.
// usage: node daemon.js <stateDir> <clientId>
const fs = require('fs');
const path = require('path');
const { Discord } = require('./ipc');
const { compose } = require('./compose');

const [stateDir, clientId] = process.argv.slice(2);
const ORPHAN_MS = 8 * 3600e3; // ponytail: hooks can't tell us Claude's pid across WSL→Windows, so stale-file timeout it is
const POLL_MS = 2000, RECONNECT_MS = 15000;
const rpc = new Discord(clientId);
let last = '';

function sessions() {
  const out = [];
  for (const f of fs.readdirSync(stateDir)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(stateDir, f);
    let st = null;
    try { st = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    if (!st || Date.now() - (st.updated || 0) > ORPHAN_MS) { try { fs.unlinkSync(p); } catch {} continue; }
    out.push(st);
  }
  return out;
}

async function connect() {
  try { await rpc.connect(); last = ''; rpc.sock.on('close', () => { rpc.sock = null; setTimeout(connect, RECONNECT_MS); }); }
  catch { setTimeout(connect, RECONNECT_MS); }
}

function tick() {
  let activity = null;
  try { activity = compose(sessions()); } catch {}
  if (!activity) { rpc.close(); try { fs.unlinkSync(path.join(stateDir, 'daemon.pid')); } catch {} process.exit(0); }
  const key = JSON.stringify(activity);
  if (key !== last && rpc.setActivity(activity)) last = key;
}

connect();
setInterval(tick, POLL_MS);
