import Taro from '@tarojs/taro';
import type { Product } from './api';

const storageKey = 'crmeb.favorites';

export function readFavorites(): readonly Product[] {
  const stored = Taro.getStorageSync<readonly Product[]>(storageKey);
  return Array.isArray(stored) ? stored : [];
}

export function isFavorite(id: number): boolean {
  return readFavorites().some((product) => product.id === id);
}

export function toggleFavorite(product: Product): boolean {
  const current = readFavorites();
  const next = current.some((item) => item.id === product.id)
    ? current.filter((item) => item.id !== product.id)
    : [...current, product];
  Taro.setStorageSync(storageKey, next);
  return next.some((item) => item.id === product.id);
}
