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
