import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@tarojs/taro', () => ({ default: {} }));
import { launchMerchantTransfer } from '../src/services/transfer-launch';
import type { MerchantTransfer } from '../src/services/merchant-transfer';
const info: MerchantTransfer = { orderId: 'hb321', kind: 2, state: 'WAIT_USER_CONFIRM', amount: 8.88, merchantId: 'merchant', appId: 'wx-app', packageInfo: 'signed-package', channel: 'wechat', failReason: '' };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('invokes the web transfer method with server parameters when opened in WeChat', async () => {
  vi.stubEnv('TARO_ENV', 'h5');
  const invoke = vi.fn((_method: string, _params: unknown, cb: (value: unknown) => void) => cb({ err_msg: 'requestMerchantTransfer:ok' }));
  vi.stubGlobal('window', { WeixinJSBridge: { invoke } });
  await expect(launchMerchantTransfer(info)).resolves.toBeUndefined();
  expect(invoke).toHaveBeenCalledWith('requestMerchantTransfer', { mchId: 'merchant', appId: 'wx-app', package: 'signed-package' }, expect.any(Function));
});
it('reports cancellation without declaring server payment success', async () => {
  vi.stubEnv('TARO_ENV', 'h5');
  vi.stubGlobal('window', { WeixinJSBridge: { invoke: (_method: string, _params: unknown, cb: (value: unknown) => void) => cb({ err_msg: 'requestMerchantTransfer:cancel' }) } });
  await expect(launchMerchantTransfer(info)).rejects.toMatchObject({ cancelled: true });
});
it('uses the native merchant transfer API for a mini program receipt', async () => {
  vi.stubEnv('TARO_ENV', 'weapp');
  const requestMerchantTransfer = vi.fn((options: { success: () => void }) => options.success());
  vi.stubGlobal('wx', { requestMerchantTransfer });
  await launchMerchantTransfer({ ...info, channel: 'routine' });
  expect(requestMerchantTransfer).toHaveBeenCalledWith(expect.objectContaining({ mchId: 'merchant', appId: 'wx-app', package: 'signed-package' }));
});
it('refuses to invoke a mini program transfer from a web page', async () => {
  vi.stubEnv('TARO_ENV', 'h5');
  const invoke = vi.fn(); vi.stubGlobal('window', { WeixinJSBridge: { invoke } });
  await expect(launchMerchantTransfer({ ...info, channel: 'routine' })).rejects.toMatchObject({ cancelled: false });
  expect(invoke).not.toHaveBeenCalled();
});
it('returns an actionable error when the platform does not support transfers', async () => {
  vi.stubEnv('TARO_ENV', 'weapp'); vi.stubGlobal('wx', {});
  await expect(launchMerchantTransfer({ ...info, channel: 'routine' })).rejects.toMatchObject({ cancelled: false });
});
it('does not launch an expired transfer', async () => {
  await expect(launchMerchantTransfer({ ...info, state: 'FAIL' })).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('does not send an incomplete confirmation package to the platform', async () => {
  await expect(launchMerchantTransfer({ ...info, packageInfo: '' })).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('times out a missing platform callback so users can query the server again', async () => {
  vi.useFakeTimers(); vi.stubEnv('TARO_ENV', 'h5'); vi.stubGlobal('window', { WeixinJSBridge: { invoke: vi.fn() } });
  const result = expect(launchMerchantTransfer(info)).rejects.toMatchObject({ cancelled: false });
  await vi.advanceTimersByTimeAsync(60000); await result;
});
it.each(['h5', 'weapp'] as const)('rejects App-origin transfers without a bridge call on %s', async (environment) => {
  vi.stubEnv('TARO_ENV', environment);
  const invoke = vi.fn((_method: string, _params: unknown, cb: (value: unknown) => void) => cb({ err_msg: 'requestMerchantTransfer:ok' }));
  const requestMerchantTransfer = vi.fn((options: { success: () => void }) => options.success());
  vi.stubGlobal('window', { WeixinJSBridge: { invoke } }); vi.stubGlobal('wx', { requestMerchantTransfer });
  await expect(launchMerchantTransfer({ ...info, channel: 'app' })).rejects.toMatchObject({ cancelled: false });
  expect(invoke).not.toHaveBeenCalled(); expect(requestMerchantTransfer).not.toHaveBeenCalled();
});
it.each(['h5', 'weapp'] as const)('rejects unknown-origin transfers without a bridge call on %s', async (environment) => {
  vi.stubEnv('TARO_ENV', environment);
  const invoke = vi.fn((_method: string, _params: unknown, cb: (value: unknown) => void) => cb({ err_msg: 'requestMerchantTransfer:ok' }));
  const requestMerchantTransfer = vi.fn((options: { success: () => void }) => options.success());
  vi.stubGlobal('window', { WeixinJSBridge: { invoke } }); vi.stubGlobal('wx', { requestMerchantTransfer });
  await expect(launchMerchantTransfer({ ...info, channel: 'unknown' })).rejects.toMatchObject({ cancelled: false });
  expect(invoke).not.toHaveBeenCalled(); expect(requestMerchantTransfer).not.toHaveBeenCalled();
});
