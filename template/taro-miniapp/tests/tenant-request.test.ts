import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ storage: new Map<string, unknown>(), request: vi.fn(), upload: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: {
  request: platform.request, uploadFile: platform.upload, getStorageSync: (key: string) => platform.storage.get(key),
  setStorageSync: (key: string, value: unknown) => platform.storage.set(key, value),
  removeStorageSync: (key: string) => platform.storage.delete(key),
  getStorageInfoSync: () => ({ keys: [...platform.storage.keys()] }), reLaunch: async () => undefined,
} }));
vi.mock('../src/services/telemetry', () => ({ track: () => undefined }));
const bootstrap = (token: string) => ({ statusCode: 200, data: { status: 200, data: {
  tenant: { id: 1, name: 'A', code: 'a' }, tenant_token: token, expires_in: 3600,
} } });
const invalid = { statusCode: 200, data: { status: 401, data: { code: 'tenant_token_invalid' } } };
beforeEach(() => {
  vi.resetModules(); platform.storage.clear(); platform.request.mockReset(); platform.upload.mockReset();
  vi.stubEnv('TARO_TENANT_ENTRY', 'store-a');
});
afterEach(() => vi.unstubAllEnvs());
it('bootstraps anonymously and sends independent user and tenant headers', async () => {
  platform.request.mockResolvedValueOnce(bootstrap('tenant-a')).mockResolvedValueOnce({ statusCode: 200, data: { status: 200 } });
  const api = await import('../src/services/api'); api.getToken(); api.setToken('user-a');
  await api.request('/user');
  expect(platform.request.mock.calls[0]?.[0]).toMatchObject({ method: 'POST', data: { entry: 'store-a' }, header: { 'content-type': 'application/json' } });
  expect(Object.keys(platform.request.mock.calls[0]?.[0].header)).toEqual(['content-type']);
  expect(platform.request.mock.calls[1]?.[0].header).toMatchObject({ 'Authori-zation': 'Bearer user-a', 'X-Tenant-Token': 'tenant-a' });
});
it('renews tenant 401 once then stops without clearing user token', async () => {
  platform.request.mockResolvedValueOnce(bootstrap('old')).mockResolvedValueOnce(invalid)
    .mockResolvedValueOnce(bootstrap('fresh')).mockResolvedValueOnce(invalid);
  const api = await import('../src/services/api'); api.setToken('user-a');
  await expect(api.request('/products')).rejects.toMatchObject({ code: 'TENANT_UNAVAILABLE' });
  expect(platform.request).toHaveBeenCalledTimes(4);
  expect(api.getToken()).toBe('user-a');
});
it('user 401 expires user session without bootstrap renewal', async () => {
  platform.request.mockResolvedValueOnce(bootstrap('tenant')).mockResolvedValueOnce({ statusCode: 200, data: { status: 401 } });
  const api = await import('../src/services/api'); api.setToken('user-a');
  await expect(api.request('/user')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(api.getToken()).toBeNull(); expect(platform.request).toHaveBeenCalledTimes(2);
});
it('does not replay non-idempotent orders after tenant rejection', async () => {
  platform.request.mockResolvedValueOnce(bootstrap('old')).mockResolvedValueOnce(invalid).mockResolvedValueOnce(bootstrap('fresh'));
  const api = await import('../src/services/api');
  await expect(api.request('/order/create', { method: 'POST' })).rejects.toMatchObject({ code: 'TENANT_UNAVAILABLE' });
  expect(platform.request.mock.calls.filter(call => call[0].url.endsWith('/order/create'))).toHaveLength(1);
});
it('switch clears user cart and product cache and rejects late response', async () => {
  let finish: (value: unknown) => void = () => undefined;
  platform.request.mockResolvedValueOnce(bootstrap('old')).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const api = await import('../src/services/api');
  const { tenantSession } = await import('../src/services/tenant');
  api.getToken(); api.setToken('user-a'); platform.storage.set('crmeb.cart', [{ id: 1 }]);
  const pending = api.request('/products');
  await vi.waitFor(() => expect(platform.request).toHaveBeenCalledTimes(2));
  tenantSession.select('store-b');
  finish({ statusCode: 200, data: { status: 200 } });
  await expect(pending).rejects.toMatchObject({ code: 'TENANT_CHANGED' });
  expect(api.getToken()).toBeNull(); expect(platform.storage.has('crmeb.cart')).toBe(false);
});
it('does not replay account cancellation even though it is a GET', async () => {
  platform.request.mockResolvedValueOnce(bootstrap('old')).mockResolvedValueOnce(invalid).mockResolvedValueOnce(bootstrap('fresh'));
  const api = await import('../src/services/api');
  await expect(api.request('/user_cancel')).rejects.toMatchObject({ code: 'TENANT_UNAVAILABLE' });
  expect(platform.request.mock.calls.filter(call => call[0].url.endsWith('/user_cancel'))).toHaveLength(1);
});
it('clears previous tenant credentials and guide cache when returning to default mode', async () => {
  vi.stubEnv('TARO_TENANT_ENTRY', '');
  platform.storage.set('crmeb.tenantEntry', { entry: 'store-a' }); platform.storage.set('crmeb_token','user-a');
  platform.storage.set('guideDate', 'today');
  const { initializeTenantState } = await import('../src/services/tenant'); initializeTenantState();
  expect(platform.storage.has('crmeb_token')).toBe(false);
  expect(platform.storage.has('guideDate')).toBe(false);
  expect(platform.request).not.toHaveBeenCalled();
});

it('upload tenant HTTP401 renews without clearing user or replaying file', async () => {
  platform.request.mockResolvedValueOnce(bootstrap('old')).mockResolvedValueOnce(bootstrap('fresh'));
  platform.upload.mockResolvedValue({ statusCode: 401, data: JSON.stringify(invalid.data) });
  const api = await import('../src/services/api'); api.setToken('user-a');
  const { uploadImage } = await import('../src/services/image-upload');
  await expect(uploadImage('/photo.png')).rejects.toMatchObject({ code: 'TENANT_UNAVAILABLE' });
  expect(api.getToken()).toBe('user-a'); expect(platform.upload).toHaveBeenCalledTimes(1);
});
it('late upload user401 cannot clear a newer user session', async () => {
  let finish: (value: unknown) => void = () => undefined;
  platform.request.mockResolvedValueOnce(bootstrap('old'));
  platform.upload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const api = await import('../src/services/api'); api.setToken('user-a');
  const { uploadImage } = await import('../src/services/image-upload');
  const pending = uploadImage('/photo.png');
  await vi.waitFor(() => expect(platform.upload).toHaveBeenCalledTimes(1));
  api.setToken('user-b'); finish({ statusCode: 401, data: '' });
  await expect(pending).rejects.toMatchObject({ code: 'TENANT_CHANGED' });
  expect(api.getToken()).toBe('user-b');
});
