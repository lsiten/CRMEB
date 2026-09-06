import { Image, RichText, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import type { CSSProperties } from 'react';
import type { DiyItem } from './normalize';
import { arrayValue, colorValue, configList, imageValue, nestedText, nestedValue, numberValue, recordValue, textValue } from './render-values';

export type DiyRendererProps = Readonly<{ item: DiyItem }>;

const SearchBar = ({ item }: DiyRendererProps) => {
  const logo = imageValue(nestedValue(item, 'logoConfig'));
  const title = nestedText(item, [['titleConfig', 'value']]);
  const placeholder = nestedText(item, [['inputConfig', 'value'], ['tipConfig', 'value']]) || '搜索商品';
  return <View className='diy-search'>
    {logo ? <Image className='diy-search__logo' mode='heightFix' src={logo} /> : title && <Text className='diy-search__title'>{title}</Text>}
    <View className='diy-search__input'><Text className='diy-search__icon'>⌕</Text><Text className='diy-search__placeholder'>{placeholder}</Text></View>
  </View>;
};

const Banner = ({ item }: DiyRendererProps) => {
  const slides = configList(item, ['swiperConfig', 'list'], ['list']).map(imageValue).filter(Boolean);
  return slides.length ? <Swiper className='diy-swiper' autoplay circular indicatorDots>
    {slides.map((src, index) => <SwiperItem key={`${src}-${index}`}><Image className='diy-swiper-image' mode='aspectFill' src={src} /></SwiperItem>)}
  </Swiper> : null;
};

export const HomeComb = ({ item }: DiyRendererProps) => {
  const tabs = configList(item, ['tabListConfig', 'list']);
  return <View className='diy-home-comb' style={{ background: colorValue(item['componentBgConfig'], 'var(--color-brand)') }}>
    <SearchBar item={item} />
    {tabs.length > 0 && <View className='diy-home-tabs'>{tabs.map((tab, index) => <Text className={`diy-home-tabs__item${index === 0 ? ' is-active' : ''}`} key={`${nestedText(tab, [['text', 'val']])}-${index}`}>{nestedText(tab, [['text', 'val']])}</Text>)}</View>}
    <Banner item={item} />
  </View>;
};

export const HeaderSearch = ({ item }: DiyRendererProps) => <View className='diy-header-search'><SearchBar item={item} /></View>;

export const TabNav = ({ item }: DiyRendererProps) => {
  const tabs = configList(item, ['tabListConfig', 'list'], ['menuConfig', 'list'], ['list']);
  return <View className='diy-tab-nav'>{tabs.map((tab, index) => <Text className={`diy-tab-nav__item${index === 0 ? ' is-active' : ''}`} key={index}>{nestedText(tab, [['text', 'val'], ['info', '0', 'value']]) || textValue(tab, 'name', 'title')}</Text>)}</View>;
};

export const MenuGrid = ({ item }: DiyRendererProps) => {
  const menu = configList(item, ['menuConfig', 'list'], ['menuList']);
  const columns = Math.min(5, Math.max(3, numberValue(nestedValue(item, 'number', 'tabVal'), 2) + 3));
  const style: CSSProperties = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return <View className='diy-menu' style={style}>{menu.map((entry, index) => {
    const image = imageValue(entry);
    const label = nestedText(entry, [['info', '0', 'value']]) || textValue(entry, 'name', 'title');
    return <View className='diy-menu__item' key={`${label}-${index}`}>{image && <Image className='diy-menu__icon' mode='aspectFit' src={image} />}<Text className='diy-menu__label'>{label}</Text></View>;
  })}</View>;
};

export const Hotspot = ({ item }: DiyRendererProps) => {
  const src = imageValue(nestedValue(item, 'picStyle')) || imageValue(item);
  return src ? <View className='diy-hotspot'><Image className='diy-hotspot__image' mode='widthFix' src={src} /></View> : null;
};

export const Picture = ({ item }: DiyRendererProps) => {
  const src = imageValue(item);
  return src ? <Image className='diy-picture' mode='widthFix' src={src} /> : null;
};

export const RichTextBlock = ({ item }: DiyRendererProps) => {
  const nodes = nestedText(item, [['richText', 'val']]) || textValue(item, 'content', 'text');
  return nodes ? <View className='diy-rich-text'><RichText nodes={nodes} /></View> : null;
};

export const PageFooter = ({ item }: DiyRendererProps) => {
  const menu = configList(item, ['menuList']);
  const textColor = colorValue(item['txtColor'], 'var(--color-text-secondary)');
  const activeColor = colorValue(item['activeTxtColor'], 'var(--color-brand)');
  return <View className='diy-footer' style={{ background: colorValue(item['bgColor'], 'var(--color-surface)') }}>{menu.map((entry, index) => {
    const row = recordValue(entry);
    const images = arrayValue(row['imgList']);
    const src = imageValue(images[index === 0 ? 0 : 1] ?? images[0]);
    const label = textValue(entry, 'name', 'title');
    return <View className='diy-footer__item' key={`${label}-${index}`}>{src && <Image className='diy-footer__icon' mode='aspectFit' src={src} />}<Text className={`diy-footer__label${index === 0 ? ' is-active' : ''}`} style={{ color: index === 0 ? activeColor : textColor }}>{label}</Text></View>;
  })}</View>;
};
