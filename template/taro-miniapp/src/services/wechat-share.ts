import { ApiError, request } from './api';
import type { LotteryShare } from './lottery-share';

type ShareData = Readonly<{ title: string; desc: string; link: string; imgUrl: string }>;
type ShareRegistration = ShareData & { success?: () => void; fail?: () => void };
type WechatConfig = Readonly<{ appId: string; timestamp: number; nonceStr: string; signature: string; jsApiList: readonly string[] }>;
export type WechatShareSdk = Readonly<{
  config: (config: WechatConfig) => void;
  ready: (callback: () => void) => void;
  error: (callback: () => void) => void;
  updateAppMessageShareData?: (data: ShareRegistration) => void;
  updateTimelineShareData?: (data: ShareRegistration) => void;
  onMenuShareAppMessage?: (data: ShareRegistration) => void;
  onMenuShareTimeline?: (data: ShareRegistration) => void;
}>;
declare global { interface Window { jWeixin?: WechatShareSdk } }
let entryUrl = '';
let sdkLoading: Promise<WechatShareSdk> | undefined;
let sdkGeneration = 0;
let signedUrl = '';
const configured = new WeakMap<WechatShareSdk, Promise<void>>();
const menuApis = ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline'] as const;

export function isWechatBrowser(): boolean {
  return process.env.TARO_ENV === 'h5' && /micromessenger/i.test(navigator.userAgent);
}
export function rememberWechatEntry(): void {
  if (process.env.TARO_ENV === 'h5' && !entryUrl) entryUrl = window.location.href;
}
export function wechatSignatureUrl(current: string, entry: string, userAgent: string): string {
  return (/android/i.test(userAgent) ? current : entry || current).split('#')[0] ?? '';
}
function failure(): ApiError { return new ApiError('BUSINESS', '微信分享配置失败，可复制链接或重试'); }

function loadSdk(): Promise<WechatShareSdk> {
  if (window.jWeixin) return Promise.resolve(window.jWeixin);
  if (sdkLoading) return sdkLoading;
  const generation = sdkGeneration;
  sdkLoading = new Promise<WechatShareSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.dataset['crmebWechatSdk'] = 'true';
    const timer = setTimeout(() => { script.remove(); reject(failure()); }, 10000);
    script.src = new URL('./static/wechat-sdk.js', window.location.href).href;
    script.async = true;
    script.onload = () => { clearTimeout(timer); if (window.jWeixin) resolve(window.jWeixin); else { script.remove(); reject(failure()); } };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(failure()); };
    document.head.appendChild(script);
  }).catch((error: unknown) => { if (generation === sdkGeneration) sdkLoading = undefined; throw error instanceof Error ? error : failure(); });
  return sdkLoading;
}
function parseConfig(value: unknown): WechatConfig {
  if (typeof value !== 'object' || value === null) throw failure();
  const fields = 'data' in value ? value.data : value;
  if (typeof fields !== 'object' || fields === null || !('appId' in fields) || typeof fields.appId !== 'string' || !fields.appId || !('nonceStr' in fields) || typeof fields.nonceStr !== 'string' || !fields.nonceStr || !('signature' in fields) || typeof fields.signature !== 'string' || !fields.signature || !('timestamp' in fields)) throw failure();
  const timestamp = Number(fields.timestamp);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw failure();
  return { appId: fields.appId, nonceStr: fields.nonceStr, signature: fields.signature, timestamp, jsApiList: menuApis };
}
function boundedOperation(register: (resolve: () => void, reject: () => void) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(failure()), 10000);
    const done = () => { clearTimeout(timer); resolve(); };
    const fail = () => { clearTimeout(timer); reject(failure()); };
    try { register(done, fail); } catch (error) { clearTimeout(timer); reject(error instanceof Error ? error : failure()); }
  });
}
export async function registerWechatShare(sdk: WechatShareSdk, configValue: unknown, share: LotteryShare, isCurrent: () => boolean = () => true): Promise<void> {
  if (!share.url) throw failure();
  const config = parseConfig(configValue);
  let ready = configured.get(sdk);
  if (!ready) {
    ready = boundedOperation((done, fail) => { sdk.error(fail); sdk.config(config); sdk.ready(done); });
    configured.set(sdk, ready);
  }
  await ready;
  if (!isCurrent()) return;
  const data = { title: share.title, desc: share.title, link: share.url, imgUrl: share.imageUrl };
  sdk.onMenuShareAppMessage?.(data);
  sdk.onMenuShareTimeline?.(data);
  const modern = [sdk.updateAppMessageShareData, sdk.updateTimelineShareData].filter(method => method !== undefined);
  if (!modern.length && (!sdk.onMenuShareAppMessage || !sdk.onMenuShareTimeline)) throw failure();
  await Promise.all(modern.map(method => boundedOperation((success, fail) => method.call(sdk, { ...data, success, fail }))));
}
let registration: Promise<void> = Promise.resolve();
function resetSdk(): void {
  sdkGeneration++;
  if (window.jWeixin) configured.delete(window.jWeixin);
  delete window.jWeixin;
  sdkLoading = undefined;
  document.querySelectorAll('script[data-crmeb-wechat-sdk]').forEach(script => script.remove());
}
export async function configureWechatShare(share: LotteryShare, isCurrent: () => boolean): Promise<void> {
  if (!isWechatBrowser()) return;
  const operation = registration.then(async () => {
    if (!isCurrent()) return;
    const url = wechatSignatureUrl(window.location.href, entryUrl, navigator.userAgent);
    if (signedUrl && signedUrl !== url) resetSdk();
    signedUrl = url;
    try {
      const [sdk, config] = await Promise.all([loadSdk(), request<unknown>('/wechat/config', { method: 'GET', data: { url } })]);
      if (isCurrent()) await registerWechatShare(sdk, config, share, isCurrent);
    } catch (error) { resetSdk(); throw error instanceof Error ? error : failure(); }
  });
  registration = operation.then(() => undefined, () => undefined);
  return operation;
}
