import { useRef, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { Modal } from '../../components/modal';
import { getFavorites, removeFavorite, type Favorite } from '../../services/favorites';
import { commerceError } from '../../services/commerce-contracts';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { usePagedResource } from '../../state/paged-resource';
import '../order/management.scss';

export default function FavoritesPage() {
  const rows = usePagedResource<Favorite>('favorites', async (page) => getToken() ? getFavorites(page) : []);
  const [removing, setRemoving] = useState<Favorite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useReachBottom(() => { if (!rows.error && !busy) void rows.loadMore(); });
  const remove = async (): Promise<void> => {
    if (!removing || lock.current || !requireLogin('/pages-extra/favorites/index')) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await removeFavorite(removing);
      setRemoving(null);
      await rows.reload();
    } catch (cause) { setError(commerceError(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View className='order-management'>
    <Text className='order-heading'>我的收藏</Text>
    <Text className='order-muted'>收藏喜欢的商品，方便下次找到</Text>
    {!getToken() ? <View className='order-panel order-empty'><Text>登录后查看我的收藏</Text><Button onClick={() => requireLogin('/pages-extra/favorites/index')}>去登录</Button></View> : <>
      {rows.items.map((item) => <View className='order-panel' key={item.id}>
        <View className='order-product'><CommerceImage className='order-product-image' src={item.image} mode='aspectFill' /><View className='order-product-body'><Text>{item.name || '收藏商品'}</Text><Text className='order-amount'>¥{item.price.toFixed(2)}</Text>{!item.available && <Text className='order-muted'>商品已失效</Text>}</View></View>
        <View className='order-actions'><Button disabled={!item.available || busy} onClick={() => Taro.navigateTo({ url: `/pages/detail/index?id=${item.productId}` })}>查看商品</Button><Button disabled={busy} onClick={() => { setRemoving(item); setError(''); }}>取消收藏</Button></View>
      </View>)}
      {rows.loading && <View className='order-panel'>正在加载收藏…</View>}
      {rows.error && <View className='order-alert'><Text>{rows.error}</Text><Button onClick={rows.retry}>重试</Button></View>}
      {!rows.loading && !rows.error && !rows.items.length && <View className='order-panel order-empty'><Text>{rows.end ? '暂无收藏商品' : '本页收藏商品已失效，可继续加载'}</Text><Button onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去逛逛</Button></View>}
      {!rows.error && (rows.end ? rows.items.length > 0 && <Text className='order-muted'>已显示全部收藏</Text> : <Button disabled={rows.loading || busy} onClick={rows.loadMore}>加载更多</Button>)}
    </>}
    <Modal visible={!!removing} title='取消收藏' onClose={() => { if (!lock.current) setRemoving(null); }}>
      <Text>确定不再收藏「{removing?.name || '该商品'}」吗？</Text>
      {error && <View className='order-alert'><Text>{error}</Text></View>}
      <View className='order-actions'><Button disabled={busy} onClick={() => setRemoving(null)}>保留收藏</Button><Button disabled={busy} loading={busy} onClick={() => void remove()}>确认取消</Button></View>
    </Modal>
  </View>;
}
