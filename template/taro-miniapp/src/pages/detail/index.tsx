import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, RichText, Text, View } from '@tarojs/components';
import { CommerceImage } from '../../components/commerce-image';
import Taro, { useRouter } from '@tarojs/taro';
import { getProduct, type Product } from '../../services/api';
import { createDirectCheckout } from '../../services/cart';
import { addServerCart } from '../../services/server-cart';
import { commerceError } from '../../services/commerce-contracts';
import { sanitizeRichText } from '../../services/content';
import { setFavorite as saveFavorite } from '../../services/favorites';
import { requireLogin } from '../../services/auth-flow';
import './index.scss';

const DetailPage = () => {
  const router = useRouter();
  const productId = Number(router.params['id'] ?? 0);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const favoriteLock = useRef(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [adding, setAdding] = useState(false);
  const addLock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setSelectedSpec('');
    void getProduct(productId).then((found) => {
      if (!active) return;
      setProduct(found);
      setFavorite(found.collected === true);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, retry]);
  const specs = useMemo(() => product?.specs?.length ? product.specs : ['默认规格'], [product]);
  const activeSpec = selectedSpec || specs[0] || '默认规格';
  if (loading) return <View className='page'><View className='card detail-state'><Text>正在加载商品…</Text></View></View>;
  if (error) return <View className='page'><View className='card detail-state'><Text>商品暂时无法加载</Text><Button onClick={() => setRetry((value) => value + 1)}>重试</Button><Button onClick={() => Taro.navigateBack()}>返回</Button></View></View>;
  if (!product) return <View className='page'><View className='card detail-state'><Text>商品不存在</Text><Button onClick={() => Taro.navigateBack()}>返回</Button></View></View>;
  const variant = product.variants?.find((item) => item.label === activeSpec);
  const selectedProduct: Product = variant ? { ...product, price: variant.price, stock: variant.stock, unique: variant.unique, image: variant.image || product.image } : product;
  const canBuy = (selectedProduct.stock ?? 0) > 0;
  const toggleFavorite = async (): Promise<void> => {
    if (favoriteLock.current || !requireLogin(`/pages/detail/index?id=${product.id}`)) return;
    favoriteLock.current = true; setSavingFavorite(true);
    try {
      await saveFavorite(product.id, !favorite);
      setFavorite(!favorite);
    } catch (cause) { await Taro.showToast({ title: commerceError(cause), icon: 'none' }); }
    finally { favoriteLock.current = false; setSavingFavorite(false); }
  };
  const buy = (): void => {
    if (!requireLogin(`/pages/detail/index?id=${product.id}`)) return;
    const selection = encodeURIComponent(createDirectCheckout(selectedProduct, activeSpec));
    void Taro.navigateTo({ url: `/pages/order/confirm?selection=${selection}` });
  };
  const add = async (): Promise<void> => {
    if (addLock.current || !requireLogin(`/pages/detail/index?id=${product.id}`)) return;
    addLock.current = true;
    setAdding(true);
    try {
      await addServerCart({ product: selectedProduct, quantity: 1, direct: false });
      await Taro.showToast({ title: '已加入购物车', icon: 'success' });
    } catch (cause) { await Taro.showToast({ title: commerceError(cause), icon: 'none' }); }
    finally { addLock.current = false; setAdding(false); }
  };
  return <View className='page detail-page'>
    <CommerceImage className='hero-image' mode='aspectFit' src={selectedProduct.image} />
    <View className='card detail-card'><Text className='detail-name'>{product.name}</Text><Text className='primary detail-price'>¥{selectedProduct.price.toFixed(2)}</Text><Text className='stock'>{canBuy ? `库存 ${selectedProduct.stock}` : '暂时缺货'}</Text></View>
    <View className='card spec-card'><Text className='section-title'>规格</Text><View className='specs'>{specs.map((spec) => <Button key={spec} aria-label={`${spec}${activeSpec === spec ? '，已选中' : ''}`} className={activeSpec === spec ? 'spec active' : 'spec'} onClick={() => setSelectedSpec(spec)}>{spec}</Button>)}</View></View>
    <View className='card'><Button onClick={() => Taro.navigateTo({ url: `/pages-extra/reviews/index?product_id=${product.id}` })}>查看商品评价</Button></View>
    <View className='card description'><Text className='section-title'>商品详情</Text>{product.description ? <RichText nodes={sanitizeRichText(product.description)} /> : <Text>暂无商品详情</Text>}</View>
    <View className='detail-actions'><Button className={favorite ? 'favorite active' : 'favorite'} disabled={savingFavorite} loading={savingFavorite} onClick={() => void toggleFavorite()}>{favorite ? '已收藏' : '收藏'}</Button><Button className='cart-action' disabled={!canBuy || adding} loading={adding} onClick={() => void add()}>加入购物车</Button><Button className='buy-action' disabled={!canBuy || adding} onClick={buy}>立即购买</Button></View>
  </View>;
};

export default DetailPage;
