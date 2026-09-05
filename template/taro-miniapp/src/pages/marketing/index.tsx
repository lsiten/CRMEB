import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Empty, Loading } from '../../components';
import { getMarketingItems, type MarketingItem, type MarketingKind } from '../../services/marketing';
import { buildSharePath } from '../../services/platform';
import './index.scss';

const kinds: readonly { key: MarketingKind; label: string }[] = [
  { key: 'seckill', label: '秒杀' }, { key: 'combination', label: '拼团' }, { key: 'bargain', label: '砍价' }, { key: 'advance', label: '预售' }, { key: 'lottery', label: '抽奖' }, { key: 'coupon', label: '优惠券' }, { key: 'member', label: '会员' }, { key: 'red-packet', label: '红包' }, { key: 'sign', label: '签到' }, { key: 'gift', label: '赠品' },
];

const MarketingPage = () => {
  const [kind, setKind] = useState<MarketingKind>('seckill');
  const [items, setItems] = useState<readonly MarketingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; setLoading(true); setFailed(false); void getMarketingItems(kind).then((value) => { if (active) setItems(value); }).catch(() => { if (active) { setItems([]); setFailed(true); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [kind]);
  return <View className='page marketing'><Text className='title'>营销活动</Text><View className='kind-tabs'>{kinds.map((item) => <Button key={item.key} className={kind === item.key ? 'active' : ''} onClick={() => setKind(item.key)}>{item.label}</Button>)}</View>{loading && <View className='card state'><Loading label='正在加载活动' /></View>}{!loading && failed && <View className='card state'><Text>活动加载失败</Text><Button size='mini' onClick={() => setKind(kind)}>重试</Button></View>}{!loading && !failed && items.length === 0 && <View className='card state'><Empty title='暂无活动' /></View>}<View className='activity-grid'>{items.map((item) => <View className='card activity' key={`${item.kind}-${item.id}`} onClick={() => void Taro.navigateTo({ url: buildSharePath('/pages/marketing/detail', { kind: item.kind, id: String(item.id) }) })}>{item.image && <Image src={item.image} mode='aspectFill' /> }<Text className='activity-title'>{item.title}</Text>{item.price !== undefined && <Text className='price'>¥{item.price.toFixed(2)}</Text>}{item.originalPrice !== undefined && <Text className='original'>¥{item.originalPrice.toFixed(2)}</Text>}{item.stock !== undefined && <Text className='stock'>剩余 {item.stock}</Text>}</View>)}</View></View>;
};
export default MarketingPage;
