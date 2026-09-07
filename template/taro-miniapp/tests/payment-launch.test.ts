import { afterEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ requestPayment: vi.fn(), openEmbeddedMiniProgram: vi.fn(), getStorageSync: () => '' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
import { launchPayment, paymentCancelled, wechatPaymentParams } from '../src/services/payment-launch';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const params = { timestamp: 123, nonceStr: 'nonce', package: 'prepay_id=test', paySign: 'signature', signType: 'RSA' };
it('launches AllinPay merchant payments using the configured embedded mini program', async () => {
  vi.stubEnv('TARO_ENV', 'weapp');
  const signed = { cusid: 'merchant', appid: 'application', sign: 'signature', reqsn: 'order' };
  await launchPayment({ orderId: 'wx123', status: 'ALLINPAY_PAY', payParams: signed, form: '', payKey: '', payUrl: '' });
  expect(platform.openEmbeddedMiniProgram).toHaveBeenCalledWith({ appId: 'wxef277996acc166c3', extraData: signed });
});
it('maps CRMEB timestamp and preserves RSA signatures for WeChat Pay', async () => {
  vi.stubEnv('TARO_ENV', 'weapp');
  expect(wechatPaymentParams(params)).toEqual({ timeStamp: '123', nonceStr: 'nonce', package: 'prepay_id=test', paySign: 'signature', signType: 'RSA' });
  await launchPayment({ orderId: 'wx123', status: 'WECHAT_PAY', payParams: params, form: '', payKey: '', payUrl: '' });
  expect(platform.requestPayment).toHaveBeenCalledOnce();
});
it('rejects missing signatures before invoking a payment provider', () => {
  expect(() => wechatPaymentParams({ timestamp: 123 })).toThrow('微信支付参数不完整');
  expect(platform.requestPayment).not.toHaveBeenCalled();
});
it('distinguishes user cancellation from payment errors', () => {
  expect(paymentCancelled({ errMsg: 'requestPayment:fail cancel' })).toBe(true);
  expect(paymentCancelled(new Error('get_brand_wcpay_request:cancel'))).toBe(true);
  expect(paymentCancelled({ errMsg: 'requestPayment:fail invalid signature' })).toBe(false);
});
it('does not invent payment parameters after a server-completed payment', async () => {
  await expect(launchPayment({ orderId: 'wx123', status: 'SUCCESS', payParams: {}, form: '', payKey: '', payUrl: '' })).resolves.toEqual({ redirected: false });
  expect(platform.requestPayment).not.toHaveBeenCalled();
});
