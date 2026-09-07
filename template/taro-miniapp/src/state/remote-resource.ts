import { useEffect, useRef, useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { commerceError } from '../services/commerce-contracts';

export function useRemoteResource<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const current = useRef(fetcher);
  current.current = fetcher;
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  const reload = async (): Promise<void> => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const next = await current.current();
      if (mounted.current && request === generation.current) setData(next);
    } catch (cause) { if (mounted.current && request === generation.current) setError(commerceError(cause)); }
    finally { if (mounted.current && request === generation.current) setLoading(false); }
  };
  useDidShow(() => { void reload(); });
  return { data, loading, error, reload };
}
