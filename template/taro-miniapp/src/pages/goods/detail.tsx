import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import { OptimizedImage } from '../../components';
import Taro, { useRouter } from '@tarojs/taro';
import { getProduct, type Product } from '../../services/api';
import { addToCart } from '../../services/cart';
import './detail.scss';

const DetailPage = () => {
  const { params } = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const id = Number(params['id']);
    if (!Number.isSafeInteger(id) || id <= 0) { setFailed(true); return; }
    void getProduct(id).then(setProduct).catch(() => setFailed(true));
  }, [params['id']]);
  if (failed) return <View className='page card'><Text>商品暂时无法查看</Text><Button onClick={() => Taro.navigateBack()}>返回商品列表</Button></View>;
  if (!product) return <View className='page card'><Text>正在加载商品…</Text></View>;
  return <View className='page detail'><OptimizedImage className='hero' mode='aspectFill' src={product.image} /><Text className='name'>{product.name}</Text><Text className='price'>¥{product.price.toFixed(2)}</Text><Text className='stock'>{product.stock === 0 ? '暂时缺货' : `库存 ${product.stock ?? '充足'}`}</Text><Button disabled={product.stock === 0} onClick={() => { addToCart(product); void Taro.showToast({ title: '已加入购物车', icon: 'success' }); }}>加入购物车</Button></View>;
};

export default DetailPage;
