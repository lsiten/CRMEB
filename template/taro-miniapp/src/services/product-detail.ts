import { ApiError, parseProducts, request } from './api';
import type { Product, ProductVariant } from './api';

const rowOf = (value: unknown): Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};

export async function getProduct(id: number): Promise<Product> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError('BUSINESS', '商品不存在');
  const payload = await request<Readonly<{ data?: unknown }>>(`/product/detail/${id}`, { method: 'GET' });
  const detail = rowOf(payload.data);
  const store = rowOf(detail['storeInfo']);
  const product = parseProducts({ data: store }, 1)[0];
  if (!product || product.id !== id) throw new ApiError('BUSINESS', '商品不存在');
  const variants = Object.entries(rowOf(detail['productValue'])).map(([label, value]): ProductVariant => {
    const row = rowOf(value);
    const unique = row['unique'];
    const price = Number(row['price']);
    const stock = Number(row['stock']);
    if (typeof unique !== 'string' || !unique || row['price'] == null || row['stock'] == null || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) {
      throw new ApiError('BUSINESS', '商品规格数据不完整，请重试');
    }
    const image = row['image'];
    return { unique, label, price, stock, ...(typeof image === 'string' && image ? { image } : {}) };
  });
  const description = store['description'];
  const unique = detail['spec_unique'];
  return {
    ...product, variants, specs: variants.map((variant) => variant.label),
    ...(typeof description === 'string' ? { description } : {}),
    ...(typeof unique === 'string' && unique ? { unique } : {}),
  };
}
