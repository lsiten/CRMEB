import { useCallback, useEffect, useRef, useState } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { getToken } from '../../services/api';
import { requireLogin } from '../../services/auth-flow';
import { commerceError } from '../../services/commerce-contracts';

export function useSocialResource<T>(loader: () => Promise<T>, returnUrl: string) {
  const [snapshot, setSnapshot] = useState<Readonly<{ data: T; token: string | null }>>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0); const mounted = useRef(true); const locked = useRef(false);
  const visible = useRef(true); const refreshPending = useRef(false);
  const refresh = useCallback(async (): Promise<void> => {
    if (locked.current) { refreshPending.current = true; return; }
    refreshPending.current = false;
    const epoch = ++generation.current; const token = getToken();
    setSnapshot(undefined); setError(''); setLoading(true);
    if (!token) { setLoading(false); return; }
    try {
      const data = await loader();
      if (mounted.current && epoch === generation.current && getToken() === token) setSnapshot({ data, token });
    } catch (cause) {
      if (mounted.current && epoch === generation.current && getToken() === token) setError(commerceError(cause));
    } finally { if (mounted.current && epoch === generation.current) setLoading(false); }
  }, [loader]);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; generation.current += 1; }; }, [refresh]);
  useDidHide(() => { visible.current = false; generation.current += 1; setSnapshot(undefined); });
  useDidShow(() => { visible.current = true; void refresh(); });
  const run = async <R,>(operation: () => Promise<R>, success: (value: R) => Promise<void> | void, refreshAfter = false): Promise<void> => {
    if (locked.current || !snapshot || !requireLogin(returnUrl)) return;
    if (getToken() !== snapshot.token) { setSnapshot(undefined); setError('登录状态已变化，请刷新'); return; }
    const epoch = generation.current; const token = snapshot.token;
    let succeeded = false;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await operation();
      if (mounted.current && epoch === generation.current && getToken() === token) { await success(result); succeeded = true; }
    } catch (cause) {
      if (mounted.current && epoch === generation.current && getToken() === token) { setError(commerceError(cause)); setSnapshot(undefined); }
    } finally {
      locked.current = false; if (mounted.current) setBusy(false);
      if (mounted.current && visible.current && (refreshPending.current || succeeded && refreshAfter && epoch === generation.current && getToken() === token)) void refresh();
    }
  };
  const data = snapshot?.token === getToken() ? snapshot.data : undefined;
  return { data, token: snapshot?.token, loading, busy, error, needsRefresh: !loading && !busy && !error && !data, refresh, run };
}
