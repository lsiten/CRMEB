import { Button, Text, View } from '@tarojs/components';
import { CommerceImage } from './commerce-image';
import { prizeLabels } from '../services/lottery';
import type { LotteryPrize } from '../services/lottery';

const positions = ['1 / 1', '1 / 2', '1 / 3', '2 / 3', '3 / 3', '3 / 2', '3 / 1', '2 / 1'] as const;
type Props = Readonly<{ buttonImage?: string; prizes: readonly LotteryPrize[]; chances: number; disabled: boolean; busy: boolean; activeIndex: number; onDraw: () => void }>;
export function LotteryGrid({ prizes, chances, disabled, busy, activeIndex, onDraw, buttonImage }: Props) {
  return <>
    <View className='lottery-grid'>
      <Button className='lottery-draw order-primary' disabled={disabled || chances < 1 || prizes.length !== 8} onClick={onDraw}>{buttonImage && !busy && chances > 0 ? <CommerceImage className='lottery-draw-image' src={buttonImage} mode='aspectFit' /> : busy ? '正在开奖…' : chances < 1 ? '次数已用完' : '立即抽奖'}</Button>
      {prizes.map((prize, index) => <View key={prize.id} style={positions[index] ? { gridArea: positions[index] } : {}} className={`lottery-prize${activeIndex === index ? ' lottery-winner' : ''}`}><CommerceImage src={prize.image} mode='aspectFit' /><Text>{prize.name || prizeLabels[prize.type]}</Text></View>)}
    </View>
    {prizes.length !== 8 && <View className='order-alert'>活动奖品配置不完整，请稍后重新加载</View>}
  </>;
}
