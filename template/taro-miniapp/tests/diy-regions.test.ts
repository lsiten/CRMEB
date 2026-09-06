import { describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@tarojs/components', () => ({
  Image: 'image', Swiper: 'swiper', SwiperItem: 'swiper-item', Text: 'span', View: 'div',
}));
vi.mock('../src/services/api', () => ({ request: requestMock }));
import { normalizeDiyPage, splitDiyRegions } from '../src/diy/normalize';
import { getDiyRegistration } from '../src/diy/registry';
import { getDiyPage } from '../src/services/diy';

describe('DIY homepage regions', () => {
  it('unwraps theme_info data while preserving legacy direct payloads', () => {
    const theme = normalizeDiyPage({
      code: 200,
      data: {
        title: '主题首页',
        value: { first: { name: 'headerSerch', timestamp: 20 } },
      },
    });
    const legacy = normalizeDiyPage({ value: [{ name: 'picture' }] });

    expect(theme.title).toBe('主题首页');
    expect(theme.items.map((item) => item.name)).toEqual(['headerSerch']);
    expect(legacy.items.map((item) => item.name)).toEqual(['picture']);
  });

  it('sorts finite timestamps first and keeps missing values in API order', () => {
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

  it('preserves API order when every timestamp is missing or invalid', () => {
    const page = normalizeDiyPage({
      value: [
        { name: 'coupon' },
        { name: 'swiperBg', timestamp: Number.POSITIVE_INFINITY },
        { name: 'articleList' },
      ],
    });

    expect(page.items.map((item) => item.name)).toEqual(['coupon', 'swiperBg', 'articleList']);
  });

  it('extracts the fixed top and bottom regions from ordinary content', () => {
    const page = normalizeDiyPage({
      value: [
        { name: 'pageFoot', timestamp: 1 },
        { name: 'tabNav', timestamp: 2 },
        { name: 'goodList', timestamp: 3 },
        { name: 'headerSerch', timestamp: 4 },
        { name: 'homeComb', timestamp: 5 },
      ],
    });

    const regions = splitDiyRegions(page.items);
    expect(regions.top.map((item) => item.name)).toEqual(['homeComb', 'headerSerch', 'tabNav']);
    expect(regions.content.map((item) => item.name)).toEqual(['goodList']);
    expect(regions.bottom.map((item) => item.name)).toEqual(['pageFoot']);
  });

  it('loads theme_info/home by default', async () => {
    requestMock.mockResolvedValueOnce({ data: { title: '主题首页', value: {} } });

    const page = await getDiyPage();

    expect(requestMock).toHaveBeenCalledWith('/theme_info/home');
    expect(page.title).toBe('主题首页');
  });

  it('registers the special region renderers', () => {
    const names = ['homeComb', 'headerSerch', 'tabNav', 'pageFoot'] as const;
    expect(names.every((name) => getDiyRegistration(name))).toBe(true);
  });
});
