import Taro from '@tarojs/taro';
import { useMemo, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import { Loading } from '../../components/loading';
import { getCoupons } from '../../services/assets';
import { useRemoteResource } from '../../state/remote-resource';
import './index.scss';

export default function CouponPage() {
  const coupons = useRemoteResource(getCoupons);
  const [tab, setTab] = useState('可使用');
  const visible = useMemo(() => (coupons.data ?? []).filter((coupon) => tab === '全部' || coupon.status.includes(tab)), [coupons.data, tab]);
  return <View className='page coupon-page'>
    <Text className='title'>我的优惠券</Text>
    <View className='couponTabs'>{['可使用', '已使用', '已过期', '全部'].map((item) => <Button key={item} size='mini' className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</Button>)}</View>
    {coupons.loading ? <Loading label='正在加载优惠券…' /> : coupons.error ? <View className='card coupon-error' role='alert'><Text>{coupons.error}</Text><Button onClick={coupons.reload}>重试</Button></View> : visible.length ? visible.map((coupon) => <View className='card coupon' key={coupon.id}>
      <Text className='couponAmount'>¥{coupon.amount.toFixed(2)}</Text>
      <View><Text>{coupon.title}</Text><Text className='hint'>满 ¥{coupon.minPrice.toFixed(2)} 可用 · {coupon.status}{coupon.expireAt ? ` · 到期 ${coupon.expireAt}` : ''}</Text></View>
      {coupon.status.includes('可') && <Button size='mini' onClick={() => void Taro.switchTab({ url: '/pages/index/index' })}>去使用</Button>}
    </View>) : <View className='card empty'><Text>暂无{tab === '全部' ? '' : tab}优惠券</Text></View>}
  </View>;
}
