import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'test', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getMerchantTransfer } from '../src/services/merchant-transfer';
const respond = (data: unknown) => platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } });
beforeEach(() => vi.clearAllMocks());
it('loads the server amount and confirmation package for a lottery transfer order', async () => {
  respond({ state: 'WAIT_USER_CONFIRM', true_extract_price: '8.88', mchid: 'merchant', wechat_appid: 'wx-app', package_info: 'signed-package', channel_type: 'wechat' });
  await expect(getMerchantTransfer('hb321', 2)).resolves.toEqual({ orderId: 'hb321', kind: 2, state: 'WAIT_USER_CONFIRM', amount: 8.88, merchantId: 'merchant', appId: 'wx-app', packageInfo: 'signed-package', channel: 'wechat', failReason: '' });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/transfer/info'), method: 'GET', data: { order_id: 'hb321', type: 2 } }));
});
it('permits a terminal receipt without a launch package when already received', async () => {
  respond({ state: 'SUCCESS', true_extract_price: 8.88 });
  await expect(getMerchantTransfer('hb321', 2)).resolves.toMatchObject({ state: 'SUCCESS', amount: 8.88 });
});
it('rejects missing amounts instead of showing zero currency', async () => {
  respond({ state: 'SUCCESS' });
  await expect(getMerchantTransfer('hb321', 2)).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('rejects an unknown transfer state rather than treating it as received', async () => {
  respond({ state: 'unexpected', true_extract_price: 8.88 });
  await expect(getMerchantTransfer('hb321', 2)).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('keeps server failure reason for an expired transfer', async () => {
  respond({ state: 'FAIL', true_extract_price: 8.88, fail_reason: '领取超时' });
  await expect(getMerchantTransfer('hb321', 2)).resolves.toMatchObject({ state: 'FAIL', failReason: '领取超时' });
});
it('rejects invalid order identifiers before sending a request', async () => {
  await expect(getMerchantTransfer('../other', 2)).rejects.toMatchObject({ code: 'BUSINESS' });
  expect(platform.request).not.toHaveBeenCalled();
});
it.each(['', 'unrecognized'])('parses unsupported channel %s as unknown for a safe platform guard', async (channel) => {
  respond({ state: 'WAIT_USER_CONFIRM', true_extract_price: 8.88, channel_type: channel });
  await expect(getMerchantTransfer('hb321', 2)).resolves.toMatchObject({ channel: 'unknown' });
});
