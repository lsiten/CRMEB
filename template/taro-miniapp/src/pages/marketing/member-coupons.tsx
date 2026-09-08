import { Button, Text, View } from '@tarojs/components';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { getMemberCoupons } from '../../services/member-coupons';
import { useRemoteResource } from '../../state/remote-resource';
import '../order/management.scss';

export default function MemberCouponsPage() {
  const coupons = useRemoteResource(async () => {
    const token = getToken();
    if (!token) return { token, rows: [] };
    return { token, rows: await getMemberCoupons() };
  });
  const token = getToken();
  const rows = coupons.data?.token === token ? coupons.data.rows : [];
  return <View className='order-management'>
    <Text className='order-heading'>我的会员券</Text>
    {!token ? <View className='order-panel order-empty'><Text>登录后查看会员券</Text><Button onClick={() => requireLogin('/pages-extra/vip-coupon/index')}>去登录</Button></View>
      : coupons.loading ? <View className='order-panel'>正在加载会员券…</View>
      : coupons.error ? <View className='order-alert' role='alert'><Text>{coupons.error}</Text><Button onClick={coupons.reload}>重试</Button></View>
      : rows.length ? rows.map((coupon) => <View className='order-panel' key={coupon.id}>
        <Text className='order-section-title'>{coupon.title}</Text>
        <Text className='order-amount'>¥{coupon.amount.toFixed(2)}</Text>
        <Text className='order-muted'>{coupon.scope} · {coupon.minPrice > 0 ? `满 ¥${coupon.minPrice.toFixed(2)} 可用` : '无门槛券'}</Text>
        <Text className='order-muted'>{coupon.startsAt || '生效时间以券规则为准'} — {coupon.endsAt || '到期时间以券规则为准'}</Text>
        <Text>{coupon.status}</Text>
      </View>) : <View className='order-panel order-empty'>暂无会员券</View>}
  </View>;
}
