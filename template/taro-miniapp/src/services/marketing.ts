import { ApiError, request } from './api';

export type MarketingKind = 'seckill' | 'combination' | 'bargain' | 'advance' | 'lottery' | 'coupon' | 'member' | 'red-packet' | 'sign' | 'gift';
export type MarketingItem = Readonly<{ id: number; productId?: number; title: string; image?: string; price?: number; originalPrice?: number; stock?: number; endsAt?: string; kind: MarketingKind }>;
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
  const item: { id: number; title: string; kind: MarketingKind; image?: string; price?: number; originalPrice?: number; stock?: number; productId?: number; endsAt?: string } = { id, title, kind };
  if (typeof imageValue === 'string' && imageValue) item.image = imageValue;
  if (Number.isFinite(priceValue)) item.price = priceValue;
  if (Number.isFinite(originalValue)) item.originalPrice = originalValue;
  if (Number.isFinite(stockValue)) item.stock = stockValue;
  if (Number.isSafeInteger(productId) && productId > 0) item.productId = productId;
  const end = record['end_time'] ?? record['stop_time'] ?? record['end_at'] ?? record['endTime'];
  if (typeof end === 'string' && end) item.endsAt = end;
  return item;
}

export async function getMarketingItems(kind: MarketingKind): Promise<readonly MarketingItem[]> {
  let payload: MarketingPayload;
  if (kind === 'seckill') {
    const periods = await request<MarketingPayload>('/seckill/index', { method: 'GET' });
    const period = records(periods)[0];
    const time = period ? Number(period['id'] ?? period['time'] ?? period['time_id']) : NaN;
    if (!Number.isSafeInteger(time) || time <= 0) return [];
    payload = await request<MarketingPayload>(`/seckill/list/${time}`, { method: 'GET' });
  } else payload = await request<MarketingPayload>(endpoints[kind], { method: 'GET' });
  return records(payload).flatMap((record) => { try { return [normalize(record, kind)]; } catch { return []; } });
}

export async function getMarketingDetail(kind: MarketingKind, id: number): Promise<MarketingItem> {
  const path = kind === 'seckill' ? `/seckill/detail/${id}` : kind === 'combination' ? `/combination/detail/${id}` : kind === 'bargain' ? `/bargain/detail/${id}` : kind === 'advance' ? `/advance/detail/${id}` : kind === 'lottery' ? `/lottery/info/0/${id}` : `/product/detail/${id}`;
  const payload = await request<MarketingPayload>(path, { method: 'GET' });
  const item = records(payload)[0];
  if (!item) throw new ApiError('BUSINESS', '活动不存在');
  return normalize(item, kind);
}
