import { expect, it, vi } from 'vitest';
vi.unmock('../src/services/tenant');
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: () => '', getStorageInfoSync: () => ({ keys: [] }), setStorageSync: () => undefined, removeStorageSync: () => undefined,
  request: async (options: { url: string; method?: string; data?: unknown; header?: Record<string,string> }) => {
    const response = await fetch(options.url, { method: options.method ?? 'GET', headers: options.header,
      ...(options.data ? { body: JSON.stringify(options.data) } : {}) });
    return { statusCode: response.status, data: await response.json() };
  },
} }));
vi.mock('../src/services/telemetry', () => ({ track: () => undefined }));
it('uses real HTTP with isolated fake credentials and no bootstrap or replay', async () => {
  const { createServer } = await import('node:http');
  const received: { appid: string | string[] | undefined; secret: string | string[] | undefined; url: string | undefined }[] = [];
  const server = createServer((req, res) => {
    received.push({ appid: req.headers['appid'], secret: req.headers['screct_id'], url: req.url });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url === '/api/order/create'
      ? { status: 401, data: { code: 'tenant_credentials_invalid' } }
      : { status: 200, data: { tenant: req.headers['appid'] } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  vi.resetModules(); vi.stubEnv('TARO_API_BASE_URL', `http://127.0.0.1:${address.port}/api`);
  try {
    const { request } = await import('../src/services/api');
    const { injectTenantCredentials } = await import('../src/services/tenant');
    await expect(request('/products')).rejects.toMatchObject({ code: 'tenant_auth_required' });
    expect(received).toHaveLength(0);
    injectTenantCredentials({ appid: 'fake-a', screct_id: 'fake-secret-a' });
    expect(await request('/products')).toEqual({ status: 200, data: { tenant: 'fake-a' } });
    injectTenantCredentials({ appid: 'fake-b', screct_id: 'fake-secret-b' });
    expect(await request('/products')).toEqual({ status: 200, data: { tenant: 'fake-b' } });
    await expect(request('/order/create', { method: 'POST' })).rejects.toMatchObject({ code: 'tenant_credentials_invalid' });
    expect(received).toEqual([
      { appid: 'fake-a', secret: 'fake-secret-a', url: '/api/products' },
      { appid: 'fake-b', secret: 'fake-secret-b', url: '/api/products' },
      { appid: 'fake-b', secret: 'fake-secret-b', url: '/api/order/create' },
    ]);
  } finally {
    vi.unstubAllEnvs(); server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
