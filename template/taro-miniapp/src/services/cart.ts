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
  const next = existing
    ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
    : [...current, { ...product, quantity: 1 }];
  Taro.setStorageSync(storageKey, next);
  return next;
}

export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function updateCartQuantity(id: number, quantity: number): readonly CartItem[] {
  const next = readCart().flatMap((item) => item.id !== id ? [item] : quantity > 0 ? [{ ...item, quantity }] : []);
  Taro.setStorageSync(storageKey, next);
  return next;
}

export function removeFromCart(id: number): readonly CartItem[] {
  return updateCartQuantity(id, 0);
}
