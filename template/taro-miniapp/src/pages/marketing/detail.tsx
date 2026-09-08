import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { getMarketingDetail } from '../../services/marketing';
import type { MarketingItem, MarketingKind } from '../../services/marketing';
import { commerceError } from '../../services/commerce-contracts';
import { ActivityCheckout } from './activity-checkout';
import '../order/management.scss';

const parseKind = (value: string | undefined): MarketingKind => {
  switch (value) {
    case 'seckill': case 'combination': case 'bargain': case 'advance': case 'lottery': case 'coupon': case 'member': case 'red-packet': case 'sign': case 'gift': return value;
    default: return 'seckill';
  }
};

export default function DetailPage({ activityKind }: Readonly<{ activityKind?: MarketingKind }> = {}) {
  const router = useRouter();
  const kind = activityKind ?? parseKind(router.params['kind']);
  const id = Number(router.params['id'] ?? 0);
  const periodId = Number(router.params['time_id'] ?? 0);
  const returnUrl = `/pages/marketing/detail?kind=${kind}&id=${id}${Number.isSafeInteger(periodId) && periodId > 0 ? `&time_id=${periodId}` : ''}`;
  const [item, setItem] = useState<MarketingItem>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!Number.isSafeInteger(id) || id <= 0) { setError('活动标识无效'); return; }
    setItem(undefined); setError('');
    let active = true;
    void getMarketingDetail(kind, id, periodId).then((value) => { if (active) setItem(value); }).catch((cause: unknown) => { if (active) setError(commerceError(cause)); });
    return () => { active = false; };
  }, [kind, id, periodId, retry]);
  if (process.env.TARO_ENV !== 'h5') Taro.useShareAppMessage(() => ({ title: item?.title ?? '营销活动', path: returnUrl }));
  return <View className='order-management'>
    <Text className='order-heading'>活动详情</Text>
    {item && !error && <Button onClick={() => setRetry((value) => value + 1)}>刷新活动</Button>}
    {error ? <View className='order-alert' role='alert'><Text>{error}</Text><Button onClick={() => setRetry((value) => value + 1)}>重试</Button>{!getToken() && <Button onClick={() => requireLogin(returnUrl)}>去登录</Button>}</View>
      : !item ? <View className='order-panel'>正在加载活动详情…</View> : <>
        <View className='order-panel'><View className='order-product'>
          <CommerceImage className='order-product-image' src={item.image ?? ''} mode='aspectFill' />
          <View className='order-product-body'><Text className='order-section-title'>{item.title}</Text>{item.price !== undefined && <Text className='order-amount'>¥{item.price.toFixed(2)}</Text>}</View>
        </View></View>
        <ActivityCheckout key={`${kind}:${id}:${periodId}:${retry}`} item={item} returnUrl={returnUrl} />
      </>}
  </View>;
}
