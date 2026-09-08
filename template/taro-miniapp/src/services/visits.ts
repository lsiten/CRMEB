import { ApiError, getToken, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type Visit = Readonly<{ id: string; productId: number; name: string; image: string; price: number | null; visitedAt: string }>;

export const isVisitDeleteEnabled = (): boolean => process.env['TARO_VISIT_DELETE_ENABLED'] === 'true';

export async function clearVisits(token: string | null = getToken()): Promise<void> {
  if (!isVisitDeleteEnabled()) throw new ApiError('BUSINESS', '清空浏览记录暂未开放');
  const checkAccount = (): void => {
    if (!token || token !== getToken()) throw new ApiError('UNAUTHORIZED', '登录状态已变化，请刷新后重试');
  };
  const ids = new Set<number>();
  for (let page = 1; ; page += 1) {
    checkAccount();
    const rows = await getVisits(page);
    checkAccount();
    const previousSize = ids.size;
    rows.forEach((row) => ids.add(row.productId));
    if (rows.length < 20) break;
    if (ids.size === previousSize) throw new ApiError('BUSINESS', '浏览记录分页异常，请刷新后重试');
  }
  checkAccount();
  if (ids.size) await request('/user/visit', { method: 'DELETE', data: { ids: [...ids] } });
  checkAccount();
}

export async function getVisits(page: number): Promise<readonly Visit[]> {
  if (!Number.isSafeInteger(page) || page < 1) throw new ApiError('BUSINESS', '记录页码无效');
  const response = apiRecord(await request<unknown>('/user/visit_list', { method: 'GET', data: { page, limit: 20 } }));
  const data = apiRecord(response['data']);
  return apiItems(data['list']).map((value) => {
    const row = apiRecord(value);
    const product = apiRecord(row['productInfo'] ?? row['product']);
    const productId = Number(row['product_id'] ?? product['id']);
    if (!Number.isSafeInteger(productId) || productId <= 0) throw new ApiError('BUSINESS', '浏览记录商品标识无效');
    const price = row['product_price'] ?? product['price'] ?? row['price'];
    return {
      id: apiId(row['id']), productId,
      name: apiText(product['store_name'] ?? row['store_name']),
      image: apiText(product['image'] ?? row['image']),
      price: price == null ? null : apiAmount(price),
      visitedAt: apiText(row['add_time'] ?? row['visit_time']),
    };
  });
}
