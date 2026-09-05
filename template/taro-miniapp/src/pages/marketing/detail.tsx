import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Loading } from '../../components';
import { getMarketingDetail, type MarketingItem, type MarketingKind } from '../../services/marketing';

const parseKind = (value: string | undefined): MarketingKind => {
  switch (value) {
    case 'seckill': case 'combination': case 'bargain': case 'advance': case 'lottery': case 'coupon': case 'member': case 'red-packet': case 'sign': case 'gift': return value;
    default: return 'seckill';
  }
};

const DetailPage = () => {
  const router = useRouter();
  const kind = parseKind(router.params['kind']);
  const id = Number(router.params['id'] ?? 0);
  const [item, setItem] = useState<MarketingItem>();
  const [failed, setFailed] = useState(false);
  const [remaining, setRemaining] = useState<number>();
  useEffect(() => {
    if (!Number.isSafeInteger(id) || id <= 0) { setFailed(true); return undefined; }
    let active = true;
    void getMarketingDetail(kind, id).then((value) => { if (active) setItem(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [kind, id]);
  useEffect(() => {
    if (!item?.endsAt) return undefined;
    const update = () => setRemaining(Math.max(0, new Date(item.endsAt as string).getTime() - Date.now()));
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [item?.endsAt]);
  if (process.env['TARO_ENV'] !== 'h5') Taro.useShareAppMessage(() => ({ title: item?.title ?? '营销活动', path: `/pages/marketing/detail?kind=${kind}&id=${id}` }));
  if (failed) return <View className='page card'><Text>活动已结束或不存在</Text></View>;
  if (!item) return <View className='page card'><Loading label='正在加载活动详情' /></View>;
  const available = item.stock === undefined || item.stock > 0;
  const countdown = remaining === undefined ? '' : `剩余 ${Math.floor(remaining / 3600000)}小时${Math.floor(remaining / 60000) % 60}分${Math.floor(remaining / 1000) % 60}秒`;
  return <View className='page'><View className='card detail'>{item.image && <Image src={item.image} mode='aspectFit' />}<Text className='title'>{item.title}</Text>{item.price !== undefined && <Text className='price'>¥{item.price.toFixed(2)}</Text>}{countdown && <Text className='hint'>{countdown}</Text>}<Text className='hint'>资格、价格和库存由服务端实时校验</Text><Button disabled={!available} className='primary-action' onClick={() => void Taro.navigateTo({ url: `/pages/order/confirm?activity=${kind}&activityId=${id}&productId=${item.productId ?? ''}` })}>{available ? '立即参与' : '已售罄'}</Button></View></View>;
};
export default DetailPage;
