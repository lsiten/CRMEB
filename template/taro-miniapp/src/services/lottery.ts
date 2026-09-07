import { ApiError, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText, commerceError } from './commerce-contracts';

const prizeTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type PrizeType = typeof prizeTypes[number];
export const prizeLabels: Readonly<Record<PrizeType, string>> = { 1: '未中奖', 2: '积分', 3: '余额', 4: '红包', 5: '优惠券', 6: '实物奖品', 7: '等级经验', 8: '用户等级', 9: '会员天数' };
export type LotteryPrize = Readonly<{ id: string; type: PrizeType; name: string; image: string; prompt: string }>;
export type LotteryActivity = Readonly<{ id: string; name: string; chances: number; prizes: readonly LotteryPrize[] }>;
const lotteryFactors = [1, 2, 3, 4, 5] as const;
export type LotteryFactor = typeof lotteryFactors[number];
export type LotteryWinner = Readonly<{ id: string; nickname: string; prizeName: string; createdAt: string }>;
export type GeneralLotteryActivity = LotteryActivity & Readonly<{ factor: LotteryFactor; cost: number; image: string; rules: string; showPublicWinners: boolean; showPersonalWinners: boolean; publicNoticeWinners: readonly LotteryWinner[]; publicWinners: readonly LotteryWinner[]; personalWinners: readonly LotteryWinner[] }>;
export type LotteryResult = LotteryPrize & Readonly<{ recordId: string }>;
export type PrizeDelivery = Readonly<{ name: string; phone: string; address: string; detail: string; mark: string }>;
export type LotteryRecord = Readonly<{ id: string; lotteryId: string; prize: LotteryPrize; received: boolean; delivered: boolean; expressName: string; expressNumber: string; receivedAt: string; deliveredAt: string; transferState: string; transferOrderId: string; failReason: string }>;
export class LotteryDrawError extends Error {
  readonly uncertain: boolean;
  constructor(message: string, uncertain: boolean) { super(message); this.name = 'LotteryDrawError'; this.uncertain = uncertain; }
}
export class LotterySubscriptionError extends LotteryDrawError {
  readonly image: string;
  constructor(image: string) { super('请先关注公众号，再返回参与抽奖', false); this.name = 'LotterySubscriptionError'; this.image = image; }
}
function parsePrize(value: unknown): LotteryPrize {
  const row = apiRecord(value);
  const type = prizeTypes.find((candidate) => candidate === Number(row['type']));
  if (!type) throw new ApiError('BUSINESS', '奖品类型无效，请刷新活动');
  return { id: apiId(row['id']), type, name: apiText(row['name']), image: apiText(row['image']), prompt: apiText(row['prompt']) };
}
function parseWinner(value: unknown): LotteryWinner {
  const row = apiRecord(value);
  return { id: apiId(row['id']), nickname: apiText(apiRecord(row['user'])['nickname']), prizeName: apiText(apiRecord(row['prize'])['name']), createdAt: apiText(row['add_time']) };
}
export async function getReviewLottery(): Promise<GeneralLotteryActivity> {
  return getLotteryActivity(4);
}
export async function getLotteryActivity(factor: LotteryFactor, activityId?: string): Promise<GeneralLotteryActivity> {
  const suffix = activityId === undefined ? '' : `/${apiId(activityId)}`;
  const envelope = apiRecord(await request<unknown>(`/v2/lottery/info/${factor}${suffix}`, { method: 'GET' }));
  const data = apiRecord(envelope['data']); const row = apiRecord(data['lottery']);
  const rawChances = data['lottery_num'];
  const chances = typeof rawChances === 'number' || typeof rawChances === 'string' && rawChances.trim() ? Number(rawChances) : NaN;
  const actualFactor = lotteryFactors.find((candidate) => candidate === Number(row['factor']));
  if (!Number.isSafeInteger(chances) || chances < 0 || !actualFactor || activityId === undefined && actualFactor !== factor) throw new ApiError('BUSINESS', '抽奖资格信息不完整，请重试');
  const cost = actualFactor === 1 || actualFactor === 2 ? apiAmount(row['factor_num']) : 0;
  return { id: apiId(row['id']), name: apiText(row['name']), chances, prizes: apiItems(row['prize']).map(parsePrize), factor: actualFactor, cost,
    image: apiText(row['image']), rules: Number(row['is_content']) === 1 ? apiText(row['content']) : '',
    showPublicWinners: Number(row['is_all_record']) === 1, showPersonalWinners: Number(row['is_personal_record']) === 1,
    publicNoticeWinners: ('all_record' in data ? apiItems(data['all_record']) : []).map(parseWinner), publicWinners: Number(row['is_all_record']) === 1 ? ('all_record' in data ? apiItems(data['all_record']) : []).map(parseWinner) : [], personalWinners: Number(row['is_personal_record']) === 1 ? ('user_record' in data ? apiItems(data['user_record']) : []).map(parseWinner) : [] };
}
export async function drawLottery(activityId: string, factor?: LotteryFactor): Promise<LotteryResult> {
  const id = apiId(activityId);
  let response: unknown;
  try { response = await request<unknown>('/v2/lottery', { method: 'POST', data: factor === undefined ? { id } : { id, type: factor } }); }
  catch (cause) {
    const uncertain = !(cause instanceof ApiError && (cause.code === 'BUSINESS' || cause.code === 'UNAUTHORIZED'));
    throw new LotteryDrawError(commerceError(cause), uncertain);
  }
  const row = apiRecord(apiRecord(response)['data']);
  if (row['code'] === 'subscribe') throw new LotterySubscriptionError(apiText(row['url']));
  try {
    return { ...parsePrize(row), recordId: apiId(row['lottery_record_id']) };
  } catch { throw new LotteryDrawError('抽奖结果未能确认，请先查看中奖记录', true); }
}
export async function getLotteryRecords(page: number): Promise<readonly LotteryRecord[]> {
  if (!Number.isSafeInteger(page) || page < 1) throw new ApiError('BUSINESS', '记录页码无效');
  const response = apiRecord(await request<unknown>('/v2/lottery/record', { method: 'GET', data: { page, limit: 20 } }));
  return apiItems(response['data']).map((value) => {
    const row = apiRecord(value); const delivery = apiRecord(row['deliver_info']);
    return { id: apiId(row['id']), lotteryId: apiId(row['lottery_id']), prize: parsePrize(row['prize']), received: Number(row['is_receive']) === 1, delivered: Number(row['is_deliver']) === 1, expressName: apiText(delivery['deliver_name']), expressNumber: apiText(delivery['deliver_number']), receivedAt: apiText(row['receive_time']), deliveredAt: apiText(row['deliver_time']), transferState: apiText(row['state']), transferOrderId: apiText(row['wechat_order_id']), failReason: apiText(row['fail_reason']) };
  });
}
export async function receiveLotteryPrize(recordId: string, delivery: PrizeDelivery): Promise<void> {
  const name = delivery.name.trim(); const phone = delivery.phone.trim(); const address = delivery.address.trim();
  if (!name || !/^1[3-9]\d{9}$/.test(phone) || !address) throw new ApiError('BUSINESS', '请填写收货人、有效手机号和完整地址');
  await request<unknown>('/v2/lottery/receive', { method: 'POST', data: { id: apiId(recordId), name, phone, address, detail: delivery.detail.trim(), mark: delivery.mark.trim() } });
}
