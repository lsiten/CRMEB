import type { ReactNode } from 'react';
import { Button, Text, View } from '@tarojs/components';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import '../order/management.scss';

export function SocialShell({ title, loading, busy, error, needsRefresh, refresh, returnUrl, children }: Readonly<{ title: string; loading: boolean; busy: boolean; error: string; needsRefresh: boolean; refresh: () => Promise<void>; returnUrl: string; children: ReactNode }>) {
  return <View className='order-management'>
    <Text className='order-heading'>{title}</Text>
    {!getToken() ? <View className='order-panel'><Text>登录后查看活动与参与进度</Text><Button onClick={() => requireLogin(returnUrl)}>去登录</Button></View> : <>
      <Button disabled={busy || loading} onClick={() => void refresh()}>刷新活动</Button>
      {loading && <View className='order-panel'>正在加载活动…</View>}
      {needsRefresh && <View className='order-panel'>活动或登录状态已变化，请刷新核对</View>}
      {error && <View className='order-alert' role='alert'><Text>{error}</Text><Text>请刷新核对最新状态后再操作</Text></View>}
      {children}
    </>}
  </View>;
}
