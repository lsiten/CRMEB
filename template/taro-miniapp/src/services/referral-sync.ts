import Taro from '@tarojs/taro';
import { ApiError, getToken, request } from './api';
import { parseStoredReferral } from './platform';

type SyncResult = 'skipped' | 'processed' | 'retry';
type PendingSync = Readonly<{ token: string; signature: string; promise: Promise<SyncResult> }>;
let pending: PendingSync | undefined;
const storageKey = 'crmeb_referral';

export function syncPendingReferral(): Promise<SyncResult> {
  const token = getToken();
  const referral = parseStoredReferral(Taro.getStorageSync<unknown>(storageKey));
  if (!token || Object.keys(referral).length === 0) return Promise.resolve('skipped');
  const signature = JSON.stringify(referral);
  if (pending) {
    if (pending.token === token && pending.signature === signature) return pending.promise;
    return pending.promise.then(() => syncPendingReferral());
  }
  const operation = async (): Promise<SyncResult> => {
    try {
      const response = await request<unknown>('/user/spread', {
        method: 'POST',
        data: { puid: referral.spid ?? referral.spread ?? 0, code: referral.code ?? 0, agent_id: referral.agent_id ?? 0 },
      });
      if (typeof response !== 'object' || response === null || !('data' in response) || (typeof response.data !== 'string' && typeof response.data !== 'boolean')) return 'retry';
      const current = parseStoredReferral(Taro.getStorageSync<unknown>(storageKey));
      if (getToken() === token && JSON.stringify(current) === signature) Taro.removeStorageSync(storageKey);
      return 'processed';
    } catch (error) {
      if (error instanceof ApiError) return 'retry';
      throw error;
    }
  };
  const promise = operation().finally(() => { pending = undefined; });
  pending = { token, signature, promise };
  return promise;
}
