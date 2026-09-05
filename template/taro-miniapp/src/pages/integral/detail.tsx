import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { getIntegralProduct, type IntegralProduct } from '../../services/integral';
import './index.scss';

const IntegralDetailPage = () => {
  const id = Number(useRouter().params['id'] ?? 0);
  const [product, setProduct] = useState<IntegralProduct>();
  const [failed, setFailed] = useState(false);
  useEffect(() => { void getIntegralProduct(id).then(setProduct).catch(() => setFailed(true)); }, [id]);
  if (failed) return <View className='page integralPage'><View className='card empty'><Text>积分商品不存在</Text><Button onClick={() => Taro.navigateBack()}>返回</Button></View></View>;
  if (!product) return <View className='page integralPage'><View className='card empty'><Text>加载中…</Text></View></View>;
  const unavailable = product.stock <= 0 || !product.unique;
  return <View className='page integralPage'><View className='card detailCard'><Image className='detailImage' mode='aspectFill' src={product.image} /><Text className='title'>{product.name}</Text><Text className='primary'>{product.integral} 积分</Text><Text className='hint'>库存 {product.stock}</Text>{product.description && <Text className='description'>{product.description}</Text>}</View><Button className='primaryButton' disabled={unavailable} onClick={() => Taro.navigateTo({ url: `/pages/integral/confirm?id=${product.id}` })}>{unavailable ? '暂不可兑换' : '立即兑换'}</Button></View>;
};

export default IntegralDetailPage;
