import { ApiError, request } from './api';
import type { ProductVariant } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type MarketingKind = 'seckill' | 'combination' | 'bargain' | 'advance' | 'lottery' | 'coupon' | 'member' | 'red-packet' | 'sign' | 'gift';
export type MarketingItem = Readonly<{ id: number; productId?: number; title: string; image?: string; price?: number; originalPrice?: number; stock?: number; endsAt?: string; kind: MarketingKind; factor?: 1 | 2 | 3 | 4 | 5; activityStatus?: number; variants?: readonly ProductVariant[] }>;
type MarketingPayload = Readonly<{ data?: unknown; list?: unknown }>;

const endpoints: Readonly<Record<MarketingKind, string>> = {
  seckill: '/seckill/list', combination: '/combination/list', bargain: '/bargain/list', advance: '/advance/list', lottery: '/lottery/info/0', coupon: '/coupons', member: '/user/member/coupons/list', 'red-packet': '/user/activity', sign: '/sign/config', gift: '/user/activity',
};
export const labels: Readonly<Record<MarketingKind, string>> = {
  seckill: '限时秒杀', combination: '拼团/组合', bargain: '砍价活动', advance: '预售专场', lottery: '幸运抽奖', coupon: '优惠券', member: '会员/VIP', 'red-packet': '红包福利', sign: '每日签到', gift: '赠品活动',
};

function records(payload: MarketingPayload): readonly Record<string, unknown>[] {
  const value = payload.data ?? payload.list;
  const list = Array.isArray(value) ? value : value && typeof value === 'object' && 'list' in value && Array.isArray(value.list) ? value.list : value && typeof value === 'object' ? [value] : [];
  return list.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
}

function normalize(record: Record<string, unknown>, kind: MarketingKind): MarketingItem {
  const id = Number(record['id'] ?? record['activity_id'] ?? record['product_id']);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError('BUSINESS', '活动缺少有效标识');
  const product = record['productInfo'];
  const nestedProductId = product && typeof product === 'object' && 'id' in product ? Number((product as Record<string, unknown>)['id']) : 0;
  const productId = Number(record['product_id'] ?? nestedProductId);
  const title = String(record['title'] ?? record['name'] ?? record['store_name'] ?? labels[kind]);
  const imageValue = record['image'] ?? record['image_input'];
  const priceValue = Number(record['price'] ?? record['activity_price'] ?? record['price_start']);
  const originalValue = Number(record['ot_price'] ?? record['original_price'] ?? record['product_price']);
  const stockValue = Number(record['stock'] ?? record['stock_num']);
  const item: { id: number; title: string; kind: MarketingKind; factor?: 1 | 2 | 3 | 4 | 5; image?: string; price?: number; originalPrice?: number; stock?: number; productId?: number; endsAt?: string } = { id, title, kind };
  if (typeof imageValue === 'string' && imageValue) item.image = imageValue;
  if (Number.isFinite(priceValue)) item.price = priceValue;
  if (Number.isFinite(originalValue)) item.originalPrice = originalValue;
  if (Number.isFinite(stockValue)) item.stock = stockValue;
  if (Number.isSafeInteger(productId) && productId > 0) item.productId = productId;
  const factor = Number(record['factor'] ?? record['lottery_factor']); if (kind === 'lottery' && [1,2,3,4,5].includes(factor)) item.factor = factor as 1 | 2 | 3 | 4 | 5;
  const end = record['end_time'] ?? record['stop_time'] ?? record['end_at'] ?? record['endTime'];
  if (typeof end === 'string' && end) item.endsAt = end;
  return item;
}

export async function getMarketingItems(kind: MarketingKind): Promise<readonly MarketingItem[]> {
  let payload: MarketingPayload;
  if (kind === 'seckill') {
    const schedule = await getSeckillSchedule();
    const time = schedule.selectedId;
    if (time === null) return [];
    payload = await request<MarketingPayload>(`/seckill/list/${time}`, { method: 'GET' });
  } else payload = await request<MarketingPayload>(endpoints[kind], { method: 'GET' });
  return records(payload).flatMap((record) => { try { return [normalize(record, kind)]; } catch { return []; } });
}

