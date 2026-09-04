import { useEffect, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { getProducts } from '../../services/api';
import type { Product } from '../../services/api';
import './index.scss';

const GoodsPage = () => {
  const [products, setProducts] = useState<readonly Product[]>([]);
  useEffect(() => { void getProducts().then(setProducts).catch(() => setProducts([])); }, []);
  return <View className='page'><Text className='title'>商品分类</Text><View className='grid'>
    {(products.length > 0 ? products : [{ id: 1, name: '示例商品', price: 99, image: 'https://dummyimage.com/320x320/f4f4f4/999&text=Product' }]).map((product) => <View className='product card' key={product.id}><Image mode='aspectFill' src={product.image} /><Text>{product.name}</Text><Text className='primary'>¥{product.price.toFixed(2)}</Text></View>)}
  </View></View>;
};

export default GoodsPage;
