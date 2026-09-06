import { describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@tarojs/components', () => ({
  Image: 'image', Swiper: 'swiper', SwiperItem: 'swiper-item', Text: 'span', View: 'div',
}));
vi.mock('../src/services/api', () => ({ request: requestMock }));
import { normalizeDiyPage, splitDiyRegions } from '../src/diy/normalize';
import { getDiyRegistration } from '../src/diy/registry';
import { getDiyPage } from '../src/services/diy';

describe('DIY page normalization', () => {
  it('unwraps the API data envelope before reading named theme components', () => {
    const page = normalizeDiyPage({
      code: 200,
      data: {
        title: '主题首页',
        value: {
          '0': { name: 'headerSerch', timestamp: 20 },
          '1': { name: 'swiperBg', timestamp: 10 },
        },
      },
    });

    expect(page.title).toBe('主题首页');
    expect(page.items.map((item) => item.name)).toEqual(['swiperBg', 'headerSerch']);
  });

  it('keeps a direct value payload compatible with the legacy endpoint', () => {
    const page = normalizeDiyPage({ value: [{ name: 'picture', image: 'https://cdn.example.com/a.png' }] });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.name).toBe('picture');
  });

  it('sorts finite timestamps first and leaves components without one at the end', () => {
    const page = normalizeDiyPage({
      value: [
        { name: 'articleList' },
        { name: 'goodList', timestamp: 20 },
        { name: 'swiperBg', timestamp: 10 },
        { name: 'coupon', timestamp: Number.NaN },
      ],
    });

    expect(page.items.map((item) => item.name)).toEqual(['swiperBg', 'goodList', 'articleList', 'coupon']);
  });

  it('preserves the API order when every component lacks a valid timestamp', () => {
    const page = normalizeDiyPage({
      value: [
        { name: 'coupon' },
        { name: 'swiperBg', timestamp: Number.POSITIVE_INFINITY },
        { name: 'articleList' },
      ],
    });

    expect(page.items.map((item) => item.name)).toEqual(['coupon', 'swiperBg', 'articleList']);
  });

  it('extracts fixed top and bottom regions from timestamp-sorted content', () => {
    const page = normalizeDiyPage({
      value: [
        { name: 'pageFoot', timestamp: 1 },
        { name: 'tabNav', timestamp: 2 },
        { name: 'goodList', timestamp: 3 },
        { name: 'headerSerch', timestamp: 4 },
        { name: 'homeComb', timestamp: 5 },
        { name: 'coupon', timestamp: 6 },
      ],
    });

    const regions = splitDiyRegions(page.items);
    expect(regions.top.map((item) => item.name)).toEqual(['homeComb', 'headerSerch', 'tabNav']);
    expect(regions.content.map((item) => item.name)).toEqual(['goodList', 'coupon']);
    expect(regions.bottom.map((item) => item.name)).toEqual(['pageFoot']);
  });

  it('loads the same theme_info/home source as the uni-app homepage', async () => {
    requestMock.mockResolvedValueOnce({ data: { title: '主题首页', value: {} } });

    const page = await getDiyPage();

    expect(requestMock).toHaveBeenCalledWith('/theme_info/home');
    expect(page.title).toBe('主题首页');
  });

  it('registers every home DIY component emitted by the CRMEB theme editor', () => {
    const names = [
      'homeComb', 'headerSerch', 'tabNav', 'userInfor', 'member', 'newVip',
      'articleList', 'bargain', 'blankPage', 'combination', 'coupon',
      'customerService', 'goodList', 'goodRecommend', 'guide', 'liveBroadcast',
      'menus', 'news', 'pictureCube', 'promotionList', 'seckill', 'swiperBg',
      'swipers', 'titles', 'presale', 'pointsMall', 'richText', 'videos',
      'signIn', 'hotspot', 'follow', 'productInfo', 'home_paid_vip',
      'productService', 'homeReviews', 'productDesc', 'customComponent',
      'pageFoot',
    ] as const;

    expect(names.every((name) => getDiyRegistration(name))).toBe(true);
  });
});
