import Taro from '@tarojs/taro';
import { arrayValue, nestedText, nestedValue, numberValue, recordValue, textValue } from './render-values';

const tabs = new Set(['/pages/index/index', '/pages/goods/index', '/pages/cart/index', '/pages/user/index']);
const pages = new Set([
  '/pages/detail/index', '/pages/search/index', '/pages/news/index',
  ...['confirm', 'pay', 'list', 'detail', 'logistics', 'verify'].map((name) => `/pages/order/${name}`),
  ...['index', 'detail', 'confirm', 'orders', 'order-detail', 'logistics', 'records'].map((name) => `/pages/integral/${name}`),
  '/pages/marketing/index', '/pages/marketing/detail',
  ...['news-detail', 'assets', 'distribution', 'coupon', 'favorites', 'reviews', 'store', 'address', 'messages', 'customer'].map((name) => `/pages-extra/${name}/index`),
]);
const aliases: Readonly<Record<string, string>> = {
  '/pages/goods_cate/goods_cate': '/pages/goods/index',
  '/pages/order_addcart/order_addcart': '/pages/cart/index',
  '/pages/goods_details/index': '/pages/detail/index',
  '/pages/goods/goods_details/index': '/pages/detail/index',
  '/pages/goods/goods_search/index': '/pages/search/index',
  '/pages/goods_search/index': '/pages/search/index',
  '/pages/goods/order_list/index': '/pages/order/list',
  '/pages/users/user_integral/index': '/pages/integral/records',
  '/pages/points_mall/index': '/pages/integral/index',
  '/pages/users/user_get_coupon/index': '/pages/marketing/index?kind=coupon',
  '/pages/users/user_coupon/index': '/pages-extra/coupon/index',
  '/pages/users/user_goods_collection/index': '/pages-extra/favorites/index',
  '/pages/users/user_address_list/index': '/pages-extra/address/index',
  '/pages/users/user_sgin/index': '/pages/marketing/index?kind=sign',
  '/pages/activity/goods_seckill/index': '/pages/marketing/index?kind=seckill',
  '/pages/activity/goods_combination/index': '/pages/marketing/index?kind=combination',
  '/pages/activity/goods_bargain/index': '/pages/marketing/index?kind=bargain',
  '/pages/activity/presell/index': '/pages/marketing/index?kind=advance',
  '/pages/activity/goods_seckill_details/index': '/pages/marketing/detail?kind=seckill',
  '/pages/activity/goods_combination_details/index': '/pages/marketing/detail?kind=combination',
  '/pages/activity/goods_bargain_details/index': '/pages/marketing/detail?kind=bargain',
};

/** Read link fields without treating a menu label or image URL as a destination. */
export function configuredLink(value: unknown): string {
  const direct = textValue(value, 'link') || nestedText(value, [['linkConfig', 'value']]);
  if (direct) return direct.trim();
  const info = arrayValue(recordValue(value)['info']);
  const named = info.find((entry) => textValue(entry, 'title') === '链接');
  if (named) return textValue(named, 'value').trim();
  const candidate = textValue(info[1], 'value', 'title') || (info.length === 1 ? textValue(info[0], 'value') : '');
  return candidate.trim();
}

export async function navigateDiyLink(link: string): Promise<void> {
  const source = link.trim();
  if (!source) { await Taro.showToast({ title: '该入口尚未配置链接', icon: 'none' }); return; }
  const split = source.indexOf('?');
  const path = split < 0 ? source : source.slice(0, split);
  const rawQuery = split < 0 ? '' : source.slice(split + 1);
  const legacyStatus = /(?:^|&)status=([^&]*)/.exec(rawQuery)?.[1];
  if (path === '/pages/goods/order_list/index' && legacyStatus && !['0', '1', '2', '-1', 'unpaid', 'paid', 'shipping'].includes(legacyStatus)) {
    await Taro.showToast({ title: '该订单状态暂不支持', icon: 'none' }); return;
  }
  const statuses: Readonly<Record<string, string>> = { '0': 'unpaid', '1': 'paid', '2': 'shipping' };
  const query = path === '/pages/goods/order_list/index'
    ? rawQuery.replace(/(^|&)status=([012])(?=&|$)/g, (_match: string, prefix: string, status: string) => `${prefix}status=${statuses[status]}`)
    : rawQuery;
  const mapped = Object.prototype.hasOwnProperty.call(aliases, path) ? aliases[path] ?? path : path;
  const destination = mapped.split('?')[0] ?? '';
  if (!tabs.has(destination) && !pages.has(destination)) {
    await Taro.showToast({ title: '该导航暂不支持', icon: 'none' }); return;
  }
  const url = query ? `${mapped}${mapped.includes('?') ? '&' : '?'}${query}` : mapped;
  try {
    if (tabs.has(destination)) await Taro.switchTab({ url: destination });
    else await Taro.navigateTo({ url });
  } catch {
    // Navigation is a UI boundary: Taro rejects with platform-specific error objects.
    await Taro.showToast({ title: '页面跳转失败，请重试', icon: 'none' });
  }
}

export async function navigateDiyTab(tab: unknown): Promise<void> {
  const link = configuredLink(tab);
  if (link) { await navigateDiyLink(link); return; }
  const categoryId = numberValue(nestedValue(tab, 'classPage', 'id'));
  if (numberValue(nestedValue(tab, 'dataType', 'tabVal')) === 1 && categoryId > 0) {
    Taro.setStorageSync('crmeb_diy_category', categoryId);
    await navigateDiyLink('/pages/goods/index');
    return;
  }
  const microId = numberValue(nestedValue(tab, 'microPage', 'id'));
  await navigateDiyLink(microId > 0 ? `/pages/diy/index?id=${microId}` : '');
}
