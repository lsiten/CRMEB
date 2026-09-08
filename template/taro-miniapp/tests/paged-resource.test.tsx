import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@tarojs/taro', () => ({ default: {}, useDidShow: () => undefined }));
import { usePagedResource } from '../src/state/paged-resource';
const fetcher = vi.fn<(page: number) => Promise<readonly { id: string }[]>>();
let state: ReturnType<typeof usePagedResource<{ id: string }>> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe({ filter = 'all' }: Readonly<{ filter?: string }>) { state = usePagedResource(filter, fetcher); return null; }
const first = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
beforeEach(() => { vi.clearAllMocks(); fetcher.mockResolvedValue(first); });
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('retains rows after a pagination failure and retries the same page', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  fetcher.mockRejectedValueOnce(new Error('network'));
  await act(async () => { await state?.loadMore(); });
  expect(state?.items).toHaveLength(20);
  expect(state?.error).not.toBe('');
  fetcher.mockResolvedValueOnce([{ id: '20' }]);
  await act(async () => { await state?.retry(); });
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([1, 2, 2]);
  expect(state?.items).toHaveLength(21);
  expect(state?.end).toBe(true);
});
it('discards old filter results even if they arrive last', async () => {
  let finish: ((value: readonly { id: string }[]) => void) | undefined;
  fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  fetcher.mockResolvedValueOnce([{ id: 'new' }]);
  await act(async () => { page?.update(<Probe filter='review' />); });
  await act(async () => { finish?.(first); });
  expect(state?.items).toEqual([{ id: 'new' }]);
});
it('prevents duplicate load-more and deduplicates overlapping pages', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let finish: ((value: readonly { id: string }[]) => void) | undefined;
  fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => { void state?.loadMore(); void state?.loadMore(); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => { finish?.([{ id: '19' }, { id: '20' }]); });
  expect(state?.items).toHaveLength(21);
});
it('continues past an empty filtered page when the server reports more records', async () => {
  const sparseFetcher = vi.fn().mockResolvedValueOnce({ items: [], hasMore: true }).mockResolvedValueOnce({ items: [{ id: 'later' }], hasMore: false });
  function SparseProbe() { state = usePagedResource('sparse', sparseFetcher); return null; }
  await act(async () => { page = TestRenderer.create(<SparseProbe />); });
  expect(state?.end).toBe(false);
  await act(async () => { await state?.loadMore(); });
  expect(sparseFetcher.mock.calls).toEqual([[1], [2]]);
  expect(state?.items).toEqual([{ id: 'later' }]);
  expect(state?.end).toBe(true);
});
