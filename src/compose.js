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
module.exports = { compose };
