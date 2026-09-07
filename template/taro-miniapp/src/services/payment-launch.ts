import Taro from '@tarojs/taro';
import { ApiError } from './api';
import { apiRecord, apiText, type ApiRecord } from './commerce-contracts';
import type { PaymentResponse } from './payment';

export function wechatPaymentParams(value: ApiRecord): Taro.requestPayment.Option {
  const timeStamp = apiText(value['timeStamp'] ?? value['timestamp']);
  const nonceStr = apiText(value['nonceStr']);
  const packageValue = apiText(value['package']);
  const paySign = apiText(value['paySign']);
  const signType = value['signType'];
  if (!timeStamp || !nonceStr || !packageValue || !paySign || !['MD5', 'HMAC-SHA256', 'RSA'].includes(apiText(signType))) throw new ApiError('BUSINESS', '微信支付参数不完整，请重试');
  return { timeStamp, nonceStr, package: packageValue, paySign, signType: signType === 'RSA' ? 'RSA' : signType === 'HMAC-SHA256' ? 'HMAC-SHA256' : 'MD5' };
}

export function paymentCancelled(error: unknown): boolean {
  return /cancel/i.test(apiText(apiRecord(error)['errMsg']) || (error instanceof Error ? error.message : ''));
}

function paymentUrl(value: string): string {
  if (!/^https:\/\/[^\s]+$/i.test(value)) throw new ApiError('BUSINESS', '支付链接无效，请重新发起支付');
  return value;
}

type WechatBridge = Readonly<{ invoke: (method: string, params: ApiRecord, callback: (result: unknown) => void) => void }>;
function isWechatBridge(value: unknown): value is WechatBridge {
  return typeof value === 'object' && value !== null && 'invoke' in value && typeof value.invoke === 'function';
}

async function launchWechatWeb(value: ApiRecord): Promise<void> {
  const bridge: unknown = 'WeixinJSBridge' in window ? window.WeixinJSBridge : undefined;
  if (!isWechatBridge(bridge)) throw new ApiError('BUSINESS', '请在微信内打开页面后支付');
  const params = wechatPaymentParams(value);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new ApiError('TIMEOUT', '支付结果尚未返回，请刷新确认')), 60000);
    bridge.invoke('getBrandWCPayRequest', { ...params, appId: apiText(value['appId']) }, (result) => {
      clearTimeout(timeout);
      const message = apiText(apiRecord(result)['err_msg']);
      if (message.endsWith(':ok')) resolve();
      else reject(new Error(message || '微信支付未完成'));
    });
  });
}

function launchAlipayForm(html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const source = parsed.querySelector('form');
  if (!source) throw new ApiError('BUSINESS', '支付宝支付参数不完整，请重试');
  const form = document.createElement('form');
  form.action = paymentUrl(source.getAttribute('action') ?? '');
  form.method = 'post';
  form.hidden = true;
  for (const field of source.querySelectorAll('input[name]')) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = field.getAttribute('name') ?? '';
    input.value = field.getAttribute('value') ?? '';
    form.append(input);
  }
  document.body.append(form);
  try { HTMLFormElement.prototype.submit.call(form); } finally { form.remove(); }
}

export async function launchPayment(result: PaymentResponse): Promise<Readonly<{ redirected: boolean; externalLink?: string }>> {
  if (result.status === 'SUCCESS') return { redirected: false };
  if (result.status === 'ALLINPAY_PAY') {
    if (!['cusid', 'appid', 'sign', 'reqsn'].every((key) => apiText(result.payParams[key]))) throw new ApiError('BUSINESS', '通联支付参数不完整，请重试');
    if (process.env.TARO_ENV === 'h5') {
      const form = document.createElement('form');
      form.action = paymentUrl(result.payUrl);
      form.method = 'post';
      form.hidden = true;
      for (const [name, value] of Object.entries(result.payParams)) {
        const field = document.createElement('input');
        field.type = 'hidden'; field.name = name; field.value = apiText(value);
        form.append(field);
      }
      document.body.append(form);
      try { HTMLFormElement.prototype.submit.call(form); } finally { form.remove(); }
    } else {
      await Taro.openEmbeddedMiniProgram({ appId: 'wxef277996acc166c3', extraData: { ...result.payParams } });
    }
    return { redirected: true };
  }
  if (process.env.TARO_ENV === 'h5') {
    if (result.status === 'WECHAT_H5_PAY') {
      window.location.assign(paymentUrl(apiText(result.payParams['h5_url'])));
      return { redirected: true };
    }
    if (result.status === 'WECHAT_PAY') { await launchWechatWeb(result.payParams); return { redirected: false }; }
    if (result.status === 'ALIPAY_PAY' && result.form) { launchAlipayForm(result.form); return { redirected: true }; }
  } else if (result.status === 'WECHAT_PAY') {
    await Taro.requestPayment(wechatPaymentParams(result.payParams));
    return { redirected: false };
  }
  const externalLink = apiText(result.payParams['qrCode'] ?? result.payParams['code_url']);
  if (externalLink) return { redirected: false, externalLink };
  throw new ApiError('BUSINESS', '当前环境无法打开该支付方式，请选择其他方式');
}
