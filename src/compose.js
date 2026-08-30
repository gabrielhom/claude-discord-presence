const path = require('node:path');

// Pure: turn all live session states into one Discord activity (most recently active session wins).
function compose(states) {
  const live = states.filter((s) => s && s.details);
  if (!live.length) return null;
  const cur = live.reduce((a, b) => (b.updated > a.updated ? b : a));
  const others = live.length - 1;
  const activity = {
    details: cur.details + (others ? ` · +${others} session${others > 1 ? 's' : ''}` : ''),
    state: cur.state,
    timestamps: { start: Math.min(...live.map((s) => s.start)) },
  };
  if (cur.largeImage) activity.assets = { large_image: cur.largeImage, large_text: 'Claude Code' };
  return activity;
}

// Privacy: never surface raw commands, search patterns or full URLs — they can carry secrets.
function toolLabel(tool, ti) {
  if (ti.file_path || ti.notebook_path) return path.basename(ti.file_path || ti.notebook_path);
  if (ti.url) { try { return new URL(ti.url).hostname; } catch { return ''; } }
  if (tool === 'Bash' || tool === 'Agent' || tool === 'Task') return String(ti.description || '').replace(/\s+/g, ' ').slice(0, 60);
  return '';
}
// "claude-opus-4-1-20250805" → "Opus 4.1"
function prettyModel(id) {
  const parts = String(id).replace(/^claude-/, '').replace(/-\d{8}$/, '').split('-');
  const name = parts.filter((p) => isNaN(p)).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
  return `${name} ${parts.filter((p) => !isNaN(p)).join('.')}`.trim();
}

const fmtTok = (t) => (t >= 1e6 ? `${(t / 1e6).toFixed(1)}M` : t >= 1000 ? `${Math.round(t / 1000)}k` : String(t));

module.exports = { compose, toolLabel, prettyModel, fmtTok };
