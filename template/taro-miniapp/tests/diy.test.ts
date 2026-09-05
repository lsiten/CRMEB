import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({
  Image: 'image', Swiper: 'swiper', SwiperItem: 'swiper-item', Text: 'span', View: 'div',
}));
import { normalizeDiyPage } from '../src/diy/normalize';
import { getDiyRegistration } from '../src/diy/registry';

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

  it('registers every home DIY component emitted by the CRMEB theme editor', () => {
    const names = [
      'homeComb', 'headerSerch', 'tabNav', 'userInfor', 'member', 'newVip',
      'articleList', 'bargain', 'blankPage', 'combination', 'coupon',
      'customerService', 'goodList', 'goodRecommend', 'guide', 'liveBroadcast',
      'menus', 'news', 'pictureCube', 'promotionList', 'seckill', 'swiperBg',
      'swipers', 'titles', 'presale', 'pointsMall', 'richText', 'videos',
      'signIn', 'hotspot', 'follow', 'productInfo', 'home_paid_vip',
      'productService', 'homeReviews', 'productDesc', 'customComponent',
    ] as const;

    expect(names.every((name) => getDiyRegistration(name))).toBe(true);
  });
});
