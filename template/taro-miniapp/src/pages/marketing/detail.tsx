import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Loading } from '../../components';
import { getMarketingDetail, type MarketingItem, type MarketingKind } from '../../services/marketing';

const parseKind = (value: string | undefined): MarketingKind => {
  switch (value) {
    case 'seckill': case 'combination': case 'bargain': case 'advance': case 'lottery': case 'coupon': case 'member': case 'red-packet': case 'sign': return value;
    default: return 'seckill';
  }
};

const DetailPage = () => { const { params } = useRouter(); const kind = parseKind(params.kind); const id = Number(params.id ?? 0); const [item, setItem] = useState<MarketingItem>(); const [failed, setFailed] = useState(false); useEffect(() => { if (!id) return; void getMarketingDetail(kind, id).then(setItem).catch(() => setFailed(true)); }, [kind, id]); if (failed) return <View className='page card'><Text>活动已结束或不存在</Text></View>; if (!item) return <View className='page card'><Loading label='正在加载活动详情' /></View>; return <View className='page'><View className='card detail'>{item.image && <Image src={item.image} mode='aspectFit' /> }<Text className='title'>{item.title}</Text>{item.price !== undefined && <Text className='price'>¥{item.price.toFixed(2)}</Text>}<Text className='hint'>价格、库存与参与资格以服务端实时校验为准</Text><Button className='primary-action' onClick={() => void Taro.navigateTo({ url: `/pages/order/confirm?activity=${kind}&id=${id}` })}>立即参与</Button></View></View>; };
export default DetailPage;
