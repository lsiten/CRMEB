import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useOrderDetail } from '../../state/order-detail';
import { loginUrl } from '../../services/auth-flow';
import { CommerceImage } from '../../components/commerce-image';
import './management.scss';

export default function OrderDetailPage() {
  const id = useRouter().params['orderId'] ?? '';
  const { resource, order, busy, error, feedback, disabled, reload, run } = useOrderDetail(id);
  return <View className='order-management'><Text className='order-heading'>订单详情</Text>
    {feedback && resource.valid && <View className='order-panel'><Text>{feedback}</Text></View>}
    {resource.needsLogin ? <View className='order-alert'><Text>{error || resource.error || '请先登录后查看订单'}</Text><Button onClick={() => Taro.navigateTo({ url: loginUrl(`/pages/order/detail?orderId=${encodeURIComponent(id)}`) })}>去登录</Button></View> : (resource.error || error) && <View className='order-alert'><Text>{resource.error || error}</Text>{resource.error && <Button disabled={busy || resource.loading} onClick={() => void reload()}>重新加载</Button>}</View>}
    <View className='order-actions'><Button disabled={busy || resource.loading || !id || resource.needsLogin} onClick={() => void reload()}>刷新状态</Button><Button onClick={() => Taro.redirectTo({ url: '/pages/order/list' })}>返回订单列表</Button></View>
    {busy && <View className='order-panel'>正在处理，请勿重复操作…</View>}
    {resource.loading ? <View className='order-panel'>订单加载中…</View> : order && <>
      <View className='order-panel'><Text className='order-section-title'>{order.statusText || '订单状态待核对'}</Text>{order.statusMessage && <Text>{order.statusMessage}</Text>}<Text className='order-muted'>订单号：{order.id}</Text><Text className='order-muted'>{order.createdAt}</Text>{order.address && <><Text>{order.address.name} {order.address.phone}</Text><Text className='order-muted'>{order.address.detail}</Text></>}</View>
      {!!order.splitOrderIds?.length && <View className='order-panel'><Text className='order-section-title'>分单进度</Text><Text className='order-muted'>此订单已拆分，请分别查看子订单的配送与售后状态。</Text>{order.splitOrderIds.map((child) => <Button key={child} onClick={() => Taro.navigateTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(child)}` })}>查看子订单 {child}</Button>)}</View>}
      <View className='order-panel'>{order.items.map((item, index) => <View className='order-product' key={item.cartId || `${item.id}-${index}`}><CommerceImage src={item.image ?? ''} className='order-product-image' /><View className='order-product-body'><Text>{item.name}</Text><Text className='order-muted'>{item.spec}</Text><View className='order-between'><Text>×{item.quantity}</Text><Text>¥{(item.price * item.quantity).toFixed(2)}</Text></View>{order.status === 'review' && item.reviewUnique && item.reviewed === false && <Button disabled={disabled} onClick={() => Taro.navigateTo({ url: `/pages/order/review?unique=${encodeURIComponent(item.reviewUnique ?? '')}` })}>评价此商品</Button>}{item.reviewed && <Text className='order-muted'>已评价</Text>}</View></View>)}<View className='order-between'><Text>{order.status === 'unpaid' ? '应付' : '订单金额'}</Text><Text className='order-amount'>¥{order.total.toFixed(2)}</Text></View></View>
      <View className='order-actions'>
        {order.canPay && <Button disabled={disabled} onClick={() => Taro.navigateTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(id)}` })}>去支付</Button>}
        {order.canCancel && <Button disabled={disabled} onClick={() => void run('cancel')}>取消订单</Button>}
        {order.canReceive && <Button disabled={disabled} onClick={() => void run('receive')}>确认收货</Button>}
        {order.deliveryType === 'express' && ['shipping', 'review', 'completed'].includes(order.status) && <Button onClick={() => Taro.navigateTo({ url: `/pages/order/logistics?orderId=${encodeURIComponent(id)}` })}>查看物流</Button>}
        {order.canRefund && order.internalId && <Button disabled={disabled} onClick={() => Taro.navigateTo({ url: `/pages/order/refund-apply?id=${order.internalId}` })}>申请售后</Button>}
        <Button onClick={() => Taro.navigateTo({ url: '/pages/order/refunds' })}>售后记录</Button>
        {order.canBuyAgain && <Button disabled={disabled} onClick={() => void run('again')}>再次购买</Button>}
        {order.canDelete && <Button disabled={disabled} onClick={() => void run('delete')}>删除订单</Button>}
      </View>
    </>}
  </View>;
}
