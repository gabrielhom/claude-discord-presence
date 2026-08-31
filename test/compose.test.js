const test = require('node:test');
const assert = require('node:assert');
const { compose } = require('../src/compose');

test('single session', () => {
  const a = compose([{ details: '📁 a', state: 'x', start: 10, updated: 20 }]);
  assert.deepStrictEqual(a, { details: '📁 a', state: 'x', timestamps: { start: 10 } });
});
test('most recently active wins, counts others, earliest start', () => {
  const a = compose([
    { details: '📁 old', state: 'o', start: 5, updated: 10 },
    { details: '📁 new', state: 'n', start: 50, updated: 99, largeImage: 'img' },
    { details: '📁 mid', state: 'm', start: 20, updated: 30 },
  ]);
  assert.strictEqual(a.details, '📁 new · +2 sessions');
  assert.strictEqual(a.state, 'n');
  assert.strictEqual(a.timestamps.start, 5);
  assert.deepStrictEqual(a.assets, { large_image: 'img', large_text: 'Claude Code' });
});
test('no sessions → null', () => assert.strictEqual(compose([]), null));

test('idle: swaps to idleImage only after IDLE_MS of no updates', () => {
  const s = { details: '📁 a', state: '💤 Waiting', start: 0, updated: 1000, largeImage: 'bell', idleImage: 'sleep' };
  assert.strictEqual(compose([s], 1000 + 60e3).assets.large_image, 'bell');
  assert.strictEqual(compose([s], 1000 + 6 * 60e3).assets.large_image, 'sleep');
  const working = { ...s, state: '⚙️ build', idleImage: null };
  assert.strictEqual(compose([working], 1000 + 6 * 60e3).assets.large_image, 'bell'); // no idleImage → never swaps
});

const { toolLabel } = require('../src/compose');

test('toolLabel never leaks commands, patterns or full URLs', () => {
  assert.equal(toolLabel('Edit', { file_path: '/home/me/secret-project/src/server.ts' }), 'server.ts');
  assert.equal(toolLabel('Bash', { command: 'curl -H "Authorization: Bearer sk-123"', description: 'Fetch   API status' }), 'Fetch API status');
  assert.equal(toolLabel('Bash', { command: 'export AWS_SECRET=abc' }), '');
  assert.equal(toolLabel('Grep', { pattern: 'password' }), '');
  assert.equal(toolLabel('WebFetch', { url: 'https://api.example.com/v1/users?token=abc' }), 'api.example.com');
  assert.equal(toolLabel('WebFetch', { url: 'not a url' }), '');
  assert.equal(toolLabel('Agent', { prompt: 'look at db creds', description: 'Explore repo' }), 'Explore repo');
});

const { prettyModel, fmtTok } = require('../src/compose');

test('prettyModel', () => {
  assert.equal(prettyModel('claude-opus-4-1-20250805'), 'Opus 4.1');
  assert.equal(prettyModel('claude-fable-5'), 'Fable 5');
  assert.equal(prettyModel('claude-3-5-sonnet-20241022'), 'Sonnet 3.5');
});
test('fmtTok', () => {
  assert.equal(fmtTok(950), '950');
  assert.equal(fmtTok(45200), '45k');
  assert.equal(fmtTok(1234567), '1.2M');
});
