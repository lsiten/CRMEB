import { useEffect, useMemo, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { getProducts, type Product } from '../../services/api';
import { addToCart } from '../../services/cart';
import { isFavorite, toggleFavorite } from '../../services/favorites';
import './index.scss';

const DetailPage = () => {
  const router = useRouter();
  const productId = Number(router.params['id'] ?? 0);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSpec, setSelectedSpec] = useState('默认规格');
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    void getProducts().then((products) => {
      const found = products.find((item) => item.id === productId) ?? products[0] ?? null;
      setProduct(found);
      if (found) setFavorite(isFavorite(found.id));
    }).catch(() => setError(true));
  }, [productId]);
  const specs = useMemo(() => product?.specs?.length ? product.specs : ['默认规格'], [product]);
  if (error) return <View className='page'><View className='card detail-state'><Text>商品暂时无法加载</Text><Button onClick={() => Taro.navigateBack()}>返回</Button></View></View>;
  if (!product) return <View className='page'><View className='card detail-state'><Text>正在加载商品…</Text></View></View>;
  const canBuy = (product.stock ?? 1) > 0;
  return <View className='page detail-page'>
    <Image className='hero-image' mode='aspectFill' src={product.image} />
    <View className='card detail-card'><Text className='detail-name'>{product.name}</Text><Text className='primary detail-price'>¥{product.price.toFixed(2)}</Text><Text className='stock'>{canBuy ? `库存 ${product.stock ?? '充足'}` : '暂时缺货'}</Text></View>
    <View className='card spec-card'><Text className='section-title'>规格</Text><View className='specs'>{specs.map((spec) => <Text key={spec} className={selectedSpec === spec ? 'spec active' : 'spec'} onClick={() => setSelectedSpec(spec)}>{spec}</Text>)}</View></View>
    <View className='card description'><Text className='section-title'>商品详情</Text><Text>{product.description ?? '精选好物，品质保障。'}</Text></View>
    <View className='detail-actions'><Button className={favorite ? 'favorite active' : 'favorite'} onClick={() => setFavorite(toggleFavorite(product))}>{favorite ? '已收藏' : '收藏'}</Button><Button className='cart-action' disabled={!canBuy} onClick={() => { addToCart(product); void Taro.showToast({ title: '已加入购物车', icon: 'success' }); }}>加入购物车</Button><Button className='buy-action' disabled={!canBuy} onClick={() => void Taro.showToast({ title: '请先登录', icon: 'none' })}>立即购买</Button></View>
  </View>;
};

export default DetailPage;
