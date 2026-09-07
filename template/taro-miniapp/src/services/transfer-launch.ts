import { ApiError } from './api';
import { apiRecord, apiText, type ApiRecord } from './commerce-contracts';
import type { MerchantTransfer } from './merchant-transfer';

type TransferParams = Readonly<{ mchId: string; appId: string; package: string }>;
type TransferOptions = TransferParams & Readonly<{ success: () => void; fail: (cause: unknown) => void }>;
type MiniTransfer = Readonly<{ requestMerchantTransfer: (options: TransferOptions) => void }>;
type WebBridge = Readonly<{ invoke: (method: string, params: ApiRecord, callback: (result: unknown) => void) => void }>;
const isMiniTransfer = (value: unknown): value is MiniTransfer => typeof value === 'object' && value !== null && 'requestMerchantTransfer' in value && typeof value.requestMerchantTransfer === 'function';
const isWebBridge = (value: unknown): value is WebBridge => typeof value === 'object' && value !== null && 'invoke' in value && typeof value.invoke === 'function';
export class TransferLaunchError extends Error {
  readonly cancelled: boolean;
  constructor(message: string, cancelled = false) { super(message); this.name = 'TransferLaunchError'; this.cancelled = cancelled; }
}
export async function launchMerchantTransfer(info: MerchantTransfer): Promise<void> {
  if (info.state !== 'WAIT_USER_CONFIRM') throw new ApiError('BUSINESS', '当前转账无需再次确认，请刷新结果');
  if (!info.merchantId || !info.appId || !info.packageInfo) throw new ApiError('BUSINESS', '收款参数不完整，请刷新后重试');
  const params: TransferParams = { mchId: info.merchantId, appId: info.appId, package: info.packageInfo };
  const web = process.env.TARO_ENV === 'h5';
  if (info.channel === 'app') throw new TransferLaunchError('请在商城App中领取此红包');
  if (info.channel === 'unknown') throw new TransferLaunchError('收款渠道信息不完整，请刷新后重试');
  if (!web && process.env.TARO_ENV !== 'weapp') throw new TransferLaunchError('请在对应的微信页面或小程序中领取');
  if (web && info.channel === 'routine') throw new TransferLaunchError('请在微信小程序中领取此红包');
  if (!web && info.channel === 'wechat') throw new TransferLaunchError('请在微信公众号页面中领取此红包');
  const bridge: unknown = web && typeof window !== 'undefined' && 'WeixinJSBridge' in window ? window.WeixinJSBridge : undefined;
  const runtime: object = globalThis;
  const mini: unknown = !web && 'wx' in runtime ? runtime.wx : undefined;
  if (web ? !isWebBridge(bridge) : !isMiniTransfer(mini)) throw new TransferLaunchError(web ? '请在微信内打开此页面，或更新微信后重试' : '当前微信版本不支持收款，请更新微信后重试');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TransferLaunchError('收款界面尚未返回，请刷新确认结果')), 60000);
    const success = () => { clearTimeout(timer); resolve(); };
    const fail = (cause: unknown) => {
      clearTimeout(timer);
      const message = apiText(apiRecord(cause)['errMsg']) || apiText(apiRecord(cause)['err_msg']);
      reject(new TransferLaunchError(/cancel/i.test(message) ? '已取消确认，可重新领取' : '微信收款未完成，请刷新后重试', /cancel/i.test(message)));
    };
    try {
      if (web && isWebBridge(bridge)) bridge.invoke('requestMerchantTransfer', params, (result) => { if (apiText(apiRecord(result)['err_msg']) === 'requestMerchantTransfer:ok') success(); else fail(result); });
      else if (isMiniTransfer(mini)) mini.requestMerchantTransfer({ ...params, success, fail });
    } catch (cause) { clearTimeout(timer); reject(cause); }
  });
}
