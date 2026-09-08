import { useCallback } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { getOpenPinks, getPink } from '../../services/social-transactions';
import { useSocialResource } from './use-social-resource';
import { SocialShell } from './social-shell';
import { ActivityCheckout } from './activity-checkout';

export default function PinkPage() {
  const id = Number(useRouter().params['id']);
  const returnUrl = `/pages-extra/goods-combination-status/index?id=${id}`;
  const loader = useCallback(() => getPink(id), [id]);
  const resource = useSocialResource(loader, returnUrl); const pink = resource.data;
  if (process.env.TARO_ENV !== 'h5') Taro.useShareAppMessage(() => ({ title: pink?.item.title ?? '邀请参团', path: returnUrl }));
  return <SocialShell title='拼团详情' {...resource} returnUrl={returnUrl}>
    {pink && <>
      <View className='order-panel'><View className='order-product'><CommerceImage className='order-product-image' src={pink.item.image ?? ''} mode='aspectFill' /><View className='order-product-body'><Text className='order-section-title'>{pink.item.title}</Text><Text>{pink.message}</Text><Text className='order-muted'>团号 {pink.id}</Text></View></View></View>
      {pink.joinable ? <ActivityCheckout key={`${pink.id}:${resource.token}`} item={pink.item} returnUrl={returnUrl} pinkId={pink.id} stopTime={pink.stopTime} sessionToken={resource.token ?? null} /> : <View className='order-panel'><Text>{pink.message}</Text></View>}
      {pink.orderId && <Button onClick={() => void Taro.navigateTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(pink.orderId)}` })}>查看我的订单</Button>}
      <Button onClick={() => void Taro.navigateTo({ url: `/pages/marketing/detail?kind=combination&id=${pink.item.id}` })}>查看活动与其他团</Button>
    </>}
  </SocialShell>;
}

export function OpenPinks({ id, returnUrl }: Readonly<{ id: number; returnUrl: string }>) {
  const loader = useCallback(() => getOpenPinks(id), [id]); const resource = useSocialResource(loader, returnUrl);
  return <View className='order-panel'><Text className='order-section-title'>加入已有团</Text>
    {resource.loading ? <Text>正在加载可加入的团…</Text> : resource.error ? <View className='order-alert'>{resource.error}</View> : resource.data?.length ? resource.data.map((pink) => <View key={pink.id}><Text>{pink.name}的团 · 还差 {pink.remaining} 人</Text><Button onClick={() => void Taro.navigateTo({ url: `/pages-extra/goods-combination-status/index?id=${pink.id}` })}>查看团号 {pink.id}</Button></View>) : <Text>暂无可加入的团，可发起新团</Text>}
    <Button disabled={resource.loading} onClick={() => void resource.refresh()}>刷新拼团列表</Button>
  </View>;
}
