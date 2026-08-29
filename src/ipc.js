// Minimal Discord IPC client (handshake + SET_ACTIVITY). No deps.
const net = require('net');
const path = require('path');

function candidates() {
  if (process.platform === 'win32') return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  const dirs = [process.env.XDG_RUNTIME_DIR, process.env.TMPDIR, process.env.TMP, process.env.TEMP, '/tmp'].filter(Boolean);
  const subs = ['', 'app/com.discordapp.Discord', 'snap.discord', 'snap.discord-canary']; // flatpak / snap
  const out = [];
  for (const d of dirs) for (const s of subs) for (let i = 0; i < 10; i++) out.push(path.join(d, s, `discord-ipc-${i}`));
  return out;
}

function frame(op, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const head = Buffer.alloc(8);
  head.writeInt32LE(op, 0);
  head.writeInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

function tryConnect(p) {
  return new Promise((resolve, reject) => {
    const s = net.connect(p);
    s.once('connect', () => resolve(s));
    s.once('error', reject);
  });
}

class Discord {
  constructor(clientId) { this.clientId = clientId; this.sock = null; }

  // Resolves once Discord answered the handshake (READY). Rejects if no socket found.
  async connect(paths = candidates()) {
    for (const p of paths) {
      let s;
      try { s = await tryConnect(p); } catch { continue; }
      await new Promise((resolve, reject) => {
        s.once('data', resolve);
        s.once('error', reject);
        s.once('close', () => reject(new Error('closed')));
        s.write(frame(0, { v: 1, client_id: this.clientId }));
      });
      s.on('error', () => {});
      s.on('data', () => {}); // drain replies
      this.sock = s;
      return s;
    }
    throw new Error('Discord IPC socket not found');
  }

  setActivity(activity) {
    if (!this.sock) return false;
    this.sock.write(frame(1, { cmd: 'SET_ACTIVITY', nonce: String(Date.now()), args: { pid: process.pid, activity } }));
    return true;
  }

  close() { try { this.sock?.end(); } catch {} this.sock = null; }
}

module.exports = { Discord, frame, candidates };
