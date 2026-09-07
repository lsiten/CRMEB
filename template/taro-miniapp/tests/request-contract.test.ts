import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  request: vi.fn(), getStorageSync: vi.fn(() => 'session'),
  setStorageSync: vi.fn(), removeStorageSync: vi.fn(),
}));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { request } from '../src/services/api';

beforeEach(() => vi.clearAllMocks());
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('CRMEB response envelope', () => {
  it('identifies ordinary H5 and embedded WeChat browsers to the backend', async () => {
    vi.stubEnv('TARO_ENV', 'h5');
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200 } });
    vi.stubGlobal('navigator', { userAgent: 'Mobile Safari' });
    await request('/user');
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ header: expect.objectContaining({ 'Form-type': 'h5' }) }));
    vi.stubGlobal('navigator', { userAgent: 'Mobile MicroMessenger' });
    await request('/user');
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ header: expect.objectContaining({ 'Form-type': 'wechat' }) }));
  });
  it('rejects an expired session delivered with HTTP 200 and clears the token', async () => {
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 401, msg: 'expired' } });
    await expect(request('/user')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(platform.removeStorageSync).toHaveBeenCalledWith('crmeb_token');
  });
  it('rejects business failure instead of returning success-shaped data', async () => {
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: 'stock unavailable', data: {} } });
    await expect(request('/order/create/key')).rejects.toMatchObject({ code: 'BUSINESS', message: 'stock unavailable' });
  });
  it('keeps the successful CRMEB envelope and authorization header', async () => {
    const body = { status: 200, data: { uid: 1 } };
    platform.request.mockResolvedValue({ statusCode: 200, data: body });
    await expect(request('/user')).resolves.toEqual(body);
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ header: expect.objectContaining({ 'Authori-zation': 'Bearer session', 'Form-type': 'routine', 'content-type': 'application/json' }) }));
  });
  it('continues rejecting legacy code failures', async () => {
    platform.request.mockResolvedValue({ statusCode: 200, data: { code: 400, msg: 'failed' } });
    await expect(request('/user')).rejects.toMatchObject({ code: 'BUSINESS' });
  });
});
