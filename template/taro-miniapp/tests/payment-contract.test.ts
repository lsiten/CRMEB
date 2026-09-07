import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { queryPayment, requestPayment } from '../src/services/api';
beforeEach(() => vi.clearAllMocks());
it('uses the real payment endpoint and preserves a reassigned order number', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { status: 'WECHAT_PAY', result: { order_id: 'cp-new', jsConfig: { timestamp: '123', signType: 'RSA' } } } } });
  await expect(requestPayment({ orderId: 'wx-old', method: 'wechat' })).resolves.toMatchObject({ orderId: 'cp-new', status: 'WECHAT_PAY', payParams: { timestamp: '123', signType: 'RSA' } });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/pay'), data: expect.objectContaining({ uni: 'wx-old', paytype: 'weixin' }) }));
});
it('confirms payment using the authoritative order detail', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { paid: 1 } } });
  await expect(queryPayment('wx123')).resolves.toEqual({ status: 'paid' });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/detail/wx123') }));
});
it('rejects incomplete payment status instead of polling forever', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: {} } });
  await expect(queryPayment('wx123')).rejects.toThrow();
});
it('does not treat a payment business failure as success', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, msg: '余额不足', data: { status: 'PAY_ERROR', result: {} } } });
  await expect(requestPayment({ orderId: 'wx123', method: 'balance' })).rejects.toThrow('余额不足');
});
