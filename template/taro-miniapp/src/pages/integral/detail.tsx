import { useEffect, useMemo, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { getIntegralProduct, type IntegralProduct } from '../../services/integral';
import './index.scss';

const IntegralDetailPage = () => {
  const { params } = useRouter();
  const productId = Number(params['id'] ?? 0);
  const [product, setProduct] = useState<IntegralProduct | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setProduct(null);
    void getIntegralProduct(productId).then(setProduct).catch(() => setFailed(true));
  }, [productId]);

  const specs = useMemo(() => product?.specs?.length ? product.specs : ['默认规格'], [product]);

  if (failed) {
    return <View className='page card'><Text>积分商品暂时无法查看</Text><Button onClick={() => void Taro.navigateBack()}>返回积分商城</Button></View>;
  }
  if (!product) {
    return <View className='page card'><Text>正在加载积分商品…</Text></View>;
  }

  const canRedeem = product.stock > 0 && Boolean(product.unique);
  return <View className='page integralPage'>
    <Image className='hero-image' mode='aspectFill' src={product.image} />
    <View className='card detail-card'>
      <Text className='detail-name'>{product.name}</Text>
      <Text className='primary detail-price'>{product.integral} 积分</Text>
      <Text className='stock'>{canRedeem ? `库存 ${product.stock}` : '暂时缺货'}</Text>
    </View>
    <View className='card description'>
      <Text className='section-title'>商品详情</Text>
      <Text>{product.description ?? '精选积分商品，品质保障。'}</Text>
    </View>
    <Button className='primaryButton' disabled={!canRedeem} onClick={() => void Taro.navigateTo({ url: `/pages/integral/confirm?id=${product.id}` })}>
      {canRedeem ? '立即兑换' : '暂时缺货'}
    </Button>
    {specs.length > 0 && <View className='card'><Text className='section-title'>规格</Text><Text>{specs.join('、')}</Text></View>}
   </View>;
};

export default IntegralDetailPage;
