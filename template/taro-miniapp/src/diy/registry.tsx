import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import type { ComponentType, ReactNode } from 'react';
import { sanitizeDiyImageUrl, type DiyItem } from './normalize';

export type DiyRendererProps = { item: DiyItem };
export type DiyRegistration = Readonly<{ version: string; pages: readonly string[]; render: ComponentType<DiyRendererProps> }>;

const textValue = (item: DiyItem, ...keys: readonly string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
};
const imageValue = (value: unknown): string => {
  if (typeof value === 'object' && value !== null) {
    const row = value as Record<string, unknown>;
    return imageValue(row['image'] ?? row['img'] ?? row['pic'] ?? row['url']);
  }
  return sanitizeDiyImageUrl(value);
};
const listValue = (item: DiyItem): readonly unknown[] => {
  const value = item['list'] ?? item['data'] ?? item['value'] ?? item['goods'] ?? item['menus'];
  return Array.isArray(value) ? value : [];
};
const Placeholder = ({ item }: DiyRendererProps) => <View className='diy-placeholder'><Text>{textValue(item, 'message') || `暂不支持当前版本：${item.name}`}</Text></View>;
const TextBlock = ({ item }: DiyRendererProps) => <View className='diy-text'><Text>{textValue(item, 'text', 'title', 'val', 'content')}</Text></View>;
const Picture = ({ item }: DiyRendererProps) => { const src = imageValue(item); return src ? <Image className='diy-picture' mode='aspectFill' src={src} /> : <Placeholder item={{ ...item, message: '图片地址不受信任' }} />; };
const SwiperBlock = ({ item }: DiyRendererProps) => { const slides = listValue(item).map(imageValue).filter(Boolean); return slides.length ? <Swiper className='diy-swiper' autoplay circular indicatorDots>{slides.map((src, index) => <SwiperItem key={`${src}-${index}`}><Image className='diy-swiper-image' mode='aspectFill' src={src} /></SwiperItem>)}</Swiper> : <Picture item={item} />; };
const CardList = ({ item }: DiyRendererProps) => { const rows = listValue(item); return <View className='diy-card-list'>{rows.length ? rows.map((row, index) => { const record = typeof row === 'object' && row !== null ? row as Record<string, unknown> : {}; const image = imageValue(record); return <View className='diy-card' key={String(record['id'] ?? index)}>{image && <Image className='diy-card-image' mode='aspectFill' src={image} />}<View className='diy-card-body'><Text className='diy-card-title'>{textValue(record as DiyItem, 'store_name', 'name', 'title', 'productName') || '精选商品'}</Text>{textValue(record as DiyItem, 'price', 'sales') && <Text className='diy-card-price'>¥{textValue(record as DiyItem, 'price', 'sales')}</Text>}</View></View>; }) : <TextBlock item={item} />}</View>; };
const Blank = () => <View className='diy-blank' />;
const RichText = ({ item }: DiyRendererProps) => <View className='diy-rich-text'><Text>{textValue(item, 'content', 'text', 'title')}</Text></View>;
const Media = ({ item }: DiyRendererProps) => <View className='diy-media'><Picture item={item} />{textValue(item, 'title', 'text') && <Text>{textValue(item, 'title', 'text')}</Text>}</View>;
const allPages = ['index', 'topic', 'user', 'detail'] as const;
const textNames = ['headerSerch', 'tabNav', 'member', 'userInfor', 'newVip', 'articleList', 'bargain', 'combination', 'coupon', 'customerService', 'guide', 'liveBroadcast', 'menus', 'news', 'titles', 'presale', 'pointsMall', 'signIn', 'follow', 'productInfo', 'home_paid_vip', 'productService', 'homeReviews', 'productDesc', 'customComponent'] as const;
const listNames = ['goodList', 'goodRecommend', 'promotionList', 'seckill', 'pictureCube', 'homeComb'] as const;
const registry: Record<string, DiyRegistration> = { swiperBg: { version: '1.0.0', pages: allPages, render: SwiperBlock }, swipers: { version: '1.0.0', pages: allPages, render: SwiperBlock }, picture: { version: '1.0.0', pages: allPages, render: Picture }, richText: { version: '1.0.0', pages: allPages, render: RichText }, videos: { version: '1.0.0', pages: allPages, render: Media }, hotspot: { version: '1.0.0', pages: allPages, render: Picture }, blankPage: { version: '1.0.0', pages: allPages, render: Blank } };
for (const name of textNames) registry[name] = { version: '1.0.0', pages: allPages, render: TextBlock };
for (const name of listNames) registry[name] = { version: '1.0.0', pages: allPages, render: CardList };
export function getDiyRegistration(name: string): DiyRegistration | undefined { return registry[name]; }
export function DiyRenderer({ item, page = 'index' }: { item: DiyItem; page?: string }): ReactNode { const registration = getDiyRegistration(item.name); if (!registration || !registration.pages.includes(page)) return <Placeholder item={item} />; try { const Component = registration.render; return <Component item={item} />; } catch { return <Placeholder item={item} />; } }
