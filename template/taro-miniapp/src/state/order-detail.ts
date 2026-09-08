import { useEffect, useRef, useState } from 'react';
import Taro, { useDidHide } from '@tarojs/taro';
import { ApiError, cancelOrder, captureAuthSession, getOrder, isCurrentAuthSession } from '../services/api';
import { buyOrderAgain, deleteOrder, receiveOrder } from '../services/order-actions';
import { commerceError } from '../services/commerce-contracts';
import { useOrderResource } from './order-resource';

type Action = 'cancel' | 'receive' | 'delete' | 'again';
const confirmations = {
  cancel: ['取消订单', '确认取消此订单？'],
  receive: ['确认收货', '请确认已收到此订单的全部商品。'],
  delete: ['删除订单', '确认删除此订单记录？'],
} as const;

export function useOrderDetail(id: string) {
  const resource = useOrderResource(id, async () => {
    if (!id) throw new ApiError('BUSINESS', '订单号缺失，请返回订单列表');
    return [await getOrder(id)];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const locked = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const invalidate = () => { generation.current += 1; setError(''); setFeedback(''); };
  useEffect(() => { mounted.current = true; invalidate(); return () => { mounted.current = false; generation.current += 1; }; }, [id]);
  useDidHide(invalidate);
  const order = resource.items[0];
  const disabled = busy || resource.loading || !!resource.error || !!error || !resource.valid;
  const reload = async () => { setError(''); await resource.reload(); };
  const run = async (action: Action): Promise<void> => {
    if (!resource.isValid()) { await reload(); return; }
    if (locked.current || disabled || !order) return;
    const allowed = { cancel: order.canCancel, receive: order.canReceive, delete: order.canDelete, again: order.canBuyAgain };
    if (!allowed[action]) return;
    const session = captureAuthSession();
    if (!session.token || !resource.valid) { await reload(); return; }
    const ticket = generation.current;
    const current = (cause?: unknown) => mounted.current && ticket === generation.current && isCurrentAuthSession(session, cause);
    locked.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      if (action !== 'again') {
        const [title, content] = confirmations[action];
        const result = await Taro.showModal({ title, content });
        if (!result.confirm || !current()) return;
      }
      switch (action) {
        case 'cancel': await cancelOrder(order.id); break;
        case 'receive': await receiveOrder(order.id); break;
        case 'delete': await deleteOrder(order.id); break;
        case 'again': {
          const cartIds = await buyOrderAgain(order.id);
          if (current()) await Taro.navigateTo({ url: `/pages/order/confirm?cartIds=${encodeURIComponent(cartIds)}&new=1` });
          return;
        }
      }
      if (!current()) return;
      if (action === 'delete') { await Taro.redirectTo({ url: '/pages/order/list' }); return; }
      setFeedback(action === 'cancel' ? '取消成功，正在核对最新状态' : '收货成功，正在核对最新状态');
      await resource.reload();
    } catch (cause) {
      if (current(cause)) setError(`${commerceError(cause)}；请先刷新状态，再决定是否重试`);
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  return { resource, order, busy, error, feedback, disabled, reload, run };
}
