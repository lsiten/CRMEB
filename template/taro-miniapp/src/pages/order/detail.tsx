import { useRef, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { cancelOrder, getOrder } from '../../services/api';
import { buyOrderAgain, deleteOrder, receiveOrder } from '../../services/order-actions';
import { commerceError } from '../../services/commerce-contracts';
import { useRemoteResource } from '../../state/remote-resource';
import { CommerceImage } from '../../components/commerce-image';
import './management.scss';

export default function OrderDetailPage() {
  const id = useRouter().params['orderId'] ?? '';
  const resource = useRemoteResource(() => getOrder(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (locked.current || resource.loading || resource.error) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(commerceError(cause)); }
    finally { locked.current = false; setBusy(false); }
  };
  const confirm = (title: string, content: string, action: () => Promise<void>) => run(async () => { const result = await Taro.showModal({ title, content }); if (result.confirm) { await action(); await resource.reload(); } });
  const again = () => run(async () => { const cartIds = await buyOrderAgain(id); await Taro.navigateTo({ url: `/pages/order/confirm?cartIds=${encodeURIComponent(cartIds)}&new=1` }); });
  const order = resource.data;
  const disabled = busy || !!resource.error;
  return <View className='order-management'><Text className='order-heading'>订单详情</Text>
    {(resource.error || error) && <View className='order-alert'><Text>{resource.error || error}</Text>{resource.error && <Button disabled={busy} onClick={() => void resource.reload()}>重新加载</Button>}</View>}
    {resource.loading && !resource.data ? <View className='order-panel'>订单加载中…</View> : order && <>
      <View className='order-panel'><Text className='order-section-title'>{order.statusText ?? order.status}</Text><Text className='order-muted'>订单号：{order.id}</Text><Text className='order-muted'>{order.createdAt}</Text>{order.address && <><Text>{order.address.name} {order.address.phone}</Text><Text className='order-muted'>{order.address.detail}</Text></>}</View>
      <View className='order-panel'>{order.items.map((item, index) => <View className='order-product' key={item.cartId || `${item.id}-${index}`}><CommerceImage src={item.image ?? ''} className='order-product-image' /><View className='order-product-body'><Text>{item.name}</Text><Text className='order-muted'>{item.spec}</Text><View className='order-between'><Text>×{item.quantity}</Text><Text>¥{(item.price * item.quantity).toFixed(2)}</Text></View>{order.status === 'review' && item.reviewUnique && item.reviewed === false && <Button disabled={disabled} onClick={() => Taro.navigateTo({ url: `/pages/order/review?unique=${encodeURIComponent(item.reviewUnique ?? '')}` })}>评价此商品</Button>}{item.reviewed && <Text className='order-muted'>已评价</Text>}</View></View>)}<View className='order-between'><Text>{order.status === 'unpaid' ? '应付' : '订单金额'}</Text><Text className='order-amount'>¥{order.total.toFixed(2)}</Text></View></View>
      <View className='order-actions'>
        {order.status === 'unpaid' && <><Button disabled={disabled} onClick={() => Taro.navigateTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(id)}` })}>去支付</Button><Button disabled={disabled} onClick={() => void confirm('取消订单', '确认取消此订单？', () => cancelOrder(id))}>取消订单</Button></>}
        {order.status === 'shipping' && <Button disabled={disabled} onClick={() => void confirm('确认收货', '请确认已收到全部商品。确认后订单将进入待评价状态。', () => receiveOrder(id))}>确认收货</Button>}
        {order.deliveryType === 'express' && ['shipping', 'review', 'completed'].includes(order.status) && <Button onClick={() => Taro.navigateTo({ url: `/pages/order/logistics?orderId=${encodeURIComponent(id)}` })}>查看物流</Button>}
        {order.canRefund && order.internalId && <Button disabled={disabled} onClick={() => Taro.navigateTo({ url: `/pages/order/refund-apply?id=${order.internalId}` })}>申请售后</Button>}
        <Button onClick={() => Taro.navigateTo({ url: '/pages/order/refunds' })}>售后记录</Button>
        {order.canBuyAgain && <Button disabled={disabled} onClick={() => void again()}>再次购买</Button>}
        {['completed', 'refunded'].includes(order.status) && <Button disabled={disabled} onClick={() => void run(async () => { const result = await Taro.showModal({ title: '删除订单', content: '确认删除此订单记录？' }); if (result.confirm) { await deleteOrder(id); await Taro.redirectTo({ url: '/pages/order/list' }); } })}>删除订单</Button>}
      </View>
    </>}
  </View>;
}
