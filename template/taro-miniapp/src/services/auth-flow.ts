import Taro from '@tarojs/taro';
import { getToken } from './api';
import { normalizeReturnUrl } from './account-contracts';

const tabRoutes = new Set(['/pages/index/index', '/pages/goods/index', '/pages/cart/index', '/pages/user/index']);

export function loginUrl(returnUrl: string): string {
  return `/pages-extra/login/index?returnUrl=${encodeURIComponent(returnUrl)}`;
}

export function requireLogin(returnUrl: string): boolean {
  if (getToken()) return true;
  void Taro.navigateTo({ url: loginUrl(returnUrl) });
  return false;
}

export async function completeLogin(encodedReturnUrl?: string): Promise<void> {
  const returnUrl = normalizeReturnUrl(encodedReturnUrl);
  const route = returnUrl.split('?')[0] ?? returnUrl;
  if (tabRoutes.has(route) && route === returnUrl) {
    await Taro.switchTab({ url: route });
    return;
  }
  await Taro.reLaunch({ url: returnUrl });
}
