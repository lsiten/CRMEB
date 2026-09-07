import { afterEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ setClipboardData: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: native }));
import { copyText } from '../src/services/clipboard';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('does not report success when the legacy clipboard returns false', async () => {
  // Given
  vi.stubEnv('TARO_ENV', 'h5'); vi.stubGlobal('navigator', {});
  const input = { value: '', readOnly: false, style: {}, select: vi.fn(), setSelectionRange: vi.fn(), remove: vi.fn() };
  vi.stubGlobal('document', { createElement: () => input, body: { appendChild: vi.fn() }, execCommand: () => false });
  // When / Then
  await expect(copyText('invitation')).rejects.toThrow('复制失败');
  expect(input.remove).toHaveBeenCalledOnce();
});
it('propagates secure clipboard permission rejection without a success fallback', async () => {
  // Given
  vi.stubEnv('TARO_ENV', 'h5');
  const writeText = vi.fn().mockRejectedValue(new Error('denied'));
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  // When / Then
  await expect(copyText('invitation')).rejects.toThrow('denied');
  expect(native.setClipboardData).not.toHaveBeenCalled();
});
it('copies the exact text using the native mini-program API', async () => {
  // Given
  vi.stubEnv('TARO_ENV', 'weapp');
  // When
  await copyText('invitation');
  // Then
  expect(native.setClipboardData).toHaveBeenCalledWith({ data: 'invitation' });
});
