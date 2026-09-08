import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { getOrders } from '../../services/api';
import type { OrderStatus } from '../../services/api';
import { useOrderResource } from '../../state/order-resource';
import { loginUrl } from '../../services/auth-flow';
import './management.scss';

const tabs: readonly Readonly<{ label: string; value: OrderStatus }>[] = [{ label: '全部', value: 'pending' }, { label: '待付款', value: 'unpaid' }, { label: '待发货', value: 'paid' }, { label: '待收货', value: 'shipping' }, { label: '待评价', value: 'review' }, { label: '已完成', value: 'completed' }];
export default function OrderListPage() {
  const requested = useRouter().params['status'];
  const [tab, setTab] = useState<OrderStatus>(tabs.find((item) => item.value === requested)?.value ?? 'pending');
  const resource = useOrderResource(tab, (page) => getOrders(tab, page));
  return <View className='order-management'><View className='order-between'><Text className='order-heading'>我的订单</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/order/refunds' })}>退款 / 售后</Button></View>
    <View className='order-tabs'>{tabs.map((item) => <Button key={item.value} className={tab === item.value ? 'order-selected' : ''} onClick={() => setTab(item.value)}>{item.label}</Button>)}</View>
    {resource.needsLogin ? <View className='order-alert'><Text>{resource.error || '请先登录后查看订单'}</Text><Button onClick={() => Taro.navigateTo({ url: loginUrl(`/pages/order/list?status=${tab}`) })}>去登录</Button></View> : resource.error && <View className='order-alert'><Text>{resource.error}</Text><Button disabled={resource.loading} onClick={() => void resource.retry()}>重试</Button></View>}
    {resource.items.map((order) => <View className='order-panel' key={order.id}>
      <View className='order-between'><Text>{order.statusText || '订单状态待核对'}</Text><Text className='order-amount'>¥{order.total.toFixed(2)}</Text></View><Text className='order-muted'>订单号：{order.id}</Text>
      {order.statusMessage && <Text className='order-muted'>{order.statusMessage}</Text>}
      <Text>{order.items.map((item) => `${item.name} ${item.spec ?? ''} ×${item.quantity}`).join('、')}</Text><Text className='order-muted'>{order.createdAt}</Text>
      <Button onClick={() => Taro.navigateTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(order.id)}` })}>查看订单</Button>
    </View>)}
    {resource.loading && <View className='order-panel'>正在加载订单…</View>}
    {!resource.needsLogin && !resource.loading && !resource.error && !resource.items.length && <View className='order-panel order-empty'><Text>暂无订单</Text><Button onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去购物</Button></View>}
    {!resource.error && !resource.end && !!resource.items.length && <Button disabled={resource.loading} onClick={() => void resource.loadMore()}>加载更多</Button>}
  </View>;
}
