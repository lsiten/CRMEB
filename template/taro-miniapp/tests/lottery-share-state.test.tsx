import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getLotteryShare: vi.fn(), setClipboardData: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: api }));
vi.mock('../src/services/lottery-share', () => ({ getLotteryShare: api.getLotteryShare }));
import { useLotteryShare } from '../src/state/lottery-share';
let state: ReturnType<typeof useLotteryShare> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useLotteryShare({ id: '72', factor: 5, name: 'Lottery', image: '' }); return null; }
afterEach(() => { act(() => page?.unmount()); vi.clearAllMocks(); });
it('allows preparation to recover after a failed user lookup', async () => {
  // Given
  api.getLotteryShare.mockRejectedValueOnce(new Error('offline'));
  act(() => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.prepare(); });
  expect(state).toMatchObject({ busy: false, share: undefined, copied: false });
  expect(state?.error).not.toBe('');
  const share = { title: 'Lottery', path: '/pages/marketing/lottery?spread=42', imageUrl: '' };
  api.getLotteryShare.mockResolvedValueOnce(share);
  // When
  await act(async () => { await state?.prepare(); });
  // Then
  expect(state).toMatchObject({ share, error: '', busy: false });
});
it('acknowledges a copy only after the clipboard promise succeeds', async () => {
  // Given
  const url = 'https://shop.example/#/pages/marketing/lottery?spread=42';
  api.getLotteryShare.mockResolvedValueOnce({ title: 'Lottery', path: '/pages/marketing/lottery', imageUrl: '', url });
  act(() => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.prepare(); });
  let finish: (() => void) | undefined;
  api.setClipboardData.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  // When
  await act(async () => { void state?.copy(); void state?.copy(); });
  // Then
  expect(api.setClipboardData).toHaveBeenCalledTimes(1);
  expect(api.setClipboardData).toHaveBeenCalledWith({ data: url });
  expect(state).toMatchObject({ copied: false, busy: true });
  await act(async () => { finish?.(); });
  expect(state).toMatchObject({ copied: true, busy: false, error: '' });
});
it('prevents repeated preparation while the user lookup is pending', async () => {
  // Given
  let finish: ((value: unknown) => void) | undefined;
  api.getLotteryShare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => { page = TestRenderer.create(<Probe />); });
  // When
  await act(async () => { void state?.prepare(); void state?.prepare(); });
  // Then
  expect(api.getLotteryShare).toHaveBeenCalledTimes(1);
  expect(state?.busy).toBe(true);
  await act(async () => { finish?.({ title: 'Lottery', path: '/pages/marketing/lottery', imageUrl: '' }); });
});
it('retains a selectable link when clipboard access is rejected', async () => {
  // Given
  const share = { title: 'Lottery', path: '/pages/marketing/lottery', imageUrl: '', url: 'https://shop.example/#/pages/marketing/lottery?spread=42' };
  api.getLotteryShare.mockResolvedValueOnce(share); api.setClipboardData.mockRejectedValueOnce(new Error('clipboard denied'));
  act(() => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.prepare(); });
  // When
  await act(async () => { await state?.copy(); });
  // Then
  expect(state).toMatchObject({ share, busy: false, copied: false });
  expect(state?.error).not.toBe('');
});
