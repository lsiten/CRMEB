import Taro from '@tarojs/taro';
import type { Product } from './api';

export type CartItem = Readonly<Product & { quantity: number }>;
const storageKey = 'crmeb.cart';

export function readCart(): readonly CartItem[] {
  const stored = Taro.getStorageSync<readonly CartItem[]>(storageKey);
  return Array.isArray(stored) ? stored : [];
}

export function addToCart(product: Product): readonly CartItem[] {
  const current = readCart();
  const existing = current.find((item) => item.id === product.id);
  const limit = product.maxQuantity;
  const next = existing
    ? current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, limit) } : item)
    : [...current, { ...product, quantity: 1 }];
  Taro.setStorageSync(storageKey, next);
  return next;
}

export function canAddToCart(product: Product, items: readonly CartItem[] = readCart()): boolean {
  const current = items.find((item) => item.id === product.id)?.quantity ?? 0;
  return current < product.maxQuantity;
}

export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}
