import { useRef, useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { getToken } from '../services/api';
import { commerceError } from '../services/commerce-contracts';
import { changeServerCartQuantity, deleteServerCart, getServerCart } from '../services/server-cart';
import type { ServerCartItem } from '../services/server-cart';

export function useServerCart() {
  const [items, setItems] = useState<readonly ServerCartItem[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const [busyId, setBusyId] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const page = useRef(1);
  const fetching = useRef(false);
  const mutation = useRef(false);
  const load = async (append = false): Promise<void> => {
    const loggedIn = Boolean(getToken());
    setAuthenticated(loggedIn);
    if (!loggedIn) { setItems([]); setSelected([]); return; }
    if (fetching.current || mutation.current) return;
    fetching.current = true;
    setLoading(true);
    setError('');
    const nextPage = append ? page.current + 1 : 1;
    try {
      const [valid, invalid] = await Promise.all([getServerCart({ page: nextPage, valid: true }), getServerCart({ page: nextPage, valid: false })]);
      const next = [...valid.items, ...invalid.items];
      setItems((current) => append ? [...new Map([...current, ...next].map((item) => [item.cartId, item])).values()] : next);
      if (!append) setSelected(valid.items.filter((item) => item.valid && item.stock !== 0).map((item) => item.cartId));
      setHasMore(valid.hasMore || invalid.hasMore);
      page.current = nextPage;
    } catch (cause) { setError(commerceError(cause)); }
    finally { fetching.current = false; setLoading(false); }
  };
  useDidShow(() => { void load(); });
  const changeQuantity = async (item: ServerCartItem, quantity: number): Promise<void> => {
    if (mutation.current || fetching.current) return;
    mutation.current = true;
    setBusyId(item.cartId);
    setError('');
    try {
      if (quantity === 0) {
        await deleteServerCart([item.cartId]);
        setItems((current) => current.filter((row) => row.cartId !== item.cartId));
        setSelected((current) => current.filter((id) => id !== item.cartId));
      } else {
        await changeServerCartQuantity(item.cartId, quantity);
        setItems((current) => current.map((row) => row.cartId === item.cartId ? { ...row, quantity } : row));
      }
    } catch (cause) { setError(commerceError(cause)); }
    finally { mutation.current = false; setBusyId(''); }
  };
  return { items, selected, setSelected, error, loading, authenticated, busyId, hasMore, load, changeQuantity };
}
