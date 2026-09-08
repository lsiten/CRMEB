import { ApiError, request } from './api';
import { apiAmount, apiItems, apiRecord, apiText } from './commerce-contracts';

export type Favorite = Readonly<{
  id: string; productId: number; category: string; name: string; image: string; price: number; available: boolean;
}>;

export async function getFavorites(page: number): Promise<Readonly<{ items: readonly Favorite[]; hasMore: boolean }>> {
  if (!Number.isSafeInteger(page) || page < 1) throw new ApiError('BUSINESS', '收藏页码无效');
  const response = apiRecord(await request<unknown>('/collect/user', { method: 'GET', data: { page, limit: 20 } }));
  const data = apiRecord(response['data']);
  const rawList = data['list'];
  const count = Number(data['count']);
  if (!Number.isSafeInteger(count) || count < 0) throw new ApiError('BUSINESS', '收藏分页数据无效');
  // PHP preserves numeric keys after filtering deleted product relations.
  const sparse = apiRecord(rawList);
  const values: readonly unknown[] = Array.isArray(rawList) ? rawList : rawList && typeof rawList === 'object' && Object.keys(sparse).every((key) => /^\d+$/.test(key)) ? Object.values(sparse) : apiItems(rawList);
  const items = values.map((value) => {
    const row = apiRecord(value);
    const productId = Number(row['product_id']);
    if (!Number.isSafeInteger(productId) || productId <= 0) throw new ApiError('BUSINESS', '收藏商品标识无效');
    const category = apiText(row['category']) || 'product';
    return {
      id: `${category}:${productId}`, productId, category,
      name: apiText(row['store_name']), image: apiText(row['image']), price: apiAmount(row['price']),
      available: Number(row['is_show']) === 1 && Number(row['is_del']) === 0,
    };
  });
  return { items, hasMore: page * 20 < count };
}

export async function setFavorite(productId: number, collected: boolean): Promise<void> {
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new ApiError('BUSINESS', '收藏商品标识无效');
  await request(collected ? '/collect/add' : '/collect/del', {
    method: 'POST', data: { id: collected ? productId : [productId], category: 'product' },
  });
}

export async function removeFavorite(item: Favorite): Promise<void> {
  await request('/collect/del', { method: 'POST', data: { id: [item.productId], category: item.category } });
}
