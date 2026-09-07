import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import { requireLogin } from '../services/auth-flow';
import { buildSharePath } from '../services/platform';
import type { ShareActivity } from '../services/lottery-share';
import { useLotteryShare } from '../state/lottery-share';
import { useNativeLotteryShare } from '../state/native-lottery-share';
import { Modal } from './modal';

export function LotterySharePanel({ activity, disabled }: Readonly<{ activity: ShareActivity; disabled: boolean }>) {
  const [visible, setVisible] = useState(false);
  const state = useLotteryShare(activity);
  const path = buildSharePath('/pages/marketing/lottery', { type: String(activity.factor), lottery_id: activity.id });
  useNativeLotteryShare(state, { title: activity.name, path });
  const open = () => {
    if (!requireLogin(path)) return;
    setVisible(true);
    void state.prepare();
  };
  return <>
    <View className='order-actions'><Button disabled={disabled} onClick={open}>邀请好友</Button></View>
    <Modal visible={visible} title='邀请好友参与抽奖' onClose={() => setVisible(false)}>
      <View className='lottery-result'>
        <Text className='order-section-title'>{activity.name}</Text>
        {state.busy && <View role='status'>{state.share ? '正在复制链接…' : '正在生成邀请…'}</View>}
        {state.error && <View className='order-alert' role='alert'>{state.error}</View>}
        {state.share && <>
          <Text>好友通过邀请进入同一抽奖活动，参与资格以活动规则为准。</Text>
          {state.menu === 'configuring' && <View role='status'>正在准备微信分享菜单…</View>}
          {state.menu === 'ready' && <Text>可通过微信右上角分享给好友或朋友圈。</Text>}
          {state.menu === 'failed' && <View className='lottery-result'><View className='order-alert' role='alert'>微信分享菜单暂不可用，可复制链接发送。</View><Button onClick={state.retryMenu}>重试微信分享配置</Button></View>}
          {state.share.url ? <>
            <Text className='lottery-share-link' selectable>{state.share.url}</Text>
            <Button className='order-primary' disabled={state.busy} onClick={() => void state.copy()}>{state.error ? '重试复制' : '复制邀请链接'}</Button>
            {state.copied && <View role='status'>链接已复制</View>}
          </> : <Button className='order-primary' openType='share'>发送给朋友</Button>}
        </>}
        {!state.share && !state.busy && <Button className='order-primary' onClick={open}>重新生成</Button>}
        <Button onClick={() => setVisible(false)}>关闭邀请</Button>
      </View>
    </Modal>
  </>;
}
