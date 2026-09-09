import { expect, it, vi } from 'vitest';
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: () => '', getStorageInfoSync: () => ({ keys: [] }), setStorageSync: () => undefined, removeStorageSync: () => undefined,
  request: async (options: { url: string; method?: string; data?: unknown; header?: Record<string,string> }) => {
    const response = await fetch(options.url, { method: options.method ?? 'GET', headers: options.header,
      ...(options.data ? { body: JSON.stringify(options.data) } : {}) });
    return { statusCode: response.status, data: await response.json() };
  },
} }));
vi.mock('../src/services/telemetry', () => ({ track: () => undefined }));
it.skipIf(!process.env['TENANT_HTTP_BASE'])('real HTTP cold starts isolate A and B and user401 does not renew tenant', async () => {
  vi.stubEnv('TARO_API_BASE_URL', process.env['TENANT_HTTP_BASE']); vi.stubEnv('TARO_TENANT_ENTRY', 'store-a');
  const { request } = await import('../src/services/api');
  const { tenantSession } = await import('../src/services/tenant');
  const a = await request<{ data: { tenant_id: number } }>('/__test/items');
  expect(a.data.tenant_id).toBe(1);
  await expect(request('/__test/user')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  tenantSession.select('store-b');
  const b = await request<{ data: { tenant_id: number } }>('/__test/items?tenant_id=1');
  expect(b.data.tenant_id).toBe(2);
  vi.unstubAllEnvs();
});
it.skipIf(!process.env['TENANT_HTTP_BASE'] || !process.env['TENANT_TEST_PORT'])('real reset forces one anonymous renewal and next request recovers', async () => {
  vi.resetModules();
  vi.stubEnv('TARO_API_BASE_URL', process.env['TENANT_HTTP_BASE']); vi.stubEnv('TARO_TENANT_ENTRY', 'store-a');
  const { request } = await import('../src/services/api');
  const { execFileSync } = await import('node:child_process');
  await request('/__test/items');
  execFileSync(process.env['TENANT_TEST_PHP'] || 'php', ['tests/reset-isolated-tenant.php'], { env: process.env });
  await expect(request('/__test/items')).rejects.toMatchObject({ code: 'TENANT_UNAVAILABLE' });
  const fresh = await request<{ data: { tenant_id: number } }>('/__test/items');
  expect(fresh.data.tenant_id).toBe(1);
  vi.unstubAllEnvs();
});
