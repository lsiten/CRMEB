import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useRefundResource } from '../../state/refund-resource';
import { loginUrl } from '../../services/auth-flow';
import './management.scss';

export default function RefundsPage() {
  const resource = useRefundResource();
  return <View className='order-management'><Text className='order-heading'>退款 / 售后</Text>
    {resource.error && <View className='order-alert'><Text>{resource.error}</Text>{resource.needsLogin ? <Button onClick={() => Taro.navigateTo({ url: loginUrl('/pages/order/refunds') })}>去登录</Button> : <Button disabled={resource.loading} onClick={() => void resource.retry()}>重试</Button>}</View>}
    <View className='order-actions'><Button disabled={resource.loading || resource.needsLogin} onClick={() => void resource.reload()}>刷新状态</Button><Button onClick={() => Taro.redirectTo({ url: '/pages/order/list' })}>返回订单列表</Button></View>
    {resource.items.map((refund) => <View className='order-panel' key={refund.id}>
      <View className='order-between'><Text>{refund.title}</Text><Text className='order-amount'>¥{refund.amount.toFixed(2)}</Text></View><Text className='order-muted'>售后单号：{refund.id}</Text>
      <Text>{refund.products.map((item) => `${item.name} ×${item.quantity}`).join('、') || '暂无商品明细'}</Text><Text className='order-muted'>{refund.createdAt}</Text>
      <Button onClick={() => { if (resource.isValid()) void Taro.navigateTo({ url: `/pages/order/refund-detail?id=${encodeURIComponent(refund.id)}` }); }}>查看进度</Button>
    </View>)}
    {resource.loading && <View className='order-panel'>正在加载售后记录…</View>}
    {!resource.loading && !resource.error && !resource.items.length && <View className='order-panel order-empty'>暂无售后记录</View>}
    {!resource.end && !!resource.items.length && !resource.error && <Button disabled={resource.loading} onClick={() => void resource.loadMore()}>加载更多</Button>}
  </View>;
}
