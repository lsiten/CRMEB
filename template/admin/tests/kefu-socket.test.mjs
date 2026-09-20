import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

test('importing sockets is inert; staff consumers retain one shared connection', async () => {
  const urls = [];
  let addressCalls = 0;
  const context = vm.createContext({
    Promise, setInterval: () => 1, clearInterval() {},
    WebSocket: class {
      constructor(url) { urls.push(url); queueMicrotask(() => this.onopen()); }
      send() {}
    },
  });
  const source = await readFile(new URL('../src/libs/socket.js', import.meta.url), 'utf8');
  const mod = new vm.SourceTextModule(source, { context });
  const values = {
    wss: () => '', getCookies: () => '', setCookies() {},
    getWorkermanUrl: async () => { addressCalls++; return { data: { admin: 'ws://test/admin', chat: 'ws://test/chat' } }; },
    default: class { $emit() {} },
  };
  await mod.link(() => new vm.SyntheticModule(Object.keys(values), function () {
    Object.entries(values).forEach(([key, value]) => this.setExport(key, value));
  }, { context }));
  await mod.evaluate();
  assert.equal(addressCalls, 0);
  assert.equal(urls.length, 0);
  const [first, second] = await Promise.all([mod.namespace.Socket, mod.namespace.Socket]);
  assert.equal(first, second);
  assert.equal(addressCalls, 1);
  assert.deepEqual(urls, ['ws://test/chat']);
  await mod.namespace.adminSocket;
  assert.equal(addressCalls, 2);
  assert.deepEqual(urls, ['ws://test/chat', 'ws://test/admin']);
});
