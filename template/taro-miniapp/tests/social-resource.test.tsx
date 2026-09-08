import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const env = vi.hoisted(() => ({ token: 'account-a', hide: () => {}, show: () => {} }));
vi.mock('@tarojs/taro', () => ({ useDidHide: (cb: () => void) => { env.hide = cb; }, useDidShow: (cb: () => void) => { env.show = cb; } }));
vi.mock('../src/services/api', () => ({ getToken: () => env.token, ApiError: Error }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: () => !!env.token }));
import { useSocialResource } from '../src/pages/marketing/use-social-resource';
const loader = vi.fn<() => Promise<string>>();
let state: ReturnType<typeof useSocialResource<string>> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useSocialResource(loader, '/activity'); return null; }
beforeEach(() => { vi.clearAllMocks(); env.token = 'account-a'; loader.mockResolvedValue('initial'); });
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('locks duplicate mutations and refreshes authoritative state after success', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let resolve: (value: number) => void = () => {};
  const mutation = vi.fn(() => new Promise<number>((done) => { resolve = done; })); const success = vi.fn();
  await act(async () => { void state?.run(mutation, success, true); void state?.run(mutation, success, true); });
  expect(mutation).toHaveBeenCalledTimes(1);
  loader.mockResolvedValue('updated');
  await act(async () => { resolve(2); });
  expect(success).toHaveBeenCalledWith(2); expect(state?.data).toBe('updated');
});
it.each(['hidden-success', 'hidden-failure', 'account-success', 'account-failure', 'logout-failure'])('discards %s without navigation or stale feedback', async (mode) => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let finish: () => void = () => {};
  const mutation = () => new Promise<number>((resolve, reject) => { finish = () => mode.endsWith('failure') ? reject(new Error('old failure')) : resolve(1); }); const success = vi.fn();
  await act(async () => { void state?.run(mutation, success, true); });
  await act(async () => { if (mode.startsWith('hidden')) env.hide(); else env.token = mode.startsWith('logout') ? '' : 'account-b'; finish(); });
  expect(success).not.toHaveBeenCalled(); expect(state?.error).toBe(''); expect(state?.data).toBeUndefined();
});
it('requires a read refresh after an uncertain mutation failure before retrying', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  const mutation = vi.fn().mockRejectedValue(new Error('timeout'));
  await act(async () => { await state?.run(mutation, vi.fn(), true); });
  expect(state?.error).toBe('timeout'); expect(state?.data).toBeUndefined(); expect(loader).toHaveBeenCalledTimes(1);
  await act(async () => { await state?.run(mutation, vi.fn()); });
  expect(mutation).toHaveBeenCalledTimes(1);
  await act(async () => { await state?.refresh(); });
  expect(state?.data).toBe('initial');
});
it('does not mutate using an old account snapshot', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  env.token = 'account-b'; const mutation = vi.fn();
  await act(async () => { await state?.run(mutation, vi.fn()); });
  expect(mutation).not.toHaveBeenCalled();
});
it.each(['success', 'failure'])('refreshes after returning while a hidden mutation ends with %s', async (outcome) => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let resolve: (value: number) => void = () => {};
  const mutation = () => new Promise<number>((done, reject) => { resolve = (value) => outcome === 'success' ? done(value) : reject(new Error('old failure')); }); const success = vi.fn();
  await act(async () => { void state?.run(mutation, success, true); });
  await act(async () => { env.hide(); env.show(); });
  loader.mockResolvedValue('returned-state');
  await act(async () => { resolve(1); });
  expect(success).not.toHaveBeenCalled(); expect(state?.data).toBe('returned-state');
});
