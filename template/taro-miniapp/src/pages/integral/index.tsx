import { Button, Image, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { getIntegralHome, getIntegralProducts, type IntegralProduct } from '../../services/integral';
import './index.scss';

const IntegralPage = () => {
  const [products, setProducts] = useState<readonly IntegralProduct[]>([]); const [keyword, setKeyword] = useState(''); const [failed, setFailed] = useState(false);
  const load = async (query = keyword): Promise<void> => { try { setFailed(false); setProducts(query.trim() ? await getIntegralProducts(query) : (await getIntegralHome()).list); } catch { setFailed(true); setProducts([]); } };
  useEffect(() => { void load(''); }, []);
  return <View className='page integralPage'><View className='integralHeader'><Text className='title'>积分商城</Text><Text onClick={() => Taro.navigateTo({ url: '/pages/integral/records' })}>积分明细 ›</Text></View><Input className='search' value={keyword} onInput={(event) => setKeyword(event.detail.value)} onConfirm={() => void load()} placeholder='搜索积分商品' />{failed && <View className='card empty'><Text>加载失败，请重试</Text><Button onClick={() => void load()}>重试</Button></View>}{!failed && products.length === 0 && <View className='card empty'><Text>暂无积分商品</Text></View>}<View className='grid'>{products.map((product) => <View className='card product' key={product.id} onClick={() => void Taro.navigateTo({ url: `/pages/integral/detail?id=${product.id}` })}><Image mode='aspectFill' src={product.image} /><Text>{product.name}</Text><Text className='primary'>{product.integral} 积分</Text><Text className='hint'>库存 {product.stock}</Text></View>)}</View></View>;
};

export default IntegralPage;
