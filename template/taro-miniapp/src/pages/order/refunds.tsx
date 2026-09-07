import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getRefunds } from '../../services/refunds';
import { usePagedResource } from '../../state/paged-resource';
import './management.scss';

export default function RefundsPage() {
  const resource = usePagedResource('refunds', getRefunds);
  return <View className='order-management'><Text className='order-heading'>退款 / 售后</Text>
    {resource.error && <View className='order-alert'><Text>{resource.error}</Text><Button disabled={resource.loading} onClick={() => void resource.retry()}>重试</Button></View>}
    {resource.items.map((refund) => <View className='order-panel' key={refund.id}>
      <View className='order-between'><Text>{refund.title}</Text><Text className='order-amount'>¥{refund.amount.toFixed(2)}</Text></View><Text className='order-muted'>售后单号：{refund.id}</Text>
      <Text>{refund.products.map((item) => `${item.name} ×${item.remaining}`).join('、')}</Text><Text className='order-muted'>{refund.createdAt}</Text>
      <Button onClick={() => Taro.navigateTo({ url: `/pages/order/refund-detail?id=${encodeURIComponent(refund.id)}` })}>查看进度</Button>
    </View>)}
    {resource.loading && <View className='order-panel'>正在加载售后记录…</View>}
    {!resource.loading && !resource.error && !resource.items.length && <View className='order-panel order-empty'>暂无售后记录</View>}
    {!resource.end && !!resource.items.length && <Button disabled={resource.loading} onClick={() => void resource.loadMore()}>加载更多</Button>}
  </View>;
}
