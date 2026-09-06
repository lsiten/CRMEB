import React from 'react';
import TestRenderer from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({
  Image: 'image',
  RichText: 'rich-text',
  Swiper: 'swiper',
  SwiperItem: 'swiper-item',
  Text: 'span',
  View: 'div',
}));

import { sanitizeDiyImageUrl, type DiyItem } from '../src/diy/normalize';
import { DiyRenderer } from '../src/diy/registry';

const render = (item: DiyItem) => TestRenderer.create(<DiyRenderer item={item} />).root;

describe('DIY component renderers', () => {
  it('rewrites uploaded theme assets to the current API origin', () => {
    expect(sanitizeDiyImageUrl('http://demo.crmeb.com/uploads/theme/banner.png'))
      .toBe('http://127.0.0.1:8080/uploads/theme/banner.png');
    expect(sanitizeDiyImageUrl('https://untrusted.example/banner.png')).toBe('');
    expect(sanitizeDiyImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
  });

  it('renders the combined header from its nested search, tabs, and swiper config', () => {
    const root = render({
      name: 'homeComb',
      inputConfig: { value: '请输入搜索词' },
      tabListConfig: { list: [{ text: { val: '生活家居' } }, { text: { val: '运动专区' } }] },
      swiperConfig: { list: [{ img: 'http://demo.crmeb.com/uploads/theme/banner.png' }] },
    });

    expect(root.findByProps({ className: 'diy-search__placeholder' }).children).toEqual(['请输入搜索词']);
    expect(root.findAll((node) => typeof node.props.className === 'string' && node.props.className.startsWith('diy-home-tabs__item')).map((node) => node.children[0])).toEqual(['生活家居', '运动专区']);
    expect(root.findByProps({ className: 'diy-swiper-image' }).props.src).toBe('http://127.0.0.1:8080/uploads/theme/banner.png');
  });

  it('renders menu, hotspot, product, rich-text, and footer component-specific data', () => {
    const menu = render({ name: 'menus', menuConfig: { list: [{ img: 'data:image/png;base64,AA==', info: [{ value: '秒杀' }] }] } });
    const hotspot = render({ name: 'hotspot', picStyle: { url: 'http://demo.crmeb.com/uploads/theme/hot.png' } });
    const products = render({ name: 'goodList', goodsList: { list: [{ id: 3, store_name: '蓝牙手表', image: 'http://demo.crmeb.com/uploads/theme/watch.png', price: 269, ot_price: 359 }] } });
    const richText = render({ name: 'richText', richText: { val: '<b>猜你喜欢</b>' } });
    const footer = render({ name: 'pageFoot', menuList: [{ name: '首页', imgList: ['data:image/png;base64,AA==', 'data:image/png;base64,BB=='] }] });

    expect(menu.findByProps({ className: 'diy-menu__label' }).children).toEqual(['秒杀']);
    expect(hotspot.findByProps({ className: 'diy-hotspot__image' }).props.src).toContain('/uploads/theme/hot.png');
    expect(products.findByProps({ className: 'diy-product__name' }).children).toEqual(['蓝牙手表']);
    expect(products.findByProps({ className: 'diy-product__image' }).props.mode).toBe('widthFix');
    expect(products.findByProps({ className: 'diy-product__original' }).children.join('')).toBe('¥359');
    expect(richText.findByType('rich-text').props.nodes).toBe('<b>猜你喜欢</b>');
    expect(footer.findByProps({ className: 'diy-footer__label is-active' }).children).toEqual(['首页']);
  });

  it('does not render an incomplete activity card without products', () => {
    const activity = TestRenderer.create(<DiyRenderer item={{ name: 'seckill', goodsList: { list: [] } }} />);

    expect(activity.toJSON()).toBeNull();
  });

  it('keeps product media square across responsive card widths', () => {
    const styles = readFileSync(new URL('../src/pages/index/index.scss', import.meta.url), 'utf8');

    expect(styles).toMatch(/\.diy-product__image\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/s);
  });

  it('aligns the H5 tab bar with the desktop content width', () => {
    const styles = readFileSync(new URL('../src/app.scss', import.meta.url), 'utf8');

    expect(styles).toMatch(/\.taro-tabbar__tabbar\s*\{[^}]*width:\s*min\(100%,\s*750PX\);[^}]*margin:\s*0 auto;/s);
  });
});
