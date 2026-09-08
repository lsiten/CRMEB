import { ApiError, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type Visit = Readonly<{ id: string; productId: number; name: string; image: string; price: number | null; visitedAt: string }>;

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
