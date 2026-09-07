import { useEffect, useRef, useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { commerceError } from '../services/commerce-contracts';

export function usePagedResource<T extends Readonly<{ id: string }>>(key: string, fetcher: (page: number) => Promise<readonly T[]>) {
  const [items, setItems] = useState<readonly T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [end, setEnd] = useState(false);
  const page = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);
  const current = useRef(fetcher);
  current.current = fetcher;
  const load = async (reset: boolean): Promise<void> => {
    if (!reset && (busy.current || end)) return;
    const request = ++generation.current;
    const nextPage = reset ? 1 : page.current + 1;
    busy.current = true; setLoading(true); setError('');
    if (reset) { page.current = 0; setItems([]); setEnd(false); }
    try {
      const next = await current.current(nextPage);
      if (request !== generation.current) return;
      setItems((previous) => [...new Map([...(reset ? [] : previous), ...next].map((item) => [item.id, item])).values()]);
      page.current = nextPage; setEnd(next.length < 20);
    } catch (cause) { if (request === generation.current) setError(commerceError(cause)); }
    finally { if (request === generation.current) { busy.current = false; setLoading(false); } }
  };
  useEffect(() => { void load(true); return () => { generation.current += 1; }; }, [key]);
  useDidShow(() => { if (!busy.current) void load(true); });
  return { items, loading, error, end, loadMore: () => load(false), reload: () => load(true), retry: () => load(page.current === 0) };
}
