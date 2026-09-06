import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => new Map<string, unknown>());
const request = vi.hoisted(() => vi.fn());
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  request,
} }));
import { addToCart, cartItemKey, cartTotal, readCart, readCheckoutItems, updateCartQuantity } from '../src/services/cart';
import { getCategoryProducts, parseCategories } from '../src/services/catalog';
const product = { id: 7, name: '旅行杯', price: 29.9, image: '/cup.png', stock: 3 };

beforeEach(() => { storage.clear(); request.mockReset(); });

describe('购物车到确认订单', () => {
  it('只结算勾选规格，未选中商品继续保留在购物车', () => {
    addToCart(product, '白色');
    addToCart(product, '黑色');
    const selected = JSON.stringify([cartItemKey({ id: 7, spec: '白色' })]);
    expect(readCheckoutItems(selected).map((item) => item.spec)).toEqual(['白色']);
    expect(readCheckoutItems(encodeURIComponent(selected)).map((item) => item.spec)).toEqual(['白色']);
    expect(cartTotal(readCheckoutItems(selected))).toBe(29.9);
    expect(readCart()).toHaveLength(2);
  });
  it('空选择、损坏参数和已删除商品不会回退到整车结算', () => {
    addToCart(product);
    expect(readCheckoutItems('[]')).toEqual([]);
    expect(readCheckoutItems('{broken')).toEqual([]);
    expect(readCheckoutItems('%broken')).toEqual([]);
    expect(readCheckoutItems('[7]')).toEqual([]);
    expect(readCheckoutItems('["missing"]')).toEqual([]);
    expect(readCheckoutItems()).toHaveLength(1);
  });
  it('数量受库存限制，同商品不同规格独立更新和删除', () => {
    addToCart(product, '白色'); addToCart(product, '黑色');
    updateCartQuantity(7, 99, '白色');
    expect(readCart().map((item) => item.quantity)).toEqual([3, 1]);
    updateCartQuantity(7, 0, '白色');
    expect(readCart().map((item) => item.spec)).toEqual(['黑色']);
  });
  it('售罄商品不能进入选中结算', () => {
    storage.set('crmeb.cart', [{ ...product, stock: 0, quantity: 1 }]);
    expect(readCheckoutItems(JSON.stringify([cartItemKey(product)]))).toEqual([]);
  });
});

describe('真实分类接口', () => {
  it('解析父子分类并剔除无效记录', () => {
    expect(parseCategories([{ id: '12', cate_name: '生活家居', children: [{ id: 13, cate_name: '杯具' }, { id: -1, cate_name: '无效' }] }, null])).toEqual([
      { id: 12, name: '生活家居', children: [{ id: 13, name: '杯具', children: [] }] },
    ]);
    expect(parseCategories({})).toEqual([]);
  });
  it('使用后端 selectId 协议，并传递搜索词和分页', async () => {
    request.mockResolvedValue({ statusCode: 200, data: { data: [{ id: 7, store_name: '杯子', image: '/cup.png', price: '29.9' }] } });
    expect(await getCategoryProducts({ categoryId: 13, keyword: '杯 & 茶', page: 2 })).toHaveLength(1);
    expect(request.mock.calls[0]?.[0].url).toContain('/products?selectId=13&keyword=%E6%9D%AF%20%26%20%E8%8C%B6&page=2&limit=20');
  });
});
