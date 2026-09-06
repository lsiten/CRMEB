import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { Empty, Loading } from '../../components';
import { getDiyPage } from '../../services/diy';
import { sanitizeDiyImageUrl, splitDiyRegions, type DiyPage } from '../../diy/normalize';
import { DiyRenderer } from '../../diy/registry';
import { nestedValue, numberValue } from '../../diy/render-values';
import './index.scss';

const fallback: DiyPage = { title: 'CRMEB商城', version: '', schema_version: 1, background: {}, items: [], raw: null };
const IndexPage = () => {
  const [page, setPage] = useState<DiyPage>(fallback); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const load = () => { setLoading(true); setError(false); void getDiyPage().then(setPage).catch(() => { setPage(fallback); setError(true); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  const regions = splitDiyRegions(page.items);
  const customFooterVisible = regions.bottom.some((item) => numberValue(nestedValue(item, 'effectConfig', 'tabVal')) === 1);
  useDidShow(() => { void (customFooterVisible ? Taro.hideTabBar() : Taro.showTabBar()); });
  useDidHide(() => { void Taro.showTabBar(); });
  useEffect(() => {
    if (customFooterVisible) void Taro.hideTabBar();
    else void Taro.showTabBar();
    return () => { void Taro.showTabBar(); };
  }, [customFooterVisible]);
  const backgroundColor = typeof page.background['color_picker'] === 'string' ? page.background['color_picker'] : 'var(--color-page)';
  const backgroundImage = sanitizeDiyImageUrl(page.background['bg_pic']);
  return <View className='page diy-page' style={{ backgroundColor, ...(backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}) }}>{loading && <View className='card'><Loading label='正在加载首页' /></View>}{error && <View className='card error'><Text>首页暂时无法加载</Text><Button size='mini' onClick={load}>重试</Button></View>}{!loading && !error && regions.top.map((item, index) => <View key={`top-${item.name}-${index}`} className='diy-item diy-item-top'><DiyRenderer item={item} page='index' /></View>)}{!loading && !error && regions.content.map((item, index) => <View key={`content-${item.name}-${index}`} className='diy-item'><DiyRenderer item={item} page='index' /></View>)}{!loading && !error && regions.bottom.map((item, index) => <View key={`bottom-${item.name}-${index}`} className='diy-item diy-item-bottom'><DiyRenderer item={item} page='index' /></View>)}{!loading && !error && page.items.length === 0 && <View className='card'><Empty title='暂无装修内容' actionLabel='去逛逛' onAction={() => Taro.navigateTo({ url: '/pages/goods/index' })} /></View>}</View>;
};

export default IndexPage;
