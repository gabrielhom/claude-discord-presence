#!/usr/bin/env node
// claude-discord-presence: setup | uninstall | status | hook (called by Claude Code hooks)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { toolLabel, prettyModel, fmtTok } = require('../src/compose');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const CONFIG = path.join(CLAUDE_DIR, 'claude-discord-presence.json');
const STATE_DIR = path.join(os.tmpdir(), 'claude-discord-presence');
const DAEMON = path.join(__dirname, '..', 'src', 'daemon.js');
const MARK = 'claude-discord-presence'; // identifies our hooks in settings.json
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop', 'SessionEnd'];
// Default Discord application ("Vibe Coding" — Discord blocks "Claude" in app names).
// Set "clientId" in ~/.claude/claude-discord-presence.json (or CLAUDE_PRESENCE_CLIENT_ID) for your own app name/icon.
const DEFAULT_CLIENT_ID = '1543326727135305778';

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
// Parallel hooks race on the same state file; writeFileSync isn't atomic across processes (#5). Rename is.
const writeAtomic = (f, data) => { const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, data, { mode: 0o600 }); fs.renameSync(t, f); };
const cfg = () => ({ showPrompt: false, showProject: true, largeImage: '', ...readJson(CONFIG, {}) }); // no largeImage → Discord shows the app icon
const clientId = () => process.env.CLAUDE_PRESENCE_CLIENT_ID || cfg().clientId || DEFAULT_CLIENT_ID;
const stateFile = (sid) => path.join(STATE_DIR, `${sid}.json`);
const PID_FILE = path.join(STATE_DIR, 'daemon.pid');
const daemonPid = () => parseInt(readText(PID_FILE), 10) || 0;
const alive = (pid) => { try { return pid > 0 && process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; } };
const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, ...opts }).trim();

// --- WSL: Discord lives on Windows behind a named pipe; run the daemon with Windows node.exe ---
const isWSL = () => process.platform === 'linux' && /microsoft/i.test(readText('/proc/version'));
const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
function windowsNode() {
  try { return sh('which node.exe'); } catch {}
  for (const p of ['/mnt/c/Program Files/nodejs/node.exe', '/mnt/c/nvm4w/nodejs/node.exe']) if (fs.existsSync(p)) return p;
  return null;
}
const toWin = (p) => sh(`wslpath -w '${p}'`);

function ensureDaemon() {
  if (alive(daemonPid())) return; // ponytail: tiny race if the daemon is exiting right now; next SessionStart heals it
  let bin = process.execPath, args = [DAEMON, STATE_DIR, clientId()];
  if (isWSL()) {
    const wn = windowsNode();
    if (!wn) { fs.appendFileSync(path.join(STATE_DIR, 'error.log'), 'WSL detected but node.exe not found on Windows\n', { mode: 0o600 }); return; }
    bin = wn; args = [toWin(DAEMON), toWin(STATE_DIR), clientId()];
  }
  const child = spawn(bin, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid), { mode: 0o600 });
}

// --- hook handling ---
const TOOL_ICON = { Edit: '✏️', Write: '✏️', MultiEdit: '✏️', NotebookEdit: '✏️', Read: '👀', Bash: '⚙️', Grep: '🔍', Glob: '🔍', WebFetch: '🌐', WebSearch: '🌐', Agent: '🤖', Task: '🤖' };
// Animated large image per status — Discord accepts external https URLs in large_image and animates GIFs.
const GIF = (n) => `https://raw.githubusercontent.com/gabrielhom/claude-discord-presence/main/assets/clawd-${n}.gif`;
const STATUS_GIF = { prompt: GIF('working-typing'), tool: GIF('working-building'), wait: GIF('notification'), idle: GIF('sleeping') };
const img = (status) => cfg().largeImage || STATUS_GIF[status]; // config largeImage overrides everything

function updateState(sid, patch) {
  const f = stateFile(sid);
  const st = readJson(f, null);
  if (!st) return;
  if (typeof patch === 'function') patch = patch(st);
  writeAtomic(f, JSON.stringify({ ...st, ...patch, updated: Date.now() }));
}

// Model + total tokens from the session transcript (JSONL, one usage block per assistant message).
// ponytail: full re-read on every Stop; fine for a few MB once per response — stream it if transcripts ever hurt
function transcriptStats(tp) {
  let model = '', tok = 0;
  try {
    for (const line of fs.readFileSync(tp, 'utf8').split('\n')) {
      if (!line.includes('"usage"')) continue;
      let u; try { u = JSON.parse(line).message; } catch { continue; }
      if (!u || !u.usage) continue;
      if (u.model) model = u.model;
      tok += (u.usage.input_tokens || 0) + (u.usage.output_tokens || 0);
    }
  } catch {}
  return { model, tok };
}