export type CatalogKind = 'seckill' | 'combination' | 'bargain';
export type SeckillPeriod = Readonly<{ id: number; time: string; state: string; status: number }>;
export async function getSeckillSchedule() {
  const payload = apiRecord(await request<unknown>('/seckill/index', { method: 'GET' }));
  const data = apiRecord(payload['data']);
  const periods = apiItems(data['seckillTime']).map((value): SeckillPeriod => {
    const row = apiRecord(value);
    const id = Number(row['id']);
    const status = Number(row['status']);
    if (!Number.isSafeInteger(id) || id <= 0 || ![0, 1, 2].includes(status)) throw new ApiError('BUSINESS', '秒杀场次数据不完整，请重试');
    return { id, status, time: apiText(row['time']), state: apiText(row['state']) };
  });
  const selected = periods[Number(data['seckillTimeIndex'])] ?? periods[0];
  return { periods, selectedId: selected?.id ?? null };
}

export async function getMarketingPage(kind: CatalogKind, page: number, periodId?: number) {
  if (!Number.isSafeInteger(page) || page < 1) throw new ApiError('BUSINESS', '活动页码无效');
  if (kind === 'seckill' && (!Number.isSafeInteger(periodId) || !periodId || periodId < 1)) throw new ApiError('BUSINESS', '请选择秒杀场次');
  const path = kind === 'seckill' ? `/seckill/list/${periodId}` : endpoints[kind];
  const payload = apiRecord(await request<unknown>(path, { method: 'GET', data: { page, limit: 20 } }));
  const rows = apiItems(payload['data']);
  const items = rows.map((value) => {
    const row = apiRecord(value);
    const activity = normalize(Object.fromEntries(Object.entries(row)), kind);
    return { id: String(activity.id), activity };
  });
  return { items, hasMore: rows.length >= 20 };
}

export async function getMarketingDetail(kind: MarketingKind, id: number, periodId?: number): Promise<MarketingItem> {
  const selectedPeriod = kind === 'seckill' && (!periodId || periodId < 1) ? (await getSeckillSchedule()).selectedId : periodId;
  const path = kind === 'seckill' ? `/seckill/detail/${id}` : kind === 'combination' ? `/combination/detail/${id}` : kind === 'bargain' ? `/bargain/detail/${id}` : kind === 'advance' ? `/advance/detail/${id}` : kind === 'lottery' ? `/lottery/info/0/${id}` : `/product/detail/${id}`;
  const payload = await request<MarketingPayload>(path, { method: 'GET', ...(kind === 'seckill' && selectedPeriod ? { data: { time_id: selectedPeriod } } : {}) });
  const detail = apiRecord(payload.data);
  const item = kind === 'seckill' || kind === 'combination' ? apiRecord(detail['storeInfo']) : kind === 'bargain' ? apiRecord(detail['bargain']) : records(payload)[0];
  if (!item) throw new ApiError('BUSINESS', '活动不存在');
  const activity = normalize(item, kind);
  if (kind !== 'seckill' && kind !== 'combination') return activity;
  const variants = Object.entries(apiRecord(detail['productValue'])).map(([label, value]): ProductVariant => {
    const row = apiRecord(value);
    const stock = Math.min(Number(row['stock']), Number(row['quota'] ?? row['stock']), Number(row['product_stock'] ?? row['stock']));
    if (!Number.isSafeInteger(stock) || stock < 0) throw new ApiError('BUSINESS', '活动库存数据不完整，请重试');
    return { unique: apiId(row['unique']), label, price: apiAmount(row['price']), stock };
  });
  const now = Math.floor(Date.now() / 1000);
  const start = Number(item['start_time']);
  const stop = Number(item['stop_time']);
  const activityStatus = kind === 'seckill' ? Number(item['status']) : Number(item['is_show']) !== 1 || Number(item['is_del']) === 1 ? 0 : start > now ? 2 : start <= now && stop >= now ? 1 : 0;
  const quota = Number(item['quota']);
  return { ...activity, ...(Number.isFinite(quota) && quota >= 0 ? { stock: Math.min(activity.stock ?? quota, quota) } : {}), activityStatus, variants };
}
