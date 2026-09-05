import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Button, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { queryProducts } from '../../services/api';
import type { Product } from '../../services/api';
import { addToCart } from '../../services/cart';
import './index.scss';

const GoodsPage = () => {
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部');
  const { params } = useRouter();
  useEffect(() => { if (params['keyword']) setKeyword(params['keyword']); }, [params['keyword']]);
  useEffect(() => { void queryProducts({ keyword, category }).then(setProducts).catch(() => setProducts([])); }, [keyword, category]);
  const source = products.length > 0 ? products : [{ id: 1, name: '示例商品', price: 99, image: 'https://dummyimage.com/320x320/f4f4f4/999&text=Product' }];
  const visible = useMemo(() => source, [source]);
  return <View className='page'><Text className='title'>商品分类</Text><Input className='search' value={keyword} onInput={(event) => setKeyword(event.detail.value)} placeholder='搜索商品' /><View className='categories'>{['全部', '新品', '热卖', '家居'].map((item) => <Text className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</Text>)}</View><View className='grid'>
    {visible.map((product) => <View className='product card' key={product.id} onClick={() => Taro.navigateTo({ url: `/pages/goods/detail?id=${product.id}` })}><Image mode='aspectFill' src={product.image} /><Text>{product.name}</Text><Text className='primary'>¥{product.price.toFixed(2)}</Text><Button onClick={(event) => { event.stopPropagation(); addToCart(product); void Taro.showToast({ title: '已加入购物车', icon: 'success' }); }}>加入购物车</Button></View>)}
  </View></View>;
};

export default GoodsPage;
