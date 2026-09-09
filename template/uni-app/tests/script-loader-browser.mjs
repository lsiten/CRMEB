import { createServer } from 'node:http';
import { fixtureSource } from './script-loader-fixture.mjs';

// Isolated receiver: synthetic credentials only; no CRMEB service or database.
const cases = new Map();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('case') || 'default';
  if (!cases.has(id)) cases.set(id, { requests: [], pending: [], waiters: [] });
  const state = cases.get(id);
  const send = (body, type = 'text/plain') => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };
  if (url.pathname === '/api/get_script' || url.pathname === '/late.js') {
    state.requests.push({ path: url.pathname, appid: !!req.headers.appid, secret: !!req.headers.screct_id,
      urlLeak: /fixture-secret/.test(req.url) });
    const inline = '<script>globalThis.oldInlineRan = true;</script>';
    const payload = url.searchParams.get('payload');
    const external = `<script src="http://localhost:${server.address().port}/late.js?case=${id}"></script>`;
    const content = url.pathname === '/late.js' ? 'globalThis.externalRan = true;' :
      payload === 'raw-inline' ? 'globalThis.oldInlineRan = true;' :
      payload === 'inline-only' ? inline : external + inline;
    const deliver = () => send(content, 'text/javascript');
    if (url.pathname === '/late.js' || url.searchParams.get('phase') === 'response') {
      state.pending.push(deliver);
      for (const waiter of state.waiters.splice(0)) waiter();
    } else deliver();
  } else if (url.pathname === '/barrier') {
    if (state.pending.length) send('ready');
    else {
      const timer = setTimeout(() => { res.writeHead(504); res.end('no delayed request'); }, 3000);
      state.waiters.push(() => { clearTimeout(timer); send('ready'); });
    }
  } else if (url.pathname === '/release') {
    for (const deliver of state.pending.splice(0)) deliver();
    send('released');
  } else if (url.pathname === '/state') {
    send(JSON.stringify(state.requests), 'application/json');
  } else if (url.pathname === '/fixture.js') {
    send(`globalThis.fixtureOrigin = location.origin;
      const params = new URLSearchParams(location.search);
      let delivered;
      const firstHop = new Promise(resolve => { delivered = resolve; });
      globalThis.deliverScript = options => {
        fetch(options.url + '?' + params, { headers: options.header })
          .then(async response => {
            options.success({ statusCode: response.status, data: await response.text() });
            delivered();
          });
      };
      ${await fixtureSource()}
      globalThis.runCase = async () => {
        const f = fixture, action = params.get('action'), phase = params.get('phase'), payload = params.get('payload');
        if (action !== 'missing') f.injectTenantCredentials({ appid: 'fixture-a', screct_id: 'fixture-secret-a' });
        await f.launch();
        await new Promise(resolve => setTimeout(resolve, 0));
        if (f.calls.length) {
          if (phase === 'response' || payload === 'external-and-inline') {
            const barrier = await fetch('/barrier?' + params);
            if (!barrier.ok) throw new Error('Delayed request never arrived');
          } else await firstHop;
        }
        await f.change(action);
        const external = document.querySelector('script[src*="/late.js"]');
        const loaded = external ? new Promise((resolve, reject) => {
          external.addEventListener('load', resolve); external.addEventListener('error', reject);
        }) : Promise.resolve();
        await fetch('/release?' + params);
        if (f.calls.length) await firstHop;
        // A first-hop response released above may have created a delayed external script.
        await new Promise(resolve => setTimeout(resolve, 0));
        const late = document.querySelector('script[src*="/late.js"]');
        if (!external && late) {
          await fetch('/barrier?' + params);
          const done = new Promise(resolve => late.addEventListener('load', resolve));
          await fetch('/release?' + params); await done;
        }
        await loaded;
        await new Promise(resolve => setTimeout(resolve, 0));
        const requests = await (await fetch('/state?' + params)).json();
        return { action, phase, payload, externalRan: !!globalThis.externalRan, oldInlineRan: !!globalThis.oldInlineRan,
          requests, secretInStorage: JSON.stringify([...f.storage]).includes('fixture-secret'), errors: f.errors,
          revision: f.tenantSession.revision(), userRevision: f.state.app.sessionRevision };
      };`, 'text/javascript');
  } else send('<!doctype html><title>UniApp script isolation regression</title><p>Isolated real H5 launch hook regression</p><script src="/fixture.js"></script>', 'text/html');
});
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));
process.on('SIGINT', () => { server.closeAllConnections(); server.close(); });