function hook(input) {
  const sid = input.session_id;
  if (!sid) return;
  const ev = input.hook_event_name;
  if (ev === 'SessionStart') {
    fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(STATE_DIR, 0o700); } catch {} // dir may predate 0.3.1
    const cwd = input.cwd || process.cwd();
    let project = path.basename(cwd), branch = '';
    try { project = path.basename(sh('git rev-parse --show-toplevel', { cwd })); branch = sh('git rev-parse --abbrev-ref HEAD', { cwd }); } catch {}
    if (cwd === os.homedir()) project = '~';
    if (!cfg().showProject) { project = 'a project'; branch = ''; }
    const prev = readJson(stateFile(sid), null); // resume/clear/compact re-fire → keep start time
    const st = { ...prev, start: prev?.start || Date.now(), updated: Date.now(), details: `📁 ${project}${branch ? ` (${branch})` : ''}`, state: '🚀 Starting session', largeImage: img('prompt') };
    writeAtomic(stateFile(sid), JSON.stringify(st));
    ensureDaemon();
  } else if (ev === 'UserPromptSubmit') {
    updateState(sid, (st) => ({ state: cfg().showPrompt ? `💬 ${String(input.prompt || '').replace(/\s+/g, ' ').slice(0, 110)}` : '💬 Prompting', largeImage: img('prompt'), idleImage: null, prompts: (st.prompts || 0) + 1 }));
  } else if (ev === 'PreToolUse') {
    const icon = TOOL_ICON[input.tool_name] || '🔧';
    const ti = input.tool_input || {};
    updateState(sid, { state: `${icon} ${toolLabel(input.tool_name, ti)}`.trim(), largeImage: img('tool'), idleImage: null });
  } else if (ev === 'Stop') {
    updateState(sid, (st) => {
      const { model, tok } = transcriptStats(input.transcript_path);
      const bits = [model && prettyModel(model), st.prompts && `${st.prompts} prompt${st.prompts > 1 ? 's' : ''}`, tok && `${fmtTok(tok)} tok`].filter(Boolean);
      return { state: `💤 ${bits.join(' · ') || 'Waiting for input'}`, largeImage: img('wait'), idleImage: img('idle') }; // daemon swaps to idleImage after IDLE_MS
    });
  } else if (ev === 'SessionEnd') {
    try { fs.unlinkSync(stateFile(sid)); } catch {} // daemon exits by itself once no sessions remain
  }
}

// --- setup / uninstall / status ---
function hookCmd() { return `"${process.execPath}" "${path.resolve(__filename)}" hook`; }

function setup() {
  const s = readJson(SETTINGS, {});
  s.hooks = s.hooks || {};
  for (const ev of EVENTS) {
    s.hooks[ev] = (s.hooks[ev] || []).filter((g) => !JSON.stringify(g).includes(MARK));
    s.hooks[ev].push({ hooks: [{ type: 'command', command: hookCmd() }] });
  }
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
  console.log(`✔ hooks installed in ${SETTINGS}`);
  console.log(`  client id: ${clientId()}${isWSL() ? `\n  WSL detected → daemon will run with ${windowsNode() || 'node.exe (NOT FOUND — install Node on Windows)'}` : ''}`);
  console.log('  Start a new `claude` session and check your Discord profile.');
}

function uninstall() {
  const s = readJson(SETTINGS, {});
  for (const ev of Object.keys(s.hooks || {})) {
    s.hooks[ev] = s.hooks[ev].filter((g) => !JSON.stringify(g).includes(MARK));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
  try { process.kill(daemonPid()); } catch {}
  fs.rmSync(STATE_DIR, { recursive: true, force: true });
  console.log('✔ hooks removed, daemon stopped');
}

function status() {
  const installed = JSON.stringify(readJson(SETTINGS, {}).hooks || {}).includes(MARK);
  const plugin = !!process.env.CLAUDE_PLUGIN_ROOT || fs.existsSync(path.join(CLAUDE_DIR, 'plugins', 'cache')) && JSON.stringify(readJson(path.join(CLAUDE_DIR, 'settings.json'), {}).enabledPlugins || {}).includes(MARK);
  console.log(`hooks: ${installed ? 'settings.json' : plugin ? 'plugin' : 'not installed'}   daemon: ${alive(daemonPid()) ? 'running' : 'stopped'}   client id: ${clientId()}   wsl: ${isWSL()}`);
  const files = fs.existsSync(STATE_DIR) ? fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.json')) : [];
  if (!files.length) console.log('no active sessions');
  for (const f of files) {
    const st = readJson(path.join(STATE_DIR, f), {});
    console.log(`${f.slice(0, 8)}  ${st.details}  ${st.state}`);
  }
}

const [cmd] = process.argv.slice(2);
if (cmd === 'hook') {
  let raw = '';
  process.stdin.setEncoding('utf8').on('data', (c) => (raw += c)).on('end', () => {
    try { hook(JSON.parse(raw)); } catch (e) { try { fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 }); fs.appendFileSync(path.join(STATE_DIR, 'error.log'), `${new Date().toISOString()} ${e.stack}\n`, { mode: 0o600 }); } catch {} }
    process.exit(0); // never break Claude Code
  });
} else if (cmd === 'setup') setup();
else if (cmd === 'uninstall') uninstall();
else if (cmd === 'status') status();
else console.log('usage: claude-discord-presence <setup|uninstall|status>');
