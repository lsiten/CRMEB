import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { captureAuthSession, getAuthRevision, getToken, isCurrentAuthSession, subscribeAuthSession } from '../services/api';
import { commerceError } from '../services/commerce-contracts';

export function useOrderResource<T extends Readonly<{ id: string }>>(key: string, fetcher: (page: number) => Promise<readonly T[]>) {
  useSyncExternalStore(subscribeAuthSession, getAuthRevision, getAuthRevision);
  const [items, setItems] = useState<readonly T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [end, setEnd] = useState(false);
  const page = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const owner = useRef(captureAuthSession());
  const current = useRef(fetcher);
  current.current = fetcher;

  const load = async (reset: boolean): Promise<void> => {
    reset = reset || !isCurrentAuthSession(owner.current);
    if (!reset && (busy.current || end)) return;
    const ticket = ++generation.current;
    const session = captureAuthSession();
    const nextPage = reset ? 1 : page.current + 1;
    if (!session.token) { setItems([]); page.current = 0; setError('请先登录后查看订单'); setLoading(false); return; }
    owner.current = session;
    busy.current = true; setLoading(true); setError('');
    if (reset) { setItems([]); page.current = 0; setEnd(false); }
    try {
      const next = await current.current(nextPage);
      if (!mounted.current || ticket !== generation.current) return;
      if (!isCurrentAuthSession(session)) { setItems([]); setError('登录状态已变化，请重新加载订单'); return; }
      setItems((previous) => [...new Map([...(reset ? [] : previous), ...next].map((item) => [item.id, item])).values()]);
      page.current = nextPage; setEnd(next.length < 20);
    } catch (cause) {
      if (!mounted.current || ticket !== generation.current) return;
      if (isCurrentAuthSession(session, cause)) setError(commerceError(cause));
      else setError('登录状态已变化，请重新加载订单');
      if (!isCurrentAuthSession(session)) { setItems([]); page.current = 0; }
    } finally {
      if (mounted.current && ticket === generation.current) { busy.current = false; setLoading(false); }
    }
  };
  useEffect(() => {
    mounted.current = true;
    void load(true);
    return () => { mounted.current = false; generation.current += 1; busy.current = false; };
  }, [key]);
  useDidHide(() => { generation.current += 1; busy.current = false; setItems([]); setError(''); setLoading(true); });
  useDidShow(() => { if (!busy.current) void load(true); });
  const valid = isCurrentAuthSession(owner.current);
  return { items: valid ? items : [], loading, error: error || (!valid ? '登录状态已变化，请重新加载订单' : ''), end, valid, needsLogin: !getToken(),
    isValid: () => isCurrentAuthSession(owner.current),
    reload: () => load(true), retry: () => load(page.current === 0), loadMore: () => load(false) };
}
