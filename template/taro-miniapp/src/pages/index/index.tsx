import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getDiyPage } from '../../services/diy';
import type { DiyPage } from '../../diy/normalize';
import { DiyRenderer } from '../../diy/registry';
import './index.scss';

const fallback: DiyPage = { title: 'CRMEB商城', version: '', schema_version: 1, background: {}, items: [], raw: null };
const IndexPage = () => {
  const [page, setPage] = useState<DiyPage>(fallback); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const load = () => { setLoading(true); setError(false); void getDiyPage('index').then(setPage).catch(() => { setPage(fallback); setError(true); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <View className='page'>{loading && <View className='card'><Text>正在加载首页…</Text></View>}{error && <View className='card error'><Text>首页暂时无法加载</Text><Button size='mini' onClick={load}>重试</Button></View>}{!loading && !error && page.items.map((item, index) => <View key={`${item.name}-${index}`} className='diy-item'><DiyRenderer item={item} page='index' /></View>)}{!loading && !error && page.items.length === 0 && <View className='card'><Text>暂无装修内容</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/goods/index' })}>去逛逛</Button></View>}</View>;
};

export default IndexPage;
