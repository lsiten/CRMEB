import { useOrderResource } from './order-resource';
import { getRefund, getRefunds } from '../services/refunds';
import { useEffect, useRef } from 'react';
import { useDidHide } from '@tarojs/taro';
import { captureAuthSession, isCurrentAuthSession } from '../services/api';

export function useRefundResource(id?: string) {
  const mounted = useRef(true);
  const generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, [id]);
  useDidHide(() => { generation.current += 1; });
  const session = captureAuthSession();
  const ticket = generation.current;
  const resource = useOrderResource(id === undefined ? 'refunds' : `refund:${id}`, async (page) =>
    id === undefined ? getRefunds(page) : [await getRefund(id)]);
  const error = resource.needsLogin ? '请先登录后查看售后记录' : !resource.valid
    ? '登录状态已变化，请重新加载售后记录' : resource.error;
  return { ...resource, error, loading: resource.valid && !resource.needsLogin && resource.loading,
    isValid: () => mounted.current && ticket === generation.current && isCurrentAuthSession(session) && resource.isValid() };
}
