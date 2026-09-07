import { beforeEach, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => {
  const storage = new Map<string, unknown>();
  return {
    storage,
    request: vi.fn(),
    login: vi.fn(async () => ({ code: 'fixture-code' })),
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
  };
});
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { bindWechatPhone, loginByPassword, loginBySms, loginByWechat, registerUser } from '../src/services/account';

beforeEach(() => {
  vi.clearAllMocks();
  platform.storage.clear();
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { token: 'fixture-token', key: 'fixture-key' } } });
});

it.each([
  { name: 'password', run: () => loginByPassword('tester', 'fixture-password'), path: '/login', data: { account: 'tester', password: 'fixture-password', spread: '42', agent_id: '7' } },
  { name: 'SMS', run: () => loginBySms('13800000000', '123456'), path: '/login/mobile', data: { phone: '13800000000', captcha: '123456', spread: '42', agent_id: '7' } },
  { name: 'registration', run: () => registerUser('13800000000', '123456', 'fixture-password'), path: '/register', data: { account: '13800000000', captcha: '123456', password: 'fixture-password', spread: '42' } },
])('sends accepted referral fields when $name starts from a referred landing', async ({ run, path, data }) => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42', agent_id: '7', token: 'ignored' });
  // When
  await run();
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining(`/api${path}`), method: 'POST', data }));
});

it('uses the uni spid alias priority when both referral names are present', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42', spid: '73' });
  // When
  await loginByPassword('tester', 'fixture-password');
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { account: 'tester', password: 'fixture-password', spread: '73' } }));
});

it.each([undefined, { spread: '-1', agent_id: 'bad', token: 'ignored' }, 'not-an-object'])('omits invalid stored referral fields when storage is %j', async (stored) => {
  // Given
  platform.storage.set('crmeb_referral', stored);
  // When
  await loginBySms('13800000000', '123456');
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { phone: '13800000000', captcha: '123456' } }));
});

it('sends a user id as spread_spid during routine auth type negotiation', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42', agent_id: '7' });
  // When
  await loginByWechat();
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/routine/auth_type'), data: { code: 'fixture-code', spread_spid: '42' } }));
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/routine/auth_login'), data: { key: 'fixture-key' } }));
});

it('preserves referral data for retry when login is rejected', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: 'fixture rejected' } });
  // When
  await expect(loginByPassword('tester', 'fixture-password')).rejects.toMatchObject({ code: 'BUSINESS' });
  // Then
  expect(platform.storage.get('crmeb_referral')).toEqual({ spread: '42' });
  expect(platform.storage.has('crmeb_token')).toBe(false);
});

it('includes the user referral in the routine phone authorization request', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spid: '73' });
  // When
  await bindWechatPhone({ code: 'phone-code', iv: 'fixture-iv', encryptedData: 'fixture-data' });
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { code: 'phone-code', iv: 'fixture-iv', encryptedData: 'fixture-data', spread_spid: '73' } }));
});

it('sends a QR record separately from the user id during routine login', async () => {
  // Given
  platform.storage.set('crmeb_referral', { code: '321', spread: '42' });
  // When
  await loginByWechat();
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/routine/auth_type'), data: { code: 'fixture-code', spread_spid: '42', spread_code: '321' } }));
});

it('sends the QR record when routine phone authorization has no direct user referral', async () => {
  // Given
  platform.storage.set('crmeb_referral', { code: '321' });
  // When
  await bindWechatPhone({ code: 'phone-code' });
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { code: 'phone-code', iv: '', encryptedData: '', spread_code: '321' } }));
});

it('does not send a QR record as an H5 registration user id', async () => {
  // Given
  platform.storage.set('crmeb_referral', { code: '321' });
  // When
  await registerUser('13800000000', '123456', 'fixture-password');
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { account: '13800000000', captcha: '123456', password: 'fixture-password' } }));
});
