import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { claimReward, type Reward } from '../services/diy-actions';

type Props = Readonly<{ reward: Reward; claimed?: boolean; className?: string; style?: CSSProperties }>;
export function RewardAction({ reward, claimed = false, className, style }: Props) {
  const [complete, setComplete] = useState(claimed);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const claim = async (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    if (locked.current || complete) return;
    locked.current = true;
    setPending(true);
    try {
      await claimReward(reward);
      setComplete(true);
      await Taro.showToast({ title: reward.kind === 'sign' ? '签到成功' : '领取成功', icon: 'success' });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '操作失败，请重试', icon: 'none' });
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return <Text {...(className ? { className } : {})} {...(style ? { style } : {})} aria-disabled={pending || complete} onClick={claim}>{pending ? '处理中…' : complete ? (reward.kind === 'sign' ? '已签到' : '已领取') : (reward.kind === 'sign' ? '立即签到' : '立即领取')}</Text>;
}
