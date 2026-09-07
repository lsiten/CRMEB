import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { useLotterySpin } from '../src/state/lottery-spin';
let state: ReturnType<typeof useLotterySpin> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe({ reduced = false }: Readonly<{ reduced?: boolean }>) { state = useLotterySpin('record-31', 5, 8, reduced); return null; }
afterEach(() => { act(() => page?.unmount()); vi.useRealTimers(); });
it('delays the result until the indicator reaches the server-selected prize', async () => {
  // Given
  vi.useFakeTimers();
  act(() => { page = TestRenderer.create(<Probe />); });
  expect(state?.settling).toBe(true);
  // When
  await act(async () => { await vi.runAllTimersAsync(); });
  // Then
  expect(state).toMatchObject({ activeIndex: 5, settling: false });
});
it('shows the server-selected prize immediately when reduced motion is enabled', () => {
  // Given
  vi.useFakeTimers();
  // When
  act(() => { page = TestRenderer.create(<Probe reduced />); });
  // Then
  expect(state).toMatchObject({ activeIndex: 5, settling: false });
  expect(vi.getTimerCount()).toBe(0);
});
it('clears pending animation callbacks when leaving the page', () => {
  // Given
  vi.useFakeTimers();
  act(() => { page = TestRenderer.create(<Probe />); });
  // When
  act(() => page?.unmount());
  // Then
  expect(vi.getTimerCount()).toBe(0);
});
