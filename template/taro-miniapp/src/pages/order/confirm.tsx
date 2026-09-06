import { useMemo, useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { cartItemKey, cartTotal, readCheckoutItems } from '../../services/cart';
import { createOrder, type ActivityOrder, type Fulfillment } from '../../services/api';
import { getStores, type Store } from '../../services/store';
import './index.scss';

export default function ConfirmOrderPage() {
  const router = useRouter();
  const items = useMemo(() => readCheckoutItems(router.params['selection']), [router.params['selection']]); const [address, setAddress] = useState(''); const [mode, setMode] = useState<Fulfillment['type']>('delivery'); const [store, setStore] = useState<Store>(); const [submitting, setSubmitting] = useState(false);
  const activityId = Number(router.params['activityId'] ?? 0);
  const activity: ActivityOrder | undefined = router.params['activity'] && Number.isSafeInteger(activityId) && activityId > 0 ? { kind: router.params['activity'], id: activityId, ...(Number(router.params['productId']) > 0 ? { productId: Number(router.params['productId']) } : {}) } : undefined;
  const chooseStore = async (): Promise<void> => { try { const stores = await getStores(); if (stores.length) setStore(stores[0]); else void Taro.showToast({ title: '暂无可用门店', icon: 'none' }); } catch { void Taro.showToast({ title: '门店加载失败', icon: 'none' }); } };
  const submit = async () => { if ((!items.length && !activity) || (mode === 'pickup' && !store)) return; setSubmitting(true); try { const fulfillment: Fulfillment = mode === 'pickup' && store ? { type: mode, storeId: store.id } : { type: mode, ...(address ? { address: { name: '收货人', phone: '', detail: address } } : {}) }; const order = await createOrder(items, fulfillment.address, activity, fulfillment); Taro.redirectTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(order.id)}` }); } catch { void Taro.showToast({ title: '下单失败，请重试', icon: 'none' }); } finally { setSubmitting(false); } };
  return <View className='page'><Text className='title'>确认订单</Text>{activity && <View className='card'><Text className='hint'>活动订单：{activity.kind} #{activity.id}，提交时将由服务端重新校验资格、价格和库存。</Text></View>}<View className='card'><View className='tabs'><Text className={mode === 'delivery' ? 'active' : ''} onClick={() => setMode('delivery')}>配送到家</Text><Text className={mode === 'pickup' ? 'active' : ''} onClick={() => setMode('pickup')}>到店自提</Text></View>{mode === 'delivery' ? <Input className='input' value={address} onInput={(e) => setAddress(e.detail.value)} placeholder='请输入收货地址' /> : <Button onClick={() => void chooseStore()}>{store ? `自提门店：${store.name}` : '选择自提门店'}</Button>}</View><View className='card'>{items.map((item) => <View className='row' key={cartItemKey(item)}><Text>{item.name} × {item.quantity}</Text><Text>¥{(item.price * item.quantity).toFixed(2)}</Text></View>)}</View><View className='bottom'><Text>合计 <Text className='primary'>¥{cartTotal(items).toFixed(2)}</Text></Text><Button className='primaryButton' loading={submitting} onClick={() => void submit()}>提交订单</Button></View></View>;
}
