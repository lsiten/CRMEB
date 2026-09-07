import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'test', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { drawLottery, getLotteryActivity, getReviewLottery, getLotteryRecords, receiveLotteryPrize } from '../src/services/lottery';
const prize = { id: 9, lottery_id: 2, type: 6, name: '咖啡礼盒', image: '/coffee.png', prompt: '恭喜中奖', num: 1 };
const respond = (data: unknown) => platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } });
beforeEach(() => vi.clearAllMocks());
it('uses the review qualification and real remaining chances when loading the activity', async () => {
  respond({ lottery: { id: 2, name: '评价赠礼', factor: 4, prize: [prize] }, lottery_num: '2' });
  await expect(getReviewLottery()).resolves.toMatchObject({ id: '2', chances: 2, prizes: [{ id: '9', type: 6 }] });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/v2/lottery/info/4') }));
});
it('keeps server prize and record identities distinct after drawing', async () => {
  respond({ ...prize, lottery_record_id: 321 });
  await expect(drawLottery('2')).resolves.toMatchObject({ id: '9', recordId: '321', type: 6 });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', data: { id: '2' } }));
});
it('flags an uncertain outcome after transport failure rather than encouraging a duplicate draw', async () => {
  platform.request.mockRejectedValue(new Error('timeout'));
  await expect(drawLottery('2')).rejects.toMatchObject({ uncertain: true });
});
it('flags a malformed successful response as uncertain because the chance may be consumed', async () => {
  respond({ id: 9 });
  await expect(drawLottery('2')).rejects.toMatchObject({ uncertain: true });
});
it('allows recovery from an explicit business rejection without claiming a prize', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '次数不足' } });
  await expect(drawLottery('2')).rejects.toMatchObject({ uncertain: false });
});
it('normalizes unclaimed physical prizes and shipping information in paged records', async () => {
  respond([{ id: 321, lottery_id: 2, type: 6, is_receive: 0, is_deliver: 1, deliver_info: { deliver_name: '测试快递', deliver_number: 'QA123' }, prize }]);
  await expect(getLotteryRecords(2)).resolves.toMatchObject([{ id: '321', lotteryId: '2', received: false, delivered: true, expressName: '测试快递', expressNumber: 'QA123', prize: { id: '9' } }]);
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { page: 2, limit: 20 } }));
});
it('submits physical delivery details against the record id when claiming a prize', async () => {
  respond('领取成功');
  await receiveLotteryPrize('321', { name: '测试用户', phone: '13800000000', address: '浙江省嘉兴市测试地址', detail: '', mark: '' });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/v2/lottery/receive'), method: 'POST', data: { id: '321', name: '测试用户', phone: '13800000000', address: '浙江省嘉兴市测试地址', detail: '', mark: '' } }));
});
it('does not submit an incomplete delivery address', async () => {
  await expect(receiveLotteryPrize('321', { name: '', phone: 'abc', address: '', detail: '', mark: '' })).rejects.toMatchObject({ code: 'BUSINESS' });
  expect(platform.request).not.toHaveBeenCalled();
});
it('rejects activity metadata without valid chances rather than fabricating eligibility', async () => {
  respond({ lottery: { id: 2, factor: 4, prize: [prize] }, lottery_num: -1 });
  await expect(getReviewLottery()).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('retains pending and failed transfer states rather than claiming red packets were received', async () => {
  respond([{ id: 322, lottery_id: 2, type: 4, is_receive: 1, state: 'WAIT_USER_CONFIRM', wechat_order_id: 'hb123', prize: { ...prize, type: 4 } }]);
  await expect(getLotteryRecords(1)).resolves.toMatchObject([{ transferState: 'WAIT_USER_CONFIRM', transferOrderId: 'hb123' }]);
});

it.each([{ factor: 1, cost: 15 }, { factor: 2, cost: 15 }, { factor: 3, cost: 0 }, { factor: 4, cost: 0 }, { factor: 5, cost: 0 }] as const)('loads server eligibility for $factor when selecting a general activity', async ({ factor, cost }) => {
  // Given
  respond({ lottery: { id: 72, factor, factor_num: 15, prize: [prize] }, lottery_num: 3 });
  // When
  const result = await getLotteryActivity(factor, '72');
  // Then
  expect(result).toMatchObject({ id: '72', factor, cost, chances: 3 });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/v2/lottery/info/' + factor + '/72') }));
});
it('uses the actual server factor when a specific activity overrides the link factor', async () => {
  // Given
  respond({ lottery: { id: 72, factor: 1, factor_num: 10, prize: [prize] }, lottery_num: 3 });
  // When
  const result = await getLotteryActivity(3, '72');
  // Then
  expect(result.factor).toBe(1);
});
it('rejects mismatched qualification when no specific activity was requested', async () => {
  // Given
  respond({ lottery: { id: 72, factor: 1, factor_num: 10, prize: [prize] }, lottery_num: 3 });
  // When / Then
  await expect(getLotteryActivity(4)).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('rejects invalid explicit activity ids before network access', async () => {
  // Given / When / Then
  await expect(getLotteryActivity(1, '../bad')).rejects.toMatchObject({ code: 'BUSINESS' });
  expect(platform.request).not.toHaveBeenCalled();
});
it('transmits the qualification type for subscription-gated draws', async () => {
  // Given
  respond({ ...prize, lottery_record_id: 321 });
  // When
  await drawLottery('72', 5);
  // Then
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { id: '72', type: 5 } }));
});
it('exposes a subscription challenge without reporting a consumed uncertain draw', async () => {
  // Given
  respond({ code: 'subscribe', url: 'https://example.com/subscribe.png' });
  // When / Then
  await expect(drawLottery('72', 5)).rejects.toMatchObject({ name: 'LotterySubscriptionError', uncertain: false, image: 'https://example.com/subscribe.png' });
});
it('preserves configured rules, banner and winning records for a general activity', async () => {
  // Given
  respond({ lottery: { id: 72, factor: 1, factor_num: 10, prize: [prize], image: '/banner.png', content: '<p>Rule</p>', is_content: 1, is_all_record: 1, is_personal_record: 1 }, lottery_num: 2,
    all_record: [{ id: 31, user: { nickname: 'Alice' }, prize: { name: 'Coffee' }, add_time: '2026-09-06 10:00' }], user_record: [{ id: 32, prize: { name: 'Points' }, add_time: '2026-09-06 11:00' }] });
  // When
  const result = await getLotteryActivity(1);
  // Then
  expect(result).toMatchObject({ image: '/banner.png', rules: '<p>Rule</p>', publicWinners: [{ id: '31', nickname: 'Alice', prizeName: 'Coffee', createdAt: '2026-09-06 10:00' }], personalWinners: [{ id: '32', prizeName: 'Points' }] });
});
it('honors disabled presentation sections even when the response includes their data', async () => {
  // Given
  respond({ lottery: { id: 72, factor: 3, prize: [prize], content: '<p>Hidden</p>', is_content: 0, is_all_record: 0, is_personal_record: 0 }, lottery_num: 1, all_record: [{ id: 31 }], user_record: [{ id: 32 }] });
  // When
  const result = await getLotteryActivity(3);
  // Then
  expect(result).toMatchObject({ rules: '', publicWinners: [], personalWinners: [] });
});
