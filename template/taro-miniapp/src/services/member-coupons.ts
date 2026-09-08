import { getToken, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type MemberCoupon = Readonly<{
  id: string; title: string; amount: number; minPrice: number;
  status: string; scope: string; startsAt: string; endsAt: string;
}>;

export async function getMemberCoupons(): Promise<readonly MemberCoupon[]> {
  if (!getToken()) return [];
  const payload = apiRecord(await request<unknown>('/user/member/coupons/list', { method: 'GET' }));
  return apiItems(payload['data']).map((value) => {
    const row = apiRecord(value);
    return {
      id: apiId(row['id']), title: apiText(row['coupon_title']) || '会员优惠券',
      amount: apiAmount(row['coupon_price']), minPrice: apiAmount(row['use_min_price']),
      status: apiText(row['_msg']) || apiText(row['status']) || '状态待确认',
      scope: Number(row['applicable_type']) === 0 ? '通用券' : Number(row['applicable_type']) === 1 ? '品类券' : '商品券',
      startsAt: apiText(row['add_time']), endsAt: apiText(row['end_time']),
    };
  });
}
