import { ApiError, request } from './api';

export type MarketingKind = 'seckill' | 'combination' | 'bargain' | 'advance' | 'lottery' | 'coupon' | 'member' | 'red-packet' | 'sign';
export type MarketingItem = Readonly<{
  id: number;
  title: string;
  image?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  endsAt?: string;
  kind: MarketingKind;
}>;
export type MarketingPayload = Readonly<{ data?: unknown; list?: unknown }>;

const endpoints: Readonly<Record<MarketingKind, string>> = {
  seckill: '/seckill/list/0', combination: '/combination/list', bargain: '/bargain/list', advance: '/advance/list',
  lottery: '/lottery/info/index', coupon: '/coupons', member: '/user/member/coupons/list', 'red-packet': '/red_packet/list', sign: '/sign/config',
};

const labels: Readonly<Record<MarketingKind, string>> = {
  seckill: '限时秒杀', combination: '拼团/组合', bargain: '砍价活动', advance: '预售专场', lottery: '幸运抽奖', coupon: '优惠券', member: '会员/VIP', 'red-packet': '红包福利', sign: '每日签到',
};

function records(payload: MarketingPayload): readonly Record<string, unknown>[] {
  const value = payload.data ?? payload.list;
  const list = Array.isArray(value) ? value : value && typeof value === 'object' && 'list' in value && Array.isArray(value.list) ? value.list : [];
  return list.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
}

function normalize(record: Record<string, unknown>, kind: MarketingKind, index: number): MarketingItem {
  const id = Number(record['id'] ?? record['product_id'] ?? index + 1);
  const title = String(record['title'] ?? record['name'] ?? record['store_name'] ?? labels[kind]);
  const image = typeof record['image'] === 'string' ? record['image'] : typeof record['image_input'] === 'string' ? record['image_input'] : undefined;
  const priceValue = Number(record['price'] ?? record['activity_price'] ?? record['price_start']);
  const originalValue = Number(record['ot_price'] ?? record['original_price'] ?? record['product_price']);
  const stockValue = Number(record['stock'] ?? record['stock_num']);
  return { id: Number.isSafeInteger(id) && id > 0 ? id : index + 1, title, image, price: Number.isFinite(priceValue) ? priceValue : undefined, originalPrice: Number.isFinite(originalValue) ? originalValue : undefined, stock: Number.isFinite(stockValue) ? stockValue : undefined, kind };
}

export async function getMarketingItems(kind: MarketingKind): Promise<readonly MarketingItem[]> {
  const payload = await request<MarketingPayload>(endpoints[kind], { method: 'GET' });
  return records(payload).map((record, index) => normalize(record, kind, index));
}

export async function getMarketingDetail(kind: MarketingKind, id: number): Promise<MarketingItem> {
  const path = kind === 'seckill' ? `/seckill/detail/${id}` : kind === 'combination' ? `/combination/detail/${id}` : kind === 'bargain' ? `/bargain/detail/${id}` : kind === 'advance' ? `/advance/detail/${id}` : `/product/detail/${id}`;
  const payload = await request<MarketingPayload>(path, { method: 'GET' });
  const item = records(payload)[0];
  if (!item) throw new ApiError('BUSINESS', '活动不存在');
  return normalize(item, kind, 0);
}
