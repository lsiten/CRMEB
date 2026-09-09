import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fixtureSource } from './script-loader-fixture.mjs';

const source = await fixtureSource();
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const payload of ['external-and-inline', 'inline-only', 'raw-inline']) {
  for (const phase of ['response', 'external']) {
    for (const action of ['missing', 'clear', 'tenant', 'account', 'unchanged']) {
      test(`H5 dynamic scripts blocked: ${payload}, delayed ${phase}, ${action}`, async () => {
        const elements = [], deferred = [];
        const inline = 'globalThis.oldInlineRan = true';
        const scripts = payload === 'external-and-inline'
          ? [{ src: 'https://third-party.invalid/late.js' }, { textContent: inline }]
          : [{ textContent: inline }];
        const content = payload === 'raw-inline' ? inline : '<script>fixture</script>';
        const context = vm.createContext({
          deliverScript(options) {
            const deliver = () => options.success({ statusCode: 200, data: content });
            if (phase === 'response') deferred.push(deliver); else queueMicrotask(deliver);
          },
          DOMParser: class { parseFromString() { return { querySelectorAll: () => scripts }; } },
          document: {
            createElement: () => ({}),
            body: { appendChild(element) {
              elements.push(element);
              if (element.src) deferred.push(() => {
                vm.runInContext('globalThis.externalRan = true', context);
                element.onload();
              });
              else vm.runInContext(element.textContent, context);
            } }
          }
        });
        vm.runInContext(source, context);
        const f = context.fixture;
        if (action !== 'missing') f.injectTenantCredentials({ appid: 'fixture-a', screct_id: 'fixture-secret-a' });
        await f.launch();
        await tick();
        await f.change(action);
        for (const release of deferred) release();
        await tick();
        assert.equal(context.externalRan, undefined, 'old external code executed');
        assert.equal(context.oldInlineRan, undefined, 'old inline code executed');
        assert.equal(elements.length, 0, 'executable element was inserted');
        assert.equal(f.calls.length, 0, 'disabled loader fetched get_script');
        assert.equal(JSON.stringify([...f.storage]).includes('fixture-secret'), false);
      });
    }
  }
}
