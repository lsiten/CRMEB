import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ navigateTo: vi.fn().mockResolvedValue({}), switchTab: vi.fn().mockResolvedValue({}), showToast: vi.fn().mockResolvedValue({}), setStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: nav }));
vi.mock('@tarojs/components', () => ({ Image: 'image', RichText: 'rich-text', Swiper: 'swiper', SwiperItem: 'swiper-item', Text: 'span', View: 'div', Video: 'video' }));
import { DiyRenderer } from '../src/diy/registry';
import type { DiyItem } from '../src/diy/normalize';

const render = (item: DiyItem) => TestRenderer.create(<DiyRenderer item={item} />).root;
beforeEach(() => vi.clearAllMocks());
describe('DIY user interactions', () => {
  it('opens search when the search field is clicked', async () => {
    await render({ name: 'headerSerch' }).findByProps({ className: 'diy-search__input' }).props.onClick();
    expect(nav.navigateTo).toHaveBeenCalledWith({ url: '/pages/search/index' });
  });
  it('uses the menu link rather than its label', async () => {
    await render({ name: 'menus', menuConfig: { list: [{ info: [{ value: '秒杀' }, { value: '/pages/activity/goods_seckill/index' }] }] } }).findByProps({ className: 'diy-menu__item' }).props.onClick();
    expect(nav.navigateTo).toHaveBeenCalledWith({ url: '/pages/marketing/index?kind=seckill' });
  });
  it('preserves a banner product id through the legacy route', async () => {
    await render({ name: 'homeComb', swiperConfig: { list: [{ img: 'data:image/png;base64,AA==', info: [{ value: '商品' }, { value: '/pages/goods_details/index?id=3' }] }] } }).findByProps({ className: 'diy-swiper-image' }).props.onClick();
    expect(nav.navigateTo).toHaveBeenCalledWith({ url: '/pages/detail/index?id=3' });
  });
  it('reports an unconfigured category instead of inventing a destination', async () => {
    await render({ name: 'tabNav', tabListConfig: { list: [{ text: { val: '家居' }, classPage: { id: 0 }, microPage: { id: 0 } }] } }).findByProps({ className: 'diy-tab-nav__item is-active' }).props.onClick();
    expect(nav.showToast).toHaveBeenCalledWith({ title: '该入口尚未配置链接', icon: 'none' });
    expect(nav.navigateTo).not.toHaveBeenCalled();
  });
  it('renders individually clickable hotspot regions', async () => {
    const root = render({ name: 'hotspot', picStyle: { url: 'data:image/png;base64,AA==', list: [{ starX: 0, starY: 20, areaWidth: 100, areaHeight: 80, link: '/pages/cart/index' }] } });
    await root.findByProps({ className: 'diy-hotspot__area' }).props.onClick();
    expect(nav.switchTab).toHaveBeenCalledWith({ url: '/pages/cart/index' });
  });
  it('keeps hotspot coordinates proportional to the loaded image', () => {
    const root = render({ name: 'hotspot', picStyle: { url: 'data:image/png;base64,AA==', list: [{ starX: 75, starY: 150, areaWidth: 150, areaHeight: 75 }] } });
    act(() => root.findByProps({ className: 'diy-hotspot__image' }).props.onLoad({ detail: { width: 750, height: 300 } }));
    expect(root.findByProps({ className: 'diy-hotspot__area' }).props.style).toMatchObject({ left: '10%', top: '50%', width: '20%', height: '25%' });
  });
  it('opens each configured picture cube tile', async () => {
    const root = render({ name: 'pictureCube', picStyle: { picList: [{ image: 'data:image/png;base64,AA==', link: '/pages/detail/index?id=8' }] } });
    await root.findByProps({ className: 'diy-picture' }).props.onClick();
    expect(nav.navigateTo).toHaveBeenCalledWith({ url: '/pages/detail/index?id=8' });
  });
  it('renders video controls using the configured video source', () => {
    const root = render({ name: 'videos', videoConfig: { url: 'http://127.0.0.1:8080/uploads/video.mp4' } });
    expect(root.findByType('video').props).toMatchObject({ src: 'http://127.0.0.1:8080/uploads/video.mp4', controls: true });
  });
});
