import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { PrizeClaim } from '../../components/prize-claim';
import { LotteryGrid } from '../../components/lottery-grid';
import { Modal } from '../../components/modal';
import { useReviewLottery } from '../../state/lottery';
import { useLotteryMotion } from '../../state/lottery-motion';
import { prizeLabels } from '../../services/lottery';
import '../order/management.scss';
import './lottery.scss';

export default function ReviewLotteryPage() {
  const orderId = useRouter().params['order_id'];
  const state = useReviewLottery(); const activity = state.activity.data;
  const spin = useLotteryMotion(state.result, activity?.prizes ?? []);
  const busy = state.phase === 'drawing' || spin.settling;
  const records = () => Taro.navigateTo({ url: '/pages/marketing/lottery-records' });
  return <View className='lottery-review-skin lottery-page lottery-general'><View className='review-complete'><Text className='review-check'>✓</Text><View><Text className='review-complete-title'>评价完成</Text><Text className='review-date'>{new Date().toLocaleString('zh-CN', { hour12: false })}</Text></View></View><View className='review-jump'><Button onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>返回首页</Button>{orderId && <Button onClick={() => Taro.redirectTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(orderId)}` })}>返回订单</Button>}</View><Text className='order-heading'>评价赠抽奖</Text>
    <View className='order-actions'><Button onClick={records}>我的中奖记录</Button>{orderId && <Button onClick={() => Taro.redirectTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(orderId)}` })}>返回订单</Button>}</View>
    <View className='order-actions'><Button onClick={spin.toggle}>{spin.reduced ? '开启动画' : '减少动画'}</Button></View>
    {state.activity.error && <View className='order-alert'><Text>{state.activity.error}</Text><Button disabled={state.activity.loading || busy} onClick={() => void state.activity.reload()}>刷新活动</Button></View>}
    {state.activity.loading && !activity && <View className='order-panel'>正在加载抽奖资格…</View>}
    {state.error && <View className='order-alert'><Text>{state.error}</Text>{state.phase === 'uncertain' && <><Text>本次可能已消耗次数，请先查看中奖记录，避免重复抽奖。</Text><Button onClick={records}>查看中奖记录</Button><Button disabled={state.activity.loading} onClick={() => void state.dismiss()}>已核对记录，刷新资格</Button></>}</View>}
    {activity && <>
      <View className='order-panel'><Text className='order-section-title'>{activity.name || '评价赠抽奖'}</Text><Text>{state.activity.loading ? '正在核对剩余次数…' : `剩余 ${activity.chances} 次抽奖机会`}</Text></View>
      <LotteryGrid prizes={activity.prizes} chances={activity.chances} disabled={state.phase !== 'idle' || state.activity.loading || !!state.activity.error} busy={busy} activeIndex={spin.activeIndex} onDraw={() => void state.draw()} />
    </>}
    <Modal visible={!!state.result && !spin.settling} title={state.result?.type === 1 ? '本次未中奖' : '恭喜中奖'} onClose={() => void state.dismiss()}>
    {state.result && <View className='lottery-result'><CommerceImage src={state.result.image} className='lottery-result-image' mode='aspectFit' /><Text>{state.result.name || prizeLabels[state.result.type]}</Text><Text>{state.result.prompt}</Text>
      {state.result.type === 4 && <Button className='order-primary' onClick={records}>前往中奖记录领取红包</Button>}
      {state.result.type === 6 && <PrizeClaim key={state.result.recordId} recordId={state.result.recordId} />}
      <Button disabled={state.activity.loading} onClick={() => void state.dismiss()}>关闭结果，刷新次数</Button>
    </View>}
    </Modal>
  </View>;
}
