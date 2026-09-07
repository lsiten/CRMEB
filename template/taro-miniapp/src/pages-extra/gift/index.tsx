import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { request } from '../../services/api';
import { apiRecord, apiText } from '../../services/commerce-contracts';
import '../../pages/order/management.scss';

type Gift = Readonly<{ orderId: string; sender: string; message: string; product: string; image: string; received: boolean }>;
function parseGift(payload: unknown, id: string): Gift {
  const root = apiRecord(payload); const row = apiRecord(root['data']); const product = apiRecord(row['productInfo'] ?? row['product']);
  return { orderId: id, sender: apiText(row['nickname'] ?? row['user_nickname']), message: apiText(row['gift_mark']), product: apiText(product['store_name'] ?? row['product_name']), image: apiText(product['image'] ?? row['image']), received: Number(row['gift_uid']) > 0 };
}
export default function GiftReceivePage() {
  const id = useRouter().params['order_id'] ?? ''; const [gift, setGift] = useState<Gift>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => { if (!id) { setError('礼物链接缺少订单标识'); return; } setError(''); void request<unknown>(`/order/gift_detail/${encodeURIComponent(id)}`, { method: 'GET' }).then((payload) => setGift(parseGift(payload, id))).catch(() => setError('礼物信息加载失败，请重试')); };
  useEffect(load, [id]);
  const receive = () => { if (busy || !gift || gift.received) return; setBusy(true); void request(`/order/receive_gift/${encodeURIComponent(id)}`, { method: 'POST', data: {} }).then(() => setGift({ ...gift, received: true })).catch(() => setError('礼物领取失败，请重试')).finally(() => setBusy(false)); };
  return <View className='order-management gift-receive'><Text className='order-heading'>礼物领取</Text>{error && <View className='order-alert'><Text>{error}</Text><Button disabled={busy} onClick={load}>重试</Button></View>}{gift && <View className='order-panel'>{gift.image && <Text>礼物图片：{gift.image}</Text>}<Text className='order-section-title'>{gift.product || '一份礼物'}</Text>{gift.sender && <Text>{gift.sender} 赠送给您</Text>}{gift.message && <Text className='order-muted'>{gift.message}</Text>}<Button className='order-primary' disabled={busy || gift.received} onClick={receive}>{gift.received ? '已领取' : busy ? '领取中…' : '立即领取'}</Button>{gift.received && <><Button onClick={() => Taro.redirectTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(id)}` })}>查看礼物详情</Button><Button onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>返回商城首页</Button></>}</View>}</View>;
}
