vi.unmock("../src/services/tenant");
import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ storage: new Map<string, unknown>(), request: vi.fn(), upload: vi.fn(), chooseImage: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: {
  request: platform.request, uploadFile: platform.upload, chooseImage: platform.chooseImage,
  getStorageSync: (key: string) => platform.storage.get(key),
  setStorageSync: (key: string, value: unknown) => platform.storage.set(key, value),
  removeStorageSync: (key: string) => platform.storage.delete(key),
  getStorageInfoSync: () => ({ keys: [...platform.storage.keys()] }), reLaunch: async () => undefined,
} }));
vi.mock('../src/services/telemetry', () => ({ track: () => undefined }));
beforeEach(() => {
  vi.resetModules(); platform.storage.clear(); platform.request.mockReset(); platform.upload.mockReset(); platform.chooseImage.mockReset();
});
async function setup(inject = true) {
  const api = await import('../src/services/api');
  const tenant = await import('../src/services/tenant');
  if (inject) tenant.injectTenantCredentials({ appid: 'fake-a', screct_id: 'fake-secret-a' });
  api.setToken('user-a');
  const upload = await import('../src/services/image-upload');
  return { api, tenant, upload };
}
it('missing credentials block both request and upload', async () => {
  const { api, upload } = await setup(false);
  await expect(api.request('/products')).rejects.toMatchObject({ code: 'tenant_auth_required' });
  await expect(upload.uploadImage('/fake.png')).rejects.toMatchObject({ code: 'tenant_auth_required' });
  expect(platform.request).not.toHaveBeenCalled(); expect(platform.upload).not.toHaveBeenCalled();
});
it('sends independent user and tenant headers without override or persistence', async () => {
  const { api, upload } = await setup();
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200 } });
  platform.upload.mockResolvedValue({ statusCode: 200, data: JSON.stringify({ status: 200, data: { url: 'https://example.test/a.png' } }) });
  await api.request('/order/create', { method: 'POST', data: { amount: 12 }, header: { APPID: 'bad', 'X-Tenant-Token': 'old' } });
  await upload.uploadImage('/fake.png');
  for (const call of [platform.request.mock.calls[0]?.[0], platform.upload.mock.calls[0]?.[0]]) {
    expect(call.header).toMatchObject({ appid: 'fake-a', screct_id: 'fake-secret-a', 'Authori-zation': 'Bearer user-a' });
    expect(call.header.APPID).toBeUndefined(); expect(call.header['X-Tenant-Token']).toBeUndefined();
  }
  expect(platform.request.mock.calls[0]?.[0].data).toEqual({ amount: 12 });
  expect([...platform.storage.values()]).toEqual(['user-a']);
});
for (const code of ['tenant_auth_required','tenant_credentials_invalid','tenant_auth_unavailable','tenant_mismatch','tenant_bootstrap_unavailable','tenant_token_invalid']) {
  it(`${code} preserves user auth and never replays request or upload`, async () => {
    const { api, upload } = await setup();
    const body = { status: 401, data: { code } };
    platform.request.mockResolvedValue({ statusCode: 401, data: body });
    platform.upload.mockResolvedValue({ statusCode: 401, data: JSON.stringify(body) });
    await expect(api.request('/order/create', { method: 'POST' })).rejects.toMatchObject({ code });
    await expect(upload.uploadImage('/fake.png')).rejects.toMatchObject({ code });
    expect(api.getToken()).toBe('user-a');
    expect(platform.request).toHaveBeenCalledTimes(1); expect(platform.upload).toHaveBeenCalledTimes(1);
  });
}
it('user401 expires user auth independently', async () => {
  const { api } = await setup();
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 401 } });
  await expect(api.request('/user')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(api.getToken()).toBeNull(); expect(platform.request).toHaveBeenCalledTimes(1);
});
for (const kind of ['tenant', 'account']) {
  it(`${kind} change during await blocks old request and upload`, async () => {
    const { api, tenant, upload } = await setup();
    const file = upload.uploadImage('/fake.png');
    if (kind === 'tenant') tenant.clearTenantCredentials(); else api.setToken('user-b');
    await expect(file).rejects.toMatchObject({ code: 'TENANT_CHANGED' });
    expect(platform.request).not.toHaveBeenCalled(); expect(platform.upload).not.toHaveBeenCalled();
  });
  for (const status of [200, 401]) {
    it(`${kind} change rejects late ${status} without clearing new auth`, async () => {
      const { api, tenant } = await setup();
      let finish: (value: unknown) => void = () => undefined;
      platform.request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      const request = api.request('/user');
      await Promise.resolve();
      if (kind === 'tenant') tenant.injectTenantCredentials({ appid: 'fake-b', screct_id: 'fake-secret-b' });
      api.setToken('user-b');
      finish({ statusCode: 200, data: { status } });
      await expect(request).rejects.toMatchObject({ code: 'TENANT_CHANGED' });
      expect(api.getToken()).toBe('user-b');
    });
  }
}
it('tenant injection clears local user/cart state', async () => {
  const { api, tenant } = await setup();
  platform.storage.set('crmeb.cart', [1]);
  tenant.injectTenantCredentials({ appid: 'fake-b', screct_id: 'fake-secret-b' });
  expect(api.getToken()).toBeNull(); expect(platform.storage.size).toBe(0);
});
it('account change during image selection prevents upload', async () => {
  const { api, upload } = await setup();
  platform.chooseImage.mockImplementation(async () => { api.setToken('user-b'); return { tempFilePaths: ['/fake.png'] }; });
  await expect(upload.chooseAndUploadImage()).rejects.toMatchObject({ code: 'TENANT_CHANGED' });
  expect(platform.upload).not.toHaveBeenCalled();
});
for (const kind of ['tenant', 'account']) {
  for (const status of [200, 401]) {
    it(`${kind} change rejects a late upload ${status}`, async () => {
      const { api, tenant, upload } = await setup();
      let finish: (value: unknown) => void = () => undefined;
      platform.upload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      const pending = upload.uploadImage('/fake.png');
      await Promise.resolve();
      if (kind === 'tenant') tenant.injectTenantCredentials({ appid: 'fake-b', screct_id: 'fake-secret-b' });
      api.setToken('user-b');
      finish({ statusCode: 200, data: JSON.stringify({ status, data: { url: 'https://example.test/old.png' } }) });
      await expect(pending).rejects.toMatchObject({ code: 'TENANT_CHANGED' });
      expect(api.getToken()).toBe('user-b');
    });
  }
}
