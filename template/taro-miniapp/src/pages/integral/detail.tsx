import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { getIntegralProduct, type IntegralProduct } from '../../services/integral';

const IntegralDetailPage = () => {
  const [product, setProduct] = useState<IntegralProduct | null>(null);
  const [failed, setFailed] = useState(false);
  useLoad(({ id }) => {
    const productId = Number(id);
    if (!Number.isSafeInteger(productId) || productId <= 0) { setFailed(true); return; }
    void getIntegralProduct(productId).then(setProduct).catch(() => setFailed(true));
  });
  if (failed) return <View className='page'><Text>商品不存在或加载失败</Text></View>;
  if (!product) return <View className='page'><Text>加载中…</Text></View>;
  return <View className='page'><Image mode='aspectFill' src={product.image} /><View className='card'><Text>{product.name}</Text><Text className='primary'>{product.integral} 积分</Text><Text>库存 {product.stock}</Text>{product.description && <Text>{product.description}</Text>}<Button disabled={!product.unique || product.stock <= 0} onClick={() => Taro.navigateTo({ url: `/pages/integral/confirm?unique=${encodeURIComponent(product.unique ?? '')}` })}>立即兑换</Button></View></View>;
};

export default IntegralDetailPage;
