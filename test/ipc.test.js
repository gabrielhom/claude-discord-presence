const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const os = require('os');
const path = require('path');
const { Discord, frame } = require('../src/ipc');

test('handshake + SET_ACTIVITY over a fake Discord socket', async () => {
  const sockPath = process.platform === 'win32' ? '\\\\?\\pipe\\cdp-test-' + process.pid : path.join(os.tmpdir(), `cdp-test-${process.pid}`);
  const got = [];
  const server = net.createServer((c) => c.on('data', (buf) => {
    let off = 0;
    while (off < buf.length) {
      const op = buf.readInt32LE(off), len = buf.readInt32LE(off + 4);
      got.push({ op, body: JSON.parse(buf.slice(off + 8, off + 8 + len)) });
      off += 8 + len;
    }
    if (got.length === 1) c.write(frame(1, { cmd: 'DISPATCH', evt: 'READY' }));
  }));
  await new Promise((r) => server.listen(sockPath, r));
  const d = new Discord('123');
  await d.connect(['/nonexistent/discord-ipc-0', sockPath]); // skips the bad path
  assert.ok(d.setActivity({ details: 'x', state: 'y' }));
  await new Promise((r) => setTimeout(r, 100));
  assert.deepStrictEqual(got[0], { op: 0, body: { v: 1, client_id: '123' } });
  assert.strictEqual(got[1].op, 1);
  assert.strictEqual(got[1].body.cmd, 'SET_ACTIVITY');
  assert.deepStrictEqual(got[1].body.args.activity, { details: 'x', state: 'y' });
  d.close(); server.close();
});

test('no socket → rejects', async () => {
  await assert.rejects(new Discord('1').connect(['/nonexistent/a', '/nonexistent/b']));
});
