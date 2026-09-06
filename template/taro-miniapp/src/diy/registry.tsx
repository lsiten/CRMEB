import { Text, Video, View } from '@tarojs/components';
import type { ComponentType, ReactNode } from 'react';
import type { DiyItem } from './normalize';
import { ActivityBlock, GenericSection, ProductList, PromotionTabs, SignIn } from './commerce-renderers';
import { HeaderSearch, HomeComb, Hotspot, MenuGrid, PageFooter, Picture, RichTextBlock, TabNav, type DiyRendererProps } from './home-renderers';
import { imageValue, nestedValue, textValue } from './render-values';

export type { DiyRendererProps };
export type DiyRegistration = Readonly<{ version: string; pages: readonly string[]; render: ComponentType<DiyRendererProps> }>;

const Placeholder = ({ item }: DiyRendererProps) => <View className='diy-placeholder'><Text>{textValue(item, 'message') || `暂不支持当前版本：${item.name}`}</Text></View>;
const Blank = () => <View className='diy-blank' />;
const Media = ({ item }: DiyRendererProps) => {
  const src = imageValue(nestedValue(item, 'videoConfig'));
  return src ? <Video className='diy-picture' src={src} controls /> : <View className='diy-media'><Text>视频尚未配置</Text></View>;
};
const allPages = ['index', 'topic', 'user', 'detail'] as const;
const genericNames = ['member', 'userInfor', 'newVip', 'articleList', 'coupon', 'customerService', 'guide', 'liveBroadcast', 'news', 'titles', 'presale', 'pointsMall', 'follow', 'productInfo', 'home_paid_vip', 'productService', 'homeReviews', 'productDesc', 'customComponent'] as const;
const registry: Record<string, DiyRegistration> = {
  homeComb: { version: '2.0.0', pages: allPages, render: HomeComb }, headerSerch: { version: '2.0.0', pages: allPages, render: HeaderSearch }, tabNav: { version: '2.0.0', pages: allPages, render: TabNav },
  menus: { version: '2.0.0', pages: allPages, render: MenuGrid }, hotspot: { version: '2.0.0', pages: allPages, render: Hotspot }, pageFoot: { version: '2.0.0', pages: allPages, render: PageFooter },
  goodList: { version: '2.0.0', pages: allPages, render: ProductList }, goodRecommend: { version: '2.0.0', pages: allPages, render: ProductList }, pictureCube: { version: '2.0.0', pages: allPages, render: Picture },
  promotionList: { version: '2.0.0', pages: allPages, render: PromotionTabs }, bargain: { version: '2.0.0', pages: allPages, render: ActivityBlock }, combination: { version: '2.0.0', pages: allPages, render: ActivityBlock }, seckill: { version: '2.0.0', pages: allPages, render: ActivityBlock }, signIn: { version: '2.0.0', pages: allPages, render: SignIn },
  swiperBg: { version: '2.0.0', pages: allPages, render: HomeComb }, swipers: { version: '2.0.0', pages: allPages, render: HomeComb }, picture: { version: '2.0.0', pages: allPages, render: Picture }, richText: { version: '2.0.0', pages: allPages, render: RichTextBlock }, videos: { version: '2.0.0', pages: allPages, render: Media }, blankPage: { version: '2.0.0', pages: allPages, render: Blank },
};
for (const name of genericNames) registry[name] = { version: '2.0.0', pages: allPages, render: GenericSection };
export function getDiyRegistration(name: string): DiyRegistration | undefined { return registry[name]; }
export function DiyRenderer({ item, page = 'index' }: { item: DiyItem; page?: string }): ReactNode { const registration = getDiyRegistration(item.name); if (!registration || !registration.pages.includes(page)) return <Placeholder item={item} />; try { const Component = registration.render; return <Component item={item} />; } catch { return <Placeholder item={item} />; } }
