import { ApiError, request } from './api';
import { apiAmount, apiId, apiRecord, apiText } from './commerce-contracts';

const transferStates = ['ACCEPTED', 'PROCESSING', 'WAIT_USER_CONFIRM', 'TRANSFERING', 'SUCCESS', 'FAIL', 'CANCELING', 'CANCELLED'] as const;
export type TransferState = typeof transferStates[number];
const transferChannels = ['wechat', 'routine', 'app'] as const;
export type TransferChannel = typeof transferChannels[number] | 'unknown';
export type TransferKind = 1 | 2;
export type MerchantTransfer = Readonly<{ orderId: string; kind: TransferKind; state: TransferState; amount: number; merchantId: string; appId: string; packageInfo: string; channel: TransferChannel; failReason: string }>;
export const transferLabels: Readonly<Record<TransferState, string>> = {
  ACCEPTED: '转账处理中', PROCESSING: '转账处理中', WAIT_USER_CONFIRM: '待确认收款', TRANSFERING: '正在转账', SUCCESS: '收款成功', FAIL: '转账已失效', CANCELING: '转账正在撤销', CANCELLED: '转账已撤销',
};
export async function getMerchantTransfer(orderId: string, kind: TransferKind): Promise<MerchantTransfer> {
  const id = apiId(orderId);
  const envelope = apiRecord(await request<unknown>('/transfer/info', { method: 'GET', data: { order_id: id, type: kind } }));
  const row = apiRecord(envelope['data']);
  const state = transferStates.find((candidate) => candidate === row['state']);
  if (!state) throw new ApiError('BUSINESS', '转账状态暂不可用，请刷新确认');
  return { orderId: id, kind, state, amount: apiAmount(row['true_extract_price']), merchantId: apiText(row['mchid']), appId: apiText(row['wechat_appid']), packageInfo: apiText(row['package_info']), channel: transferChannels.find((candidate) => candidate === row['channel_type']) ?? 'unknown', failReason: apiText(row['fail_reason']) };
}
