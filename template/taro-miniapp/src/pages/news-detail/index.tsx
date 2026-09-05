import { Image, RichText, Text, View, Video } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { getArticle, sanitizeRichText, type Article } from '../../services/content';
import './index.scss';

const NewsDetailPage = () => { const { params } = useRouter(); const [article, setArticle] = useState<Article | null>(null); useEffect(() => { const id = Number(params["id"]); if (Number.isSafeInteger(id) && id > 0) void getArticle(id).then(setArticle).catch(() => void Taro.showToast({ title: '资讯不存在', icon: 'none' })); }, [params["id"]]); if (!article) return <View className='page empty'>正在加载…</View>; const html = sanitizeRichText(article.content ?? article.summary ?? ''); return <View className='page newsDetail'><Text className='title'>{article.title}</Text><Text className='meta'>{article.category ?? ''}　{article.createdAt ?? ''}　阅读 {article.views ?? 0}</Text>{article.images[0] && <Image className='cover' src={article.images[0]} mode='widthFix' />}<RichText nodes={html} />{/<video\b/i.test(html) && <Video className='video' src='' controls />}</View>; };
export default NewsDetailPage;
