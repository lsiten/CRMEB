import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => {
  const storage = new Map<string, unknown>();
  return { storage, request: vi.fn(), getStorageSync: (key: string) => storage.get(key), removeStorageSync: (key: string) => storage.delete(key) };
});
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { syncPendingReferral } from '../src/services/referral-sync';
beforeEach(() => {
  platform.storage.clear();
  platform.request.mockReset();
  platform.storage.set('crmeb_token', 'fixture-session');
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: '不绑定' } });
});
it('sends separate referral fields and consumes an acknowledged pending referral', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spid: '42', code: '321', agent_id: '7' });
  // When
  const result = await syncPendingReferral();
  // Then
  expect(result).toBe('processed');
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/user/spread'), method: 'POST', data: { puid: '42', code: '321', agent_id: '7' } }));
  expect(platform.storage.has('crmeb_referral')).toBe(false);
});
it.each([undefined, { spread: '-1', code: 'bad' }])('skips requests when pending data is %j', async (referral) => {
  // Given
  platform.storage.set('crmeb_referral', referral);
  // When
  expect(await syncPendingReferral()).toBe('skipped');
  // Then
  expect(platform.request).not.toHaveBeenCalled();
});
it('preserves referral data while the user is a guest', async () => {
  // Given
  platform.storage.delete('crmeb_token');
  platform.storage.set('crmeb_referral', { spread: '42' });
  // When
  expect(await syncPendingReferral()).toBe('skipped');
  // Then
  expect(platform.request).not.toHaveBeenCalled();
  expect(platform.storage.get('crmeb_referral')).toEqual({ spread: '42' });
});
it('retains pending data for a later attempt when transport fails', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  platform.request.mockRejectedValue(new Error('fixture transport failure'));
  // When
  expect(await syncPendingReferral()).toBe('retry');
  // Then
  expect(platform.storage.get('crmeb_referral')).toEqual({ spread: '42' });
  expect(platform.request).toHaveBeenCalledTimes(1);
});
it('coalesces repeated lifecycle events while a referral is in flight', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  let finish: ((value: unknown) => void) | undefined;
  platform.request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  // When
  const first = syncPendingReferral();
  const second = syncPendingReferral();
  finish?.({ statusCode: 200, data: { status: 200, data: '不绑定' } });
  await Promise.all([first, second]);
  // Then
  expect(platform.request).toHaveBeenCalledTimes(1);
});
it('does not erase a newer referral when an older request finishes', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  let finish: ((value: unknown) => void) | undefined;
  platform.request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = syncPendingReferral();
  platform.storage.set('crmeb_referral', { spread: '73' });
  // When
  finish?.({ statusCode: 200, data: { status: 200, data: '不绑定' } });
  await pending;
  // Then
  expect(platform.storage.get('crmeb_referral')).toEqual({ spread: '73' });
});
it('serializes a newly received referral behind the previous request', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  let finish: ((value: unknown) => void) | undefined;
  platform.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = syncPendingReferral();
  platform.storage.set('crmeb_referral', { spread: '73' });
  // When
  const next = syncPendingReferral();
  expect(platform.request).toHaveBeenCalledTimes(1);
  finish?.({ statusCode: 200, data: { status: 200, data: '不绑定' } });
  await Promise.all([first, next]);
  // Then
  expect(platform.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { puid: '73', code: 0, agent_id: 0 } }));
  expect(platform.storage.has('crmeb_referral')).toBe(false);
});
it('does not clear pending data belonging to a changed login session', async () => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  let finish: ((value: unknown) => void) | undefined;
  platform.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = syncPendingReferral();
  platform.storage.set('crmeb_token', 'new-fixture-session');
  // When
  finish?.({ statusCode: 200, data: { status: 200, data: '不绑定' } });
  await pending;
  // Then
  expect(platform.storage.get('crmeb_referral')).toEqual({ spread: '42' });
});

it.each([
  { statusCode: 401, data: {} },
  { statusCode: 200, data: { status: 401, msg: 'expired fixture' } },
])('keeps a newer login session when an old request returns $statusCode', async (response) => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  let finish: ((value: unknown) => void) | undefined;
  platform.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = syncPendingReferral();
  platform.storage.set('crmeb_token', 'new-fixture-session');
  // When
  finish?.(response);
  await pending;
  // Then
  expect(platform.storage.get('crmeb_token')).toBe('new-fixture-session');
});

it.each([null, 'unexpected HTML', {}, { status: 200 }])('retains the pending referral when a successful HTTP response is malformed: %j', async (body) => {
  // Given
  platform.storage.set('crmeb_referral', { spread: '42' });
  platform.request.mockResolvedValue({ statusCode: 200, data: body });
  // When
  expect(await syncPendingReferral()).toBe('retry');
  // Then
  expect(platform.storage.get('crmeb_referral')).toEqual({ spread: '42' });
});
