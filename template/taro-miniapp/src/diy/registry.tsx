import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import type { ComponentType, ReactNode } from 'react';
import { sanitizeDiyImageUrl, type DiyItem } from './normalize';

export type DiyRendererProps = { item: DiyItem };
export type DiyRegistration = Readonly<{ version: string; pages: readonly string[]; render: ComponentType<DiyRendererProps> }>;
const Placeholder = ({ item }: DiyRendererProps) => <View className='diy-placeholder'><Text>暂不支持当前版本：{item.name}</Text></View>;
const TextBlock = ({ item }: DiyRendererProps) => <View className='diy-text'><Text>{String(item['text'] ?? item['title'] ?? '')}</Text></View>;
const Picture = ({ item }: DiyRendererProps) => {
  const src = sanitizeDiyImageUrl(item['image']);
  return src ? <Image className='diy-picture' mode='aspectFill' src={src} /> : <Placeholder item={{ ...item, name: '图片地址不受信任' }} />;
};
const SwiperBlock = ({ item }: DiyRendererProps) => { const slides = Array.isArray(item['list']) ? item['list'] : []; return <Swiper autoplay circular indicatorDots>{slides.map((slide, index) => <SwiperItem key={index}><Picture item={{ ...(typeof slide === 'object' && slide !== null ? slide : {}), name: 'picture' } as DiyItem} /></SwiperItem>)}</Swiper>; };
const registry: Record<string, DiyRegistration> = {
  swiperBg: { version: '1.0.0', pages: ['index', 'topic'], render: SwiperBlock },
  headerSerch: { version: '1.0.0', pages: ['index'], render: TextBlock },
  tabNav: { version: '1.0.0', pages: ['index'], render: TextBlock },
  goodList: { version: '1.0.0', pages: ['index', 'topic'], render: TextBlock },
  goodRecommend: { version: '1.0.0', pages: ['index', 'topic'], render: TextBlock },
  member: { version: '1.0.0', pages: ['index', 'user'], render: TextBlock },
  picture: { version: '1.0.0', pages: ['index', 'topic'], render: Picture },
  richText: { version: '1.0.0', pages: ['index', 'topic'], render: TextBlock },
};
export function getDiyRegistration(name: string): DiyRegistration | undefined { return registry[name]; }
export function DiyRenderer({ item, page = 'index' }: { item: DiyItem; page?: string }): ReactNode {
  const registration = getDiyRegistration(item.name);
  if (!registration || !registration.pages.includes(page)) return <Placeholder item={item} />;
  try { const Component = registration.render; return <Component item={item} />; } catch { return <Placeholder item={item} />; }
}
