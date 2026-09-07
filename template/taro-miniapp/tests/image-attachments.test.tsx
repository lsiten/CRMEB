import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../src/services/image-upload', () => ({ chooseAndUploadImage: mocks.upload }));
vi.mock('@tarojs/taro', () => ({ default: {} }));
import { useImageAttachments } from '../src/state/image-attachments';
let state: ReturnType<typeof useImageAttachments> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useImageAttachments(3); return null; }
beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue('https://example.test/proof.png'); });
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('adds only acknowledged uploads and retains existing images on a failure', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.choose(); });
  mocks.upload.mockRejectedValueOnce(new Error('network'));
  await act(async () => { await state?.choose(); });
  expect(state?.images).toEqual(['https://example.test/proof.png']);
  expect(state?.error).not.toBe('');
});
it('locks immediately while uploading and respects the configured limit', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let finish: ((url: string) => void) | undefined;
  mocks.upload.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
  await act(async () => { void state?.choose(); void state?.choose(); });
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(state?.isUploading()).toBe(true);
  expect(state?.images).toHaveLength(0);
  await act(async () => { finish?.('https://example.test/first.png'); });
  await act(async () => { await state?.choose(); await state?.choose(); await state?.choose(); });
  expect(mocks.upload).toHaveBeenCalledTimes(3);
  expect(state?.images).toHaveLength(3);
});
it('removes by position even when two uploaded URLs match and permits replacement', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.choose(); await state?.choose(); });
  await act(async () => { state?.remove(0); });
  expect(state?.images).toHaveLength(1);
  await act(async () => { await state?.choose(); });
  expect(state?.images).toHaveLength(2);
});
it('does not add an image when the picker is cancelled', async () => {
  mocks.upload.mockResolvedValueOnce(undefined);
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.choose(); });
  expect(state?.images).toEqual([]);
  expect(state?.error).toBe('');
  expect(state?.uploading).toBe(false);
});
