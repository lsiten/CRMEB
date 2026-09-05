import { describe, expect, it } from 'vitest';
import { normalizeDiyPage } from '../src/diy/normalize';

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
});
