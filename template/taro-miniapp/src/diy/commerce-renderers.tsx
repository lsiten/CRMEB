import { Image, Text, View } from '@tarojs/components';
import type { DiyItem } from './normalize';
import { colorValue, configList, imageValue, nestedText, nestedValue, numberValue, recordValue, textValue } from './render-values';
import type { DiyRendererProps } from './home-renderers';

type ProductGridProps = Readonly<{ rows: readonly unknown[]; compact?: boolean }>;

const ProductGrid = ({ rows, compact = false }: ProductGridProps) => <View className={`diy-products${compact ? ' is-compact' : ''}`}>{rows.map((entry, index) => {
  const row = recordValue(entry);
  const image = imageValue(row);
  const name = textValue(row, 'store_name', 'productName', 'title', 'name') || '精选商品';
  const price = textValue(row, 'price', 'product_price');
  const original = textValue(row, 'ot_price');
  return <View className='diy-product' key={String(row['id'] ?? index)}>{image && <Image className='diy-product__image' mode='aspectFill' src={image} />}<View className='diy-product__body'><Text className='diy-product__name'>{name}</Text><View className='diy-product__price-row'>{price && <Text className='diy-product__price'>¥{price}</Text>}{original && <Text className='diy-product__original'>¥{original}</Text>}</View></View></View>;
})}</View>;

export const ProductList = ({ item }: DiyRendererProps) => {
  const rows = configList(item, ['goodsList', 'list'], ['productList', 'list'], ['goods'], ['list']);
  const compact = numberValue(nestedValue(item, 'styleConfig', 'tabVal')) === 5;
  return rows.length ? <ProductGrid rows={rows} compact={compact} /> : null;
};

export const PromotionTabs = ({ item }: DiyRendererProps) => {
  const tabs = configList(item, ['tabConfig', 'list']);
  const active = tabs[0];
  const rows = configList(recordValue(active), ['goodsList', 'list'], ['productList', 'list']);
  return <View className='diy-promotion'><View className='diy-promotion__tabs'>{tabs.map((tab, index) => <View className={`diy-promotion__tab${index === 0 ? ' is-active' : ''}`} key={index}><Text className='diy-promotion__title'>{nestedText(tab, [['chiild', '0', 'val']])}</Text><Text className='diy-promotion__subtitle'>{nestedText(tab, [['chiild', '1', 'val']])}</Text></View>)}</View>{rows.length > 0 && <ProductGrid rows={rows} />}</View>;
};

const activityTitle = (item: DiyItem): string => nestedText(item, [['titleTxtConfig', 'value'], ['titleTxtConfig', 'val']]) || (typeof item['cname'] === 'string' ? item['cname'] : item.name);

export const ActivityBlock = ({ item }: DiyRendererProps) => {
  const rows = configList(item, ['goodsList', 'list'], ['productList', 'list'], ['list']);
  const titleImage = imageValue(nestedValue(item, 'imgConfig'));
  return <View className={`diy-activity diy-activity--${item.name}`}><View className='diy-section-heading'>{titleImage ? <Image className='diy-section-heading__image' mode='heightFix' src={titleImage} /> : <Text className='diy-section-heading__title'>{activityTitle(item)}</Text>}<Text className='diy-section-heading__more'>更多 ›</Text></View>{rows.length ? <ProductGrid rows={rows} compact /> : <View className='diy-activity__empty'><Text>活动商品持续上新</Text></View>}</View>;
};

export const SignIn = ({ item }: DiyRendererProps) => {
  const buttonColor = colorValue(item['bntBgColor'], 'var(--color-brand)');
  const labelColor = colorValue(item['labelTxtColor'], 'var(--color-brand)');
  return <View className='diy-sign-in'><View><Text className='diy-sign-in__title'>每日签到</Text><Text className='diy-sign-in__hint' style={{ color: labelColor }}>连续签到领积分</Text></View><Text className='diy-sign-in__button' style={{ background: buttonColor }}>立即签到</Text></View>;
};

export const GenericSection = ({ item }: DiyRendererProps) => {
  const title = textValue(item, 'title', 'cname', 'text', 'val', 'content') || item.name;
  return <View className='diy-generic-section'><Text className='diy-generic-section__title'>{title}</Text></View>;
};
