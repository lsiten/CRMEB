import { useEffect, useRef, useState } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { getCashier, queryPayment, requestPayment, type Cashier, type PaymentMethod } from '../services/payment';
import { launchPayment, paymentCancelled } from '../services/payment-launch';
import { commerceError } from '../services/commerce-contracts';
import { requireLogin } from '../services/auth-flow';
import type { ServerPaymentStatus } from '../services/platform';

export function usePayment(initialId: string) {
  const [orderId, setOrderId] = useState(initialId);
  const currentId = useRef(initialId);
  const [cashier, setCashier] = useState<Cashier>();
  const [method, setMethod] = useState<PaymentMethod>();
  const [status, setStatus] = useState<ServerPaymentStatus>('pending');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const active = useRef(true);
  const visible = useRef(true);
  const locked = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = (): void => { generation.current += 1; if (timer.current) clearTimeout(timer.current); if (active.current) setConfirming(false); };
  useEffect(() => { active.current = true; return () => { active.current = false; stop(); }; }, []);
  useDidHide(() => { visible.current = false; stop(); });

  const refresh = async (): Promise<void> => {
    if (locked.current || !requireLogin(`/pages/order/pay?orderId=${encodeURIComponent(currentId.current)}`)) { setLoading(false); return; }
    stop();
    const revision = generation.current;
    setLoading(true); setError('');
    try {
      const result = await queryPayment(currentId.current);
      const next = result.status === 'pending' ? await getCashier(currentId.current) : undefined;
      if (!active.current || revision !== generation.current) return;
      setStatus(result.status); setCashier(next);
      setMethod((selected) => selected && next?.methods.includes(selected) ? selected : next?.methods[0]);
    } catch (cause) { if (active.current && revision === generation.current) setError(commerceError(cause)); }
    finally { if (active.current && revision === generation.current) setLoading(false); }
  };
  useDidShow(() => { visible.current = true; void refresh(); });

  const poll = async (id: string, revision: number, remaining: number, awaiting = false): Promise<void> => {
    try {
      const result = await queryPayment(id);
      if (!active.current || !visible.current || revision !== generation.current) return;
      setStatus(result.status);
      if (result.status === 'pending' && remaining > 0) timer.current = setTimeout(() => void poll(id, revision, remaining - 1, awaiting), 2000);
      else { setConfirming(false); if (result.status === 'pending' && awaiting) setNotice('暂未收到支付结果，可点击刷新确认'); }
    } catch (cause) { if (active.current && revision === generation.current) { setConfirming(false); setError(commerceError(cause)); } }
  };

  const pay = async (): Promise<void> => {
    if (locked.current || confirming || loading || error || status !== 'pending' || !method || !cashier) return;
    if (cashier.expiresAt > 0 && cashier.expiresAt * 1000 <= Date.now()) { setError('订单支付时间已过，请返回订单确认'); return; }
    locked.current = true; setPaying(true); setError(''); setNotice(''); setExternalLink(''); stop();
    try {
      const result = await requestPayment({ orderId: currentId.current, method, ...(process.env.TARO_ENV === 'h5' ? { quitUrl: window.location.href } : {}) });
      currentId.current = result.orderId;
      if (!active.current) return;
      setOrderId(result.orderId);
      if (!visible.current) return;
      if (process.env.TARO_ENV === 'h5') window.history.replaceState(window.history.state, '', `#/pages/order/pay?orderId=${encodeURIComponent(result.orderId)}`);
      const launched = await launchPayment(result);
      if (!active.current || !visible.current) return;
      setExternalLink(launched.externalLink ?? '');
      setNotice(method === 'offline' ? '已提交线下支付，请联系商家完成付款' : '请完成支付，再确认支付结果');
      if (!launched.redirected) { setConfirming(method !== 'offline'); void poll(result.orderId, generation.current, method === 'offline' ? 0 : 14, method !== 'offline'); }
    } catch (cause) {
      if (active.current) {
        setNotice(paymentCancelled(cause) ? '已取消支付，订单仍保留，可重新支付' : '');
        if (!paymentCancelled(cause)) setError(commerceError(cause));
        void poll(currentId.current, generation.current, 0);
      }
    } finally { locked.current = false; if (active.current) setPaying(false); }
  };
  return { orderId, cashier, method, setMethod, status, error, notice, externalLink, loading, paying, confirming, refresh, pay };
}
