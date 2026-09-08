import { ApiError, getToken, request } from './api';
import type { ProductVariant } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';
import type { MarketingItem } from './marketing';

export function positiveId(value: unknown): number {
  const text = apiText(value);
  const id = /^[1-9]\d*$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(id)) throw new ApiError('BUSINESS', '活动标识无效');
  return id;
}
export type BargainAction = 'start' | 'invite' | 'help' | 'complete' | 'helped' | 'buy' | 'unavailable';
export type Bargain = Readonly<{ id: number; productId: number; title: string; image: string; price: number; minimum: number; remaining: number; reduced: number; ownerId: number; viewerId: number; action: BargainAction; available: boolean }>;
function bargainAction(value: unknown, own: boolean, status: number, remaining: number): BargainAction {
  switch (Number(value)) {
    case 1: return own ? 'start' : 'unavailable';
    case 2: return own ? 'invite' : 'unavailable';
    case 3: return !own && remaining > 0 ? 'help' : 'unavailable';
    case 4: return !own ? 'complete' : 'unavailable';
    case 5: return !own ? 'helped' : 'unavailable';
    case 6: return own && status === 1 && remaining === 0 ? 'buy' : 'unavailable';
    default: return 'unavailable';
  }
}
export async function getBargain(id: number, ownerId?: number): Promise<Bargain> {
  positiveId(id); if (ownerId !== undefined) positiveId(ownerId);
  const token = getToken();
  let data = apiRecord(apiRecord(await request<unknown>(`/bargain/detail/${id}`, { method: 'GET', data: { bargainUid: ownerId ?? 0 } }))['data']);
  const viewerId = positiveId(apiRecord(data['userInfo'])['uid']);
  const owner = ownerId ?? viewerId;
  if (ownerId === undefined) {
    if (getToken() !== token) throw new ApiError('UNAUTHORIZED', '登录状态已变化，请刷新');
    data = apiRecord(apiRecord(await request<unknown>(`/bargain/detail/${id}`, { method: 'GET', data: { bargainUid: owner } }))['data']);
  }
  if (getToken() !== token || positiveId(apiRecord(data['userInfo'])['uid']) !== viewerId) throw new ApiError('UNAUTHORIZED', '登录状态已变化，请刷新');
  const row = apiRecord(data['bargain']); const state = apiRecord(data['userBargainInfo']); const attr = apiRecord(row['attr']);
  if (positiveId(row['id']) !== id) throw new ApiError('BUSINESS', '砍价商品不匹配');
  const now = Date.now() / 1000;
  const remaining = apiAmount(state['price']);
  return { id, productId: positiveId(row['product_id']), title: apiText(row['title']), image: apiText(row['image']), price: apiAmount(row['price']), minimum: apiAmount(row['min_price']), remaining, reduced: apiAmount(state['alreadyPrice']), ownerId: owner, viewerId,
    action: bargainAction(state['bargainType'], owner === viewerId, Number(state['status']), remaining),
    available: Number(row['status']) === 1 && Number(row['product_is_show']) === 1 && Number(row['start_time']) <= now && Number(row['stop_time']) > now && Number(attr['quota']) > 0 && Number(attr['product_stock']) > 0,
  };
}
export async function startBargain(id: number): Promise<number> {
  const payload = await request<Readonly<{ data?: unknown }>>('/bargain/start', { method: 'POST', data: { bargainId: positiveId(id) } });
  return apiAmount(apiRecord(payload.data)['price']);
}
export async function helpBargain(id: number, ownerId: number): Promise<number> {
  const payload = await request<Readonly<{ data?: unknown }>>('/bargain/help', { method: 'POST', data: { bargainId: positiveId(id), bargainUserUid: positiveId(ownerId) } });
  return apiAmount(apiRecord(payload.data)['price']);
}
export type Pink = Readonly<{ id: number; item: MarketingItem; remaining: number; stopTime: number; joinable: boolean; orderId: string; message: string }>;
export async function getPink(id: number): Promise<Pink> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/combination/pink/${positiveId(id)}`, { method: 'GET' });
  const data = apiRecord(payload.data); const row = apiRecord(data['store_combination']); const leader = apiRecord(data['pinkT']);
  const remaining = Number(data['count']); const stopTime = Number(leader['stop_time']);
  if (!Number.isSafeInteger(remaining) || remaining < 0 || !Number.isFinite(stopTime)) throw new ApiError('BUSINESS', '拼团状态不完整，请刷新');
  const joined = Number(data['userBool']) === 1;
  const complete = Number(data['is_ok']) === 1 || Number(leader['status']) === 2 || remaining === 0;
  const expired = stopTime <= Date.now() / 1000 || Number(leader['status']) === 3 || Number(data['pinkBool']) === -1;
  const joinable = Number(data['userBool']) === 0 && Number(data['is_ok']) === 0 && Number(leader['status']) === 1 && Number(data['pinkBool']) === 0 && !expired && !complete;
  const variants = Object.entries(apiRecord(row['productValue'])).map(([label, value]): ProductVariant => {
    const sku = apiRecord(value); const stock = Math.min(Number(sku['stock']), Number(sku['quota']), Number(sku['product_stock']));
    if (!Number.isSafeInteger(stock) || stock < 0) throw new ApiError('BUSINESS', '拼团库存数据不完整');
    return { unique: apiId(sku['unique']), label, stock, price: apiAmount(sku['price']) };
  });
  return { id: positiveId(leader['id']), remaining, stopTime, joinable, orderId: apiText(data['current_pink_order']), message: joined ? '你已加入该团' : complete ? '该团已完成' : expired ? '该团已结束' : joinable ? `还差 ${remaining} 人成团` : '暂不可参团，请刷新核对',
    item: { id: positiveId(row['id']), productId: positiveId(row['product_id']), kind: 'combination', title: apiText(row['title']), image: apiText(row['image']), price: apiAmount(row['price']), variants, activityStatus: joinable ? 1 : 0 },
  };
}
export type PinkSummary = Readonly<{ id: number; name: string; remaining: number; stopTime: number }>;
export async function getOpenPinks(id: number): Promise<readonly PinkSummary[]> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/combination/detail/${positiveId(id)}`, { method: 'GET' });
  return apiItems(apiRecord(payload.data)['pink']).map((value) => {
    const row = apiRecord(value); const remaining = Number(row['count']); const stopTime = Number(row['stop_time']);
    if (!Number.isSafeInteger(remaining) || remaining < 0 || !Number.isFinite(stopTime)) throw new ApiError('BUSINESS', '拼团列表不完整');
    return { id: positiveId(row['id']), name: apiText(row['nickname']) || '团长', remaining, stopTime };
  }).filter((row) => row.remaining > 0 && row.stopTime > Date.now() / 1000);
}
