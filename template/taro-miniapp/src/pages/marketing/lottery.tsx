import { Button, RichText, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { Modal } from '../../components/modal';
import { PrizeClaim } from '../../components/prize-claim';
import { LotteryGrid } from '../../components/lottery-grid';
import { LotterySharePanel } from '../../components/lottery-share';
import { useLottery } from '../../state/lottery';
import { useLotteryMotion } from '../../state/lottery-motion';
import { prizeLabels } from '../../services/lottery';
import type { GeneralLotteryActivity, LotteryFactor, LotteryWinner } from '../../services/lottery';
import '../order/management.scss';
import './lottery.scss';
import lotteryClick from '../../assets/lottery-click.png';
import fontLeft from '../../assets/font-left.png';
import fontRight from '../../assets/font-right.png';

const factors = [1, 2, 3, 4, 5] as const;
function participation(activity: GeneralLotteryActivity): string {
  switch (activity.factor) {
    case 1: return `每次消耗 ${activity.cost} 积分`;
    case 2: return `每次消耗 ¥${activity.cost.toFixed(2)} 余额`;
    case 3: return '支付订单赠送抽奖机会';
    case 4: return '评价订单赠送抽奖机会';
    case 5: return '参与活动获取抽奖机会';
    default: { const exhaustive: never = activity.factor; return exhaustive; }
  }
}
function Winners({ title, winners, personal = false }: Readonly<{ title: string; winners: readonly LotteryWinner[]; personal?: boolean }>) {
  if (!winners.length) return null;
  return <View className='lottery-record-panel'><View className='lottery-record-title'><CommerceImage className='lottery-record-decor-image' src={fontLeft} mode='aspectFit' /><Text className='order-section-title'>{title}</Text><CommerceImage className='lottery-record-decor-image' src={fontRight} mode='aspectFit' /></View><View className='lottery-record-head'><Text>{personal ? '序号' : '昵称'}</Text><Text>奖品名称</Text><Text>获奖时间</Text></View><View className='lottery-record-scroll'>{winners.map((winner, index) => <View className='lottery-winner-row' key={winner.id}><Text>{personal ? index + 1 : winner.nickname || '**'}</Text><Text>{winner.prizeName}</Text><Text className='order-muted'>{winner.createdAt}</Text></View>)}</View></View>;
}
function LotteryContent({ factor, activityId }: Readonly<{ factor: LotteryFactor; activityId?: string }>) {
  const state = useLottery(activityId ? { factor, activityId } : { factor });
  const activity = state.activity.data;
  const spin = useLotteryMotion(state.result, activity?.prizes ?? []);
  const reduced = spin.reduced;
  const records = () => Taro.navigateTo({ url: '/pages/marketing/lottery-records' });
  const close = () => { void state.dismiss(); };
  const result = state.result;
  const busy = state.phase === 'drawing' || spin.settling;
  return <View className='lottery-skin lottery-page lottery-general'>
    <Text className='order-heading'>{activity?.name || '幸运抽奖'}</Text>
    <View className='order-actions'><Button onClick={records}>我的中奖记录</Button><Button onClick={spin.toggle}>{reduced ? '开启动画' : '减少动画'}</Button></View>
    {state.activity.error && <View className='order-alert'><Text>{state.activity.error}</Text><Button disabled={state.activity.loading || busy} onClick={() => void state.activity.reload()}>重新加载活动</Button></View>}
    {state.activity.loading && !activity && <View className='order-panel'>正在加载活动…</View>}
    {state.error && state.phase !== 'subscribe' && <View className='order-alert'><Text>{state.error}</Text>{state.phase === 'uncertain' && <><Text>本次可能已消耗次数，请先核对中奖记录。</Text><Button onClick={records}>查看中奖记录</Button><Button disabled={state.activity.loading} onClick={close}>已核对记录，刷新资格</Button></>}</View>}
    {activity && <>
      {activity.image && <CommerceImage className='lottery-banner' src={activity.image} mode='aspectFit' />}
      <View className='order-panel lottery-summary'><Text className='order-section-title'>{state.activity.loading ? '正在核对剩余次数…' : `剩余 ${activity.chances} 次抽奖机会`}</Text><Text>{participation(activity)}</Text></View>
      {!!activity.publicNoticeWinners.length && <Swiper className='lottery-notices' vertical circular autoplay={!reduced && !busy} interval={2500} duration={reduced ? 0 : 500}>{activity.publicNoticeWinners.map((entry) => <SwiperItem key={entry.id}><Text>恭喜 {entry.nickname || '**'} 获得 {entry.prizeName}</Text></SwiperItem>)}</Swiper>}
      <LotteryGrid prizes={activity.prizes} chances={activity.chances} disabled={state.phase !== 'idle' || state.activity.loading || !!state.activity.error} busy={busy} activeIndex={spin.activeIndex} onDraw={() => void state.draw()} buttonImage={lotteryClick} />
      <LotterySharePanel key={`${activity.factor}-${activity.id}`} activity={activity} disabled={state.phase !== 'idle' || state.activity.loading} />
      {activity.showPublicWinners && <Winners title='中奖记录' winners={activity.publicWinners} />}
      {activity.rules && <View className='order-panel lottery-rules'><Text className='order-section-title'>活动规则</Text><RichText nodes={activity.rules} /></View>}
      {activity.showPersonalWinners && <Winners title='我的奖品' winners={activity.personalWinners} personal />}
    </>}
    <Modal visible={!!result && !spin.settling} title={result?.type === 1 ? '本次未中奖' : '恭喜中奖'} onClose={close}>
      {result && <View className='lottery-result'><CommerceImage className='lottery-result-image' src={result.image} mode='aspectFit' /><Text className='order-section-title'>{result.name || prizeLabels[result.type]}</Text><Text>{result.prompt}</Text>{result.type === 4 && <Button className='order-primary' onClick={records}>前往中奖记录领取红包</Button>}{result.type === 6 && <PrizeClaim key={result.recordId} recordId={result.recordId} />}<Button disabled={state.activity.loading} onClick={close}>关闭结果，刷新次数</Button></View>}
    </Modal>
    <Modal visible={state.phase === 'subscribe'} title='关注公众号参与活动' onClose={close}><View className='lottery-result'><Text>{state.error}</Text>{state.subscriptionImage ? <CommerceImage className='lottery-subscribe-code' src={state.subscriptionImage} mode='aspectFit' /> : <Text>暂未获取到关注二维码，请关闭后重试</Text>}<Button disabled={state.activity.loading} onClick={close}>已关注，刷新资格</Button></View></Modal>
  </View>;
}
export default function LotteryPage() {
  const params = useRouter().params;
  const factor = factors.find((candidate) => String(candidate) === (params['type'] ?? '1'));
  if (!factor) return <View className='lottery-skin lottery-page'><View className='order-alert'>抽奖类型无效，请从活动入口重新进入</View></View>;
  const activityId = params['lottery_id'];
  return activityId ? <LotteryContent key={`${factor}-${activityId}`} factor={factor} activityId={activityId} /> : <LotteryContent key={factor} factor={factor} />;
}
