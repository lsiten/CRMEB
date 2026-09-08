import { Button, Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { getVisits } from '../../services/visits';
import { usePagedResource } from '../../state/paged-resource';
import '../../pages/order/management.scss';

export default function VisitsPage() {
  const rows = usePagedResource('visits', async (page) => getToken() ? getVisits(page) : []);
  useReachBottom(() => { if (!rows.error) void rows.loadMore(); });
  return <View className='order-management visits-page'>
    <Text className='order-heading'>浏览记录</Text>
    {!getToken() ? <View className='order-panel order-empty'><Text>登录后查看浏览记录</Text><Button onClick={() => requireLogin('/pages-extra/visits/index')}>去登录</Button></View> : <>
      {rows.items.map((row) => <View className='order-panel' key={row.id}>
        <View className='order-product'><CommerceImage className='order-product-image' src={row.image} mode='aspectFill' /><View className='order-product-body'><Text>{row.name || '商品'}</Text>{row.price !== null && <Text className='order-amount'>¥{row.price.toFixed(2)}</Text>}<Text className='order-muted'>{row.visitedAt}</Text></View></View>
        <Button onClick={() => Taro.navigateTo({ url: `/pages/detail/index?id=${row.productId}` })}>查看商品</Button>
      </View>)}
      {rows.error && <View className='order-alert'><Text>{rows.error}</Text><Button onClick={rows.retry}>重试</Button></View>}
      {rows.loading && <View className='order-panel'>正在加载浏览记录…</View>}
      {!rows.loading && !rows.error && !rows.items.length && <View className='order-panel order-empty'><Text>暂无浏览记录</Text><Button onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去逛逛</Button></View>}
      {rows.items.length > 0 && !rows.error && (rows.end ? <Text className='order-muted'>已显示全部记录</Text> : <Button disabled={rows.loading} onClick={rows.loadMore}>加载更多</Button>)}
    </>}
  </View>;
}
