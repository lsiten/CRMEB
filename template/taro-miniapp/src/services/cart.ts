import Taro from '@tarojs/taro';
import type { Product } from './api';

export type CartItem = Readonly<Product & { quantity: number; spec?: string }>;
const storageKey = 'crmeb.cart';

export function readCart(): readonly CartItem[] {
  const stored = Taro.getStorageSync<readonly CartItem[]>(storageKey);
  return Array.isArray(stored) ? stored : [];
}

export function addToCart(product: Product, spec = '默认规格'): readonly CartItem[] {
  const current = readCart();
  if (product.stock === 0) return current;
  const existing = current.find((item) => item.id === product.id && (item.spec ?? '默认规格') === spec);
  const nextQuantity = Math.min((existing?.quantity ?? 0) + 1, product.stock && product.stock > 0 ? product.stock : Number.POSITIVE_INFINITY);
  const next = existing
    ? current.map((item) => item.id === product.id && (item.spec ?? '默认规格') === spec ? { ...item, ...product, spec, quantity: nextQuantity } : item)
    : [...current, { ...product, spec, quantity: 1 }];
  Taro.setStorageSync(storageKey, next);
  return next;
}

export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function updateCartQuantity(id: number, quantity: number, spec = '默认规格'): readonly CartItem[] {
  const next = readCart().flatMap((item) => {
    if (item.id !== id || (item.spec ?? '默认规格') !== spec) return [item];
    if (quantity <= 0) return [];
    if (item.stock === 0) return [];
    const stockLimit = typeof item.stock === 'number' && item.stock > 0 ? item.stock : quantity;
    return [{ ...item, quantity: Math.min(quantity, stockLimit) }];
  });
  Taro.setStorageSync(storageKey, next);
  return next;
}

export function removeFromCart(id: number, spec = '默认规格'): readonly CartItem[] {
  return updateCartQuantity(id, 0, spec);
}

export function cartItemKey(item: Pick<CartItem, 'id' | 'spec'>): string {
  return JSON.stringify([item.id, item.spec ?? '默认规格']);
}

export function readCheckoutItems(selection?: string): readonly CartItem[] {
  const items = readCart();
  if (selection === undefined) return items;
  try {
    const keys: unknown = JSON.parse(selection.startsWith('%') ? decodeURIComponent(selection) : selection);
    if (!Array.isArray(keys) || !keys.every((key: unknown) => typeof key === 'string')) return [];
    return items.filter((item) => keys.includes(cartItemKey(item)) && item.stock !== 0);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof URIError) return [];
    throw error;
  }
}
