import { useEffect, useRef, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { commerceError } from '../../services/commerce-contracts';
import type { MarketingItem } from '../../services/marketing';
import { addServerCart } from '../../services/server-cart';

export function ActivityCheckout({ item, returnUrl, pinkId, stopTime, sessionToken }: Readonly<{ item: MarketingItem; returnUrl: string; pinkId?: number; stopTime?: number; sessionToken?: string | null }>) {
  const variants = item.variants ?? [];
  const [unique, setUnique] = useState(variants.length === 1 ? variants[0]?.unique ?? '' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  useDidHide(() => { generation.current += 1; });
  const selected = variants.find((variant) => variant.unique === unique);
  const supported = item.kind === 'seckill' || item.kind === 'combination';
  const available = supported && item.activityStatus === 1 && !!item.productId && !!selected && selected.stock > 0 && (item.stock === undefined || item.stock > 0);
  const submit = async (): Promise<void> => {
    if (locked.current || !available || !selected || !item.productId || !requireLogin(returnUrl)) return;
    if (sessionToken !== undefined && getToken() !== sessionToken) { setError('登录状态已变化，请刷新活动'); return; }
    if (stopTime !== undefined && stopTime <= Date.now() / 1000) { setError('该团已结束，请刷新活动'); return; }
    if (pinkId !== undefined && (item.kind !== 'combination' || !Number.isSafeInteger(pinkId) || pinkId <= 0)) { setError('参团信息无效'); return; }
    const token = getToken();
    const request = generation.current;
    locked.current = true; setBusy(true); setError('');
    try {
      const cartId = await addServerCart({
        product: { id: item.productId, name: item.title, price: selected.price, image: item.image ?? '', unique: selected.unique, stock: selected.stock },
        quantity: 1, direct: true, activity: { kind: item.kind, id: item.id },
      });
      if (!mounted.current || generation.current !== request) return;
      if (getToken() !== token) { setError('登录状态已变化，请重新进入活动'); return; }
      await Taro.navigateTo({ url: `/pages/order/confirm?cartIds=${encodeURIComponent(cartId)}&new=1${pinkId ? `&pinkId=${pinkId}` : ''}` });
    } catch (cause) {
      if (mounted.current && generation.current === request && getToken() === token) setError(commerceError(cause));
    }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  if (!supported) return <View className='order-panel'>此活动暂不支持在此页购买</View>;
  return <View className='order-panel'>
    <Text className='order-section-title'>选择规格</Text>
    <View className='order-actions'>{variants.map((variant) => <Button key={variant.unique} disabled={busy} className={unique === variant.unique ? 'order-selected' : ''} onClick={() => { setUnique(variant.unique); setError(''); }}>{variant.label}{variant.stock === 0 ? ' · 缺货' : ''}</Button>)}</View>
    {selected && <Text className='order-amount'>¥{selected.price.toFixed(2)}</Text>}
    <Text className='order-muted'>购买数量 1 件，价格和资格以结算结果为准</Text>
    {!variants.length && <Text>暂无可购买规格</Text>}
    {item.activityStatus !== 1 && <Text>{item.activityStatus === 2 ? '活动尚未开始' : '活动已结束或不可购买'}</Text>}
    {error && <View className='order-alert' role='alert'>{error}</View>}
    <Button className='order-primary' disabled={busy || !available} onClick={submit}>{busy ? '正在确认…' : pinkId ? '加入此团' : item.kind === 'combination' ? '发起拼团' : '立即购买'}</Button>
  </View>;
}
