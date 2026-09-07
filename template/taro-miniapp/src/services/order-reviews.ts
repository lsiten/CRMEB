import { ApiError, request } from './api';
import { apiAmount, apiId, apiRecord, apiText } from './commerce-contracts';

export type ReviewProduct = Readonly<{ unique: string; orderId: string; name: string; spec: string; image: string; price: number; quantity: number }>;
export type ReviewInput = Readonly<{ unique: string; comment: string; productScore: number; serviceScore: number; images: readonly string[] }>;

export async function getReviewProduct(unique: string): Promise<ReviewProduct> {
  const response = apiRecord(await request<unknown>('/order/product', { method: 'POST', data: { unique: apiId(unique) } }));
  const row = apiRecord(response['data']); const product = apiRecord(row['productInfo']); const attr = apiRecord(product['attrInfo']);
  const name = apiText(product['store_name']); const quantity = Number(row['cart_num']);
  if (!name || !Number.isSafeInteger(quantity) || quantity < 1) throw new ApiError('BUSINESS', '评价商品信息不完整，请重试');
  return { unique, orderId: apiId(row['order_id']), name, spec: apiText(attr['suk']), image: apiText(attr['image']) || apiText(product['image']), price: apiAmount(attr['price'] ?? product['price']), quantity };
}

export async function submitOrderReview(input: ReviewInput): Promise<Readonly<{ lotteryAvailable: boolean }>> {
  if (!input.comment.trim()) throw new ApiError('BUSINESS', '请填写商品评价');
  if (![input.productScore, input.serviceScore].every((score) => Number.isSafeInteger(score) && score >= 1 && score <= 5)) throw new ApiError('BUSINESS', '请为商品和服务分别评分');
  if (input.images.length > 8 || input.images.some((url) => !/^https?:\/\//i.test(url))) throw new ApiError('BUSINESS', '最多上传8张有效图片');
  const response = apiRecord(await request<unknown>('/order/comment', { method: 'POST', data: { unique: apiId(input.unique), comment: input.comment.trim(), product_score: input.productScore, service_score: input.serviceScore, pics: [...input.images] } }));
  const flag = apiRecord(response['data'])['to_lottery'];
  return { lotteryAvailable: flag === true || flag === 1 };
}
