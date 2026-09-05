import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: () => null,
    setStorageSync: () => undefined,
    removeStorageSync: () => undefined,
    request: () => Promise.reject(new Error('not used in parser tests')),
  },
}));

import { ApiError, parseProducts } from '../src/services/api';
import { resolveImageUrl } from '../src/services/assets';

describe('API contract parsing', () => {
  it('accepts both legacy list envelopes and drops invalid records', () => {
    const products = parseProducts({ data: { list: [
      { id: '7', store_name: '咖啡', image_input: '/coffee.png', price: '12.5' },
      { id: 0, name: 'invalid', image: '/x.png', price: 1 },
    ] } });

    expect(products).toEqual([{ id: 7, name: '咖啡', image: '/coffee.png', price: 12.5 }]);
  });

  it('keeps the limit bounded to the requested page size', () => {
    const products = parseProducts({ data: [
      { id: 1, name: '一', image: '/1.png', price: 1 },
      { id: 2, name: '二', image: '/2.png', price: 2 },
    ] }, 1);

    expect(products).toHaveLength(1);
  });

  it('exposes typed errors for expired sessions', () => {
    const error = new ApiError('UNAUTHORIZED', '登录已过期', 401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.status).toBe(401);
  });

  it('keeps absolute assets intact when no CDN rewrite is needed', () => {
    expect(resolveImageUrl('https://cdn.example.com/a.webp')).toBe('https://cdn.example.com/a.webp');
    expect(resolveImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(resolveImageUrl('//cdn.example.com/a.webp')).toBe('//cdn.example.com/a.webp');
    expect(resolveImageUrl(undefined)).toBe('');
  });
});
