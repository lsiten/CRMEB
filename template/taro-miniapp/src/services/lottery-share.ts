import type { GeneralLotteryActivity } from './lottery';
import { ApiError, getToken } from './api';
import { getUserProfile } from './account';
import { buildSharePath } from './platform';

export type ShareActivity = Pick<GeneralLotteryActivity, 'id' | 'factor' | 'name' | 'image'>;
export type LotteryShare = Readonly<{ title: string; path: string; imageUrl: string; url?: string }>;

export async function getLotteryShare(activity: ShareActivity, pageUrl?: string): Promise<LotteryShare> {
  const token = getToken();
  if (!token) throw new ApiError('UNAUTHORIZED', '请先登录后邀请好友');
  const profile = await getUserProfile();
  if (getToken() !== token) throw new ApiError('UNAUTHORIZED', '登录状态已变化，请重新生成邀请');
  const path = buildSharePath('/pages/marketing/lottery', { type: String(activity.factor), lottery_id: activity.id, spread: String(profile?.uid ?? '') });
  const query = new URLSearchParams(path.split('?')[1]);
  if (!query.has('type') || !query.has('lottery_id') || !query.has('spread')) throw new ApiError('BUSINESS', '分享信息不完整，请重试');
  const share = { title: activity.name.trim() || '幸运抽奖', path, imageUrl: activity.image };
  if (pageUrl === undefined) return share;
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ApiError('BUSINESS', '当前地址不支持生成分享链接');
    url.username = ''; url.password = ''; url.search = ''; url.hash = path;
    const image = activity.image ? new URL(activity.image, url) : undefined;
    return { ...share, url: url.href, imageUrl: image && (image.protocol === 'https:' || image.protocol === 'http:') ? image.href : '' };
  } catch (error) {
    if (error instanceof TypeError) throw new ApiError('BUSINESS', '当前地址不支持生成分享链接');
    throw error;
  }
}
