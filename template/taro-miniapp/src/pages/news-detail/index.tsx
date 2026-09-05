import { Image, RichText, Text, View, Video } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { extractVideoUrl, getArticle, sanitizeRichText, type Article } from '../../services/content';
import './index.scss';

const NewsDetailPage = () => { const { params } = useRouter(); const [article, setArticle] = useState<Article | null>(null); const [error, setError] = useState(false); useEffect(() => { const id = Number(params["id"]); if (!Number.isSafeInteger(id) || id <= 0) { setError(true); return; } setError(false); void getArticle(id).then(setArticle).catch(() => { setError(true); void Taro.showToast({ title: '资讯不存在', icon: 'none' }); }); }, [params["id"]]); if (error) return <View className='page empty'>资讯加载失败，请返回重试</View>; if (!article) return <View className='page empty'>正在加载…</View>; const html = sanitizeRichText(article.content ?? article.summary ?? ''); const video = article.video ?? extractVideoUrl(html); return <View className='page newsDetail'><Text className='title'>{article.title}</Text><Text className='meta'>{article.category ?? ''}　{article.createdAt ?? ''}　阅读 {article.views ?? 0}</Text>{article.images[0] && <Image className='cover' src={article.images[0]} mode='widthFix' />}<RichText nodes={html.replace(/<video[\s\S]*?<\/video>/gi, '')} />{video && <Video className='video' src={video} controls />}</View>; };
export default NewsDetailPage;
