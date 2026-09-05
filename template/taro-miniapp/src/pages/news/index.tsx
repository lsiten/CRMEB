import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { getArticleBanners, getArticleCategories, getArticles, type Article, type ArticleCategory } from '../../services/content';
import './index.scss';

const NewsPage = () => {
  const [articles, setArticles] = useState<readonly Article[]>([]); const [banners, setBanners] = useState<readonly Article[]>([]); const [categories, setCategories] = useState<readonly ArticleCategory[]>([]); const [active, setActive] = useState(0); const [error, setError] = useState(false);
  useEffect(() => { void Promise.all([getArticleBanners(), getArticleCategories(), getArticles()]).then(([hero, cats, rows]) => { setBanners(hero); setCategories(cats); setArticles(rows); }).catch((reason: unknown) => { setError(true); if (reason instanceof ApiError) void Taro.showToast({ title: reason.message, icon: 'none' }); }); }, []);
  const select = (id: number): void => { setActive(id); void getArticles(id).then(setArticles).catch(() => void Taro.showToast({ title: '资讯加载失败', icon: 'none' })); };
  return <View className='page newsPage'>{banners.length > 0 && <Swiper className='banner' autoplay circular indicatorDots>{banners.map((item) => <SwiperItem key={item.id} onClick={() => void Taro.navigateTo({ url: `/pages/news-detail/index?id=${item.id}` })}><Image src={item.images[0] ?? ''} mode='aspectFill' /></SwiperItem>)}</Swiper>}<View className='tabs'><Text className={active === 0 ? 'active' : ''} onClick={() => select(0)}>热门</Text>{categories.map((category) => <Text key={category.id} className={active === category.id ? 'active' : ''} onClick={() => select(category.id)}>{category.title}</Text>)}</View>{error && <View className='empty'>资讯暂时无法加载</View>}{!error && articles.length === 0 && <View className='empty'>暂无资讯</View>}{articles.map((item) => <View className='article card' key={item.id} onClick={() => void Taro.navigateTo({ url: `/pages/news-detail/index?id=${item.id}` })}><View className='articleText'><Text className='title'>{item.title}</Text><Text className='meta'>{item.createdAt ?? ''}</Text></View>{item.images[0] && <Image src={item.images[0]} mode='aspectFill' />}</View>)}</View>;
};
export default NewsPage;
