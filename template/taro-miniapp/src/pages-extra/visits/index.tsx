import { Button, Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { useRef, useState } from 'react';
import { CommerceImage } from '../../components/commerce-image';
import { Modal } from '../../components/modal';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { clearVisits, getVisits, isVisitDeleteEnabled } from '../../services/visits';
import { commerceError } from '../../services/commerce-contracts';
import { usePagedResource } from '../../state/paged-resource';
import '../../pages/order/management.scss';

export default function VisitsPage() {
  const rows = usePagedResource('visits', async (page) => getToken() ? getVisits(page) : []);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const locked = useRef(false);
  const confirmedToken = useRef<string | null>(null);
  const clear = async (): Promise<void> => {
    if (locked.current) return;
    locked.current = true; setDeleting(true); setDeleteError('');
    try {
      await clearVisits(confirmedToken.current);
      setConfirm(false);
      await rows.reload();
    } catch (cause) { setDeleteError(commerceError(cause)); }
    finally { locked.current = false; setDeleting(false); }
  };
  useReachBottom(() => { if (!rows.error && !locked.current) void rows.loadMore(); });
  return <View className='order-management visits-page'>
    <Text className='order-heading'>浏览记录</Text>
    {!getToken() ? <View className='order-panel order-empty'><Text>登录后查看浏览记录</Text><Button onClick={() => requireLogin('/pages-extra/visits/index')}>去登录</Button></View> : <>
      {isVisitDeleteEnabled() && rows.items.length > 0 && <Button disabled={rows.loading || deleting} onClick={() => { confirmedToken.current = getToken(); setDeleteError(''); setConfirm(true); }}>清空浏览记录</Button>}
      {rows.items.map((row) => <View className='order-panel' key={row.id}>
        <View className='order-product'><CommerceImage className='order-product-image' src={row.image} mode='aspectFill' /><View className='order-product-body'><Text>{row.name || '商品'}</Text>{row.price !== null && <Text className='order-amount'>¥{row.price.toFixed(2)}</Text>}<Text className='order-muted'>{row.visitedAt}</Text></View></View>
        <Button onClick={() => Taro.navigateTo({ url: `/pages/detail/index?id=${row.productId}` })}>查看商品</Button>
      </View>)}
      {rows.error && <View className='order-alert'><Text>{rows.error}</Text><Button onClick={rows.retry}>重试</Button></View>}
      {rows.loading && <View className='order-panel'>正在加载浏览记录…</View>}
      {!rows.loading && !rows.error && !rows.items.length && <View className='order-panel order-empty'><Text>暂无浏览记录</Text><Button onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去逛逛</Button></View>}
      {rows.items.length > 0 && !rows.error && (rows.end ? <Text className='order-muted'>已显示全部记录</Text> : <Button disabled={rows.loading || deleting} onClick={rows.loadMore}>加载更多</Button>)}
      <Modal visible={confirm} title='清空浏览记录' onClose={() => { if (!locked.current) setConfirm(false); }}>
        <View>将清空本次读取到的全部浏览记录，包含尚未加载的记录。</View>
        <View>清空后无法恢复。</View>
        {deleteError && <View className='order-alert' role='alert'><Text>{deleteError}。可先取消并刷新列表核对，再重试。</Text></View>}
        <Button disabled={deleting} onClick={clear}>{deleting ? '正在清空…' : deleteError ? '重试清空' : '确认清空'}</Button>
        <Button disabled={deleting} onClick={() => setConfirm(false)}>取消</Button>
      </Modal>
    </>}
  </View>;
}
