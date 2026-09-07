import { ApiError, request } from './api';
import { apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type ReviewFilter = 0 | 1 | 2 | 3;
export type ReviewSummary = Readonly<{ total: number; good: number; normal: number; poor: number; score: number; positiveRate: number }>;
export type ProductReview = Readonly<{ id: string; nickname: string; avatar: string; score: number; createdAt: string; spec: string; comment: string; images: readonly string[]; member: boolean; merchantReply: string }>;
function bounded(value: unknown, maximum: number, integer = false): number {
  const number = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0 || number > maximum || integer && !Number.isInteger(number)) throw new ApiError('BUSINESS', '评价数据不完整，请重试');
  return number;
}
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const response = apiRecord(await request<unknown>(`/reply/config/${apiId(productId)}`, { method: 'GET' }));
  const row = apiRecord(response['data']);
  return {
    total: bounded(row['sum_count'], Number.MAX_SAFE_INTEGER, true), good: bounded(row['good_count'], Number.MAX_SAFE_INTEGER, true),
    normal: bounded(row['in_count'], Number.MAX_SAFE_INTEGER, true), poor: bounded(row['poor_count'], Number.MAX_SAFE_INTEGER, true),
    score: bounded(row['reply_star'], 5), positiveRate: bounded(row['reply_chance'], 100),
  };
}
export async function getProductReviews(productId: string, filter: ReviewFilter, page: number): Promise<readonly ProductReview[]> {
  const id = apiId(productId);
  if (!Number.isInteger(page) || page < 1) throw new ApiError('BUSINESS', '评价页码无效');
  const data = await request<unknown>(`/reply/list/${id}`, { method: 'GET', data: { page, limit: 20, type: filter } });
  return apiItems(apiRecord(data)['data']).map((value) => {
    const row = apiRecord(value);
    const images = row['pics'] === null || row['pics'] === undefined ? [] : apiItems(row['pics']).map(apiText).filter(Boolean);
    return { id: apiId(row['id']), nickname: apiText(row['nickname']), avatar: apiText(row['avatar']), score: bounded(row['star'], 5), createdAt: apiText(row['add_time']), spec: apiText(row['suk']), comment: apiText(row['comment']), images, member: Number(row['is_money_level']) > 0, merchantReply: apiText(row['merchant_reply_content']) };
  });
}
