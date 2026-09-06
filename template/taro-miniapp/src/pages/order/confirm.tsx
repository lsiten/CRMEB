import { useMemo, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { Empty } from '../../components';
import { cartItemKey, cartTotal, readCheckoutItems } from '../../services/cart';
import { createOrder } from '../../services/api';
import type { ActivityOrder, Fulfillment } from '../../services/api';
import { CHECKOUT_ADDRESS_ID_KEY } from '../../services/account-contracts';
import { getAddresses } from '../../services/account';
import type { Address } from '../../services/account';
import { requireLogin } from '../../services/auth-flow';
import { getStores } from '../../services/store';
import type { Store } from '../../services/store';
import './index.scss';
import './confirm.scss';

export default function ConfirmOrderPage() {
  const router = useRouter();
  const selection = router.params['selection'];
  const items = useMemo(() => readCheckoutItems(selection), [selection]);
  const [address, setAddress] = useState<Address>();
  const [addressFailed, setAddressFailed] = useState(false);
  const [mode, setMode] = useState<Fulfillment['type']>('delivery');
  const [store, setStore] = useState<Store>();
  const [submitting, setSubmitting] = useState(false);
  const activityId = Number(router.params['activityId'] ?? 0);
  const activity: ActivityOrder | undefined = router.params['activity'] && Number.isSafeInteger(activityId) && activityId > 0
    ? { kind: router.params['activity'], id: activityId, ...(Number(router.params['productId']) > 0 ? { productId: Number(router.params['productId']) } : {}) }
    : undefined;
  const returnUrl = `/pages/order/confirm${selection ? `?selection=${encodeURIComponent(selection)}` : ''}`;

  const loadAddress = async (): Promise<void> => {
    if (!requireLogin(returnUrl)) return;
    setAddressFailed(false);
    try {
      const addresses = await getAddresses();
      const selectedId = Number(Taro.getStorageSync<number | string>(CHECKOUT_ADDRESS_ID_KEY));
      const selected = Number.isSafeInteger(selectedId) ? addresses.find((item) => item.id === selectedId) : undefined;
      setAddress(selected ?? addresses.find((item) => item.is_default) ?? addresses[0]);
    } catch { setAddressFailed(true); }
  };
  useDidShow(() => { void loadAddress(); });
  const chooseStore = async (): Promise<void> => {
    try { const stores = await getStores(); if (stores.length) setStore(stores[0]); else await Taro.showToast({ title: '暂无可用门店', icon: 'none' }); }
    catch { await Taro.showToast({ title: '门店加载失败', icon: 'none' }); }
  };
  const submit = async (): Promise<void> => {
    if ((!items.length && !activity) || (mode === 'pickup' && !store)) return;
    if (mode === 'delivery' && !address) { await Taro.showToast({ title: '请先选择收货地址', icon: 'none' }); return; }
    setSubmitting(true);
    try {
      const fulfillment: Fulfillment = mode === 'pickup' && store
        ? { type: 'pickup', storeId: store.id }
        : { type: 'delivery', address: { name: address?.real_name ?? '', phone: address?.phone ?? '', detail: address ? `${address.province}${address.city}${address.district}${address.detail}` : '' } };
      const order = await createOrder(items, fulfillment.address, activity, fulfillment);
      await Taro.redirectTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(order.id)}` });
    } catch { await Taro.showToast({ title: '下单失败，请重试', icon: 'none' }); }
    finally { setSubmitting(false); }
  };
  if (!items.length && !activity) return <View className='page order-confirm-page'><Text className='title'>确认订单</Text><View className='card'><Empty title='暂无待结算商品' description='请返回购物车选择商品后再提交订单' actionLabel='返回购物车' onAction={() => void Taro.switchTab({ url: '/pages/cart/index' })} /></View></View>;
  return <View className='page order-confirm-page'>
    <Text className='title'>确认订单</Text>
    {activity && <View className='card'><Text className='hint'>活动订单：{activity.kind} #{activity.id}，提交时将由服务端重新校验资格、价格和库存。</Text></View>}
    <View className='card'><View className='tabs'><Button className={mode === 'delivery' ? 'active' : ''} onClick={() => setMode('delivery')}>配送到家</Button><Button className={mode === 'pickup' ? 'active' : ''} onClick={() => setMode('pickup')}>到店自提</Button></View>
      {mode === 'delivery' ? <Button className='order-address' onClick={() => void Taro.navigateTo({ url: '/pages-extra/address/index?select=1' })}>{address ? <><Text className='order-address__identity'>{address.real_name} {address.phone}</Text><Text className='order-address__detail'><Text className='order-address__region'>{address.province}</Text><Text className='order-address__region'>{address.city}</Text><Text className='order-address__region'>{address.district}</Text>{address.detail}</Text></> : '选择收货地址'}</Button> : <Button onClick={() => void chooseStore()}>{store ? `自提门店：${store.name}` : '选择自提门店'}</Button>}
      {mode === 'delivery' && addressFailed && <Button size='mini' onClick={() => void loadAddress()}>地址加载失败，点击重试</Button>}
    </View>
    <View className='card'>{items.map((item) => <View className='row' key={cartItemKey(item)}><Text>{item.name} × {item.quantity}</Text><Text>¥{(item.price * item.quantity).toFixed(2)}</Text></View>)}</View>
    <View className='bottom'><Text>合计 <Text className='primary'>¥{cartTotal(items).toFixed(2)}</Text></Text><Button className='primaryButton' loading={submitting} disabled={submitting} onClick={() => void submit()}>提交订单</Button></View>
  </View>;
}
