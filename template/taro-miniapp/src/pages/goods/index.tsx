import { useEffect, useMemo, useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { queryProducts } from '../../services/api';
import type { Product } from '../../services/api';
import { addToCart } from '../../services/cart';
import { OptimizedImage, Tabs } from '../../components';
import './index.scss';

const GoodsPage = () => {
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部');

  useDidShow(() => {
    const pendingKeyword = Taro.getStorageSync<string>('crmeb_search_keyword');
    if (pendingKeyword) {
      setKeyword(pendingKeyword);
      Taro.removeStorageSync('crmeb_search_keyword');
    }
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void queryProducts({ keyword: keyword.trim(), category })
      .then((result) => { if (active) setProducts(result); })
      .catch(() => { if (active) { setProducts([]); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [keyword, category]);

  const visible = useMemo(() => products, [products]);
  return <View className='page'>
    <Text className='title'>商品分类</Text>
    <Input className='search' value={keyword} onInput={(event) => setKeyword(event.detail.value)} placeholder='搜索商品' />
    <Tabs value={category} onChange={setCategory} items={['全部', '新品', '热卖', '家居'].map((item) => ({ key: item, label: item }))} />
    {loading && <View className='card empty'><Text>正在加载商品…</Text></View>}
    {!loading && failed && <View className='card empty'><Text>商品加载失败，请稍后重试</Text></View>}
    {!loading && !failed && visible.length === 0 && <View className='card empty'><Text>没有找到相关商品</Text></View>}
    <View className='grid'>
      {!loading && !failed && visible.map((product) => <View className='product card' key={product.id} onClick={() => void Taro.navigateTo({ url: `/pages/detail/index?id=${product.id}` })}>
        <OptimizedImage mode='aspectFill' src={product.image} />
        <Text>{product.name}</Text>
        <Text className='primary'>¥{product.price.toFixed(2)}</Text>
        <Button onClick={(event) => { event.stopPropagation(); addToCart(product); void Taro.showToast({ title: '已加入购物车', icon: 'success' }); }}>加入购物车</Button>
      </View>)}
    </View>
  </View>;
};

export default GoodsPage;
