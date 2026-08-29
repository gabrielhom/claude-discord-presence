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
module.exports = { compose, toolLabel };
