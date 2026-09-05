import { useMemo, useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { cartTotal, readCart } from '../../services/cart';
import { createOrder } from '../../services/api';
import './index.scss';

export default function ConfirmOrderPage() {
  const items = useMemo(() => readCart(), []); const [address, setAddress] = useState(''); const [submitting, setSubmitting] = useState(false);
  const submit = async () => { if (!items.length) return; setSubmitting(true); try { const order = await createOrder(items, address ? { name: '收货人', phone: '', detail: address } : undefined); Taro.redirectTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(order.id)}` }); } catch { void Taro.showToast({ title: '下单失败，请重试', icon: 'none' }); } finally { setSubmitting(false); } };
  return <View className='page'><Text className='title'>确认订单</Text><View className='card'><Text className='sectionTitle'>收货地址</Text><Input className='input' value={address} onInput={(e) => setAddress(e.detail.value)} placeholder='请输入收货地址' /></View><View className='card'>{items.map((item) => <View className='row' key={item.id}><Text>{item.name} × {item.quantity}</Text><Text>¥{(item.price * item.quantity).toFixed(2)}</Text></View>)}</View><View className='bottom'><Text>合计 <Text className='primary'>¥{cartTotal(items).toFixed(2)}</Text></Text><Button className='primaryButton' loading={submitting} onClick={() => void submit()}>提交订单</Button></View></View>;
}
