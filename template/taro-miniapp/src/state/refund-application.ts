import { useEffect, useRef, useState } from 'react';
import { applyRefund, getRefundEligibility, getRefundProducts, getRefundReasons } from '../services/refunds';
import type { RefundProduct, RefundSelection } from '../services/refunds';
import { commerceError } from '../services/commerce-contracts';
import { useImageAttachments } from './image-attachments';

export function useRefundApplication(orderId: number) {
  const [products, setProducts] = useState<readonly RefundProduct[]>([]);
  const [reasons, setReasons] = useState<readonly string[]>([]);
  const [selection, setSelection] = useState<readonly RefundSelection[]>([]);
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const attachments = useImageAttachments(3);
  const [type, setType] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [eligibility, setEligibility] = useState<Readonly<{ selection: readonly RefundSelection[]; allowReturn: boolean }>>();
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  const completed = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoaded(false); setError('');
    void Promise.all([getRefundProducts(orderId), getRefundReasons()]).then(([nextProducts, nextReasons]) => {
      if (!active) return;
      setProducts(nextProducts); setReasons(nextReasons); setLoaded(true);
      setSelection((current) => current.flatMap((item) => {
        const product = nextProducts.find((entry) => entry.cartId === item.cartId);
        return product ? [{ ...item, quantity: Math.min(item.quantity, product.remaining) }] : [];
      }));
    }).catch((cause: unknown) => { if (active) setError(commerceError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId, revision]);
  useEffect(() => {
    if (!selection.length) return;
    let active = true;
    void getRefundEligibility(orderId, selection).then((result) => {
      if (!active) return;
      setEligibility({ selection, ...result });
      if (!result.allowReturn) setType(1);
    }).catch((cause: unknown) => { if (active) setError(commerceError(cause)); });
    return () => { active = false; };
  }, [orderId, selection]);
  const ready = loaded && eligibility?.selection === selection && selection.length > 0;
  const choose = (cartId: string, quantity: number): void => {
    if (busy.current || completed.current || loading) return;
    const product = products.find((item) => item.cartId === cartId);
    if (!product || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > product.remaining) return;
    setError('');
    setSelection((current) => [...current.filter((item) => item.cartId !== cartId), ...(quantity ? [{ cartId, quantity }] : [])]);
  };
  const submit = async (): Promise<void> => {
    if (busy.current || completed.current || loading) return;
    if (attachments.isUploading()) { setError('请等待图片上传完成'); return; }
    if (!ready) { setError('请选择商品，等待售后资格核验完成'); return; }
    if (!reasons.includes(reason) || !explanation.trim()) { setError('请选择退款原因并填写说明'); return; }
    if (type === 2 && !eligibility?.allowReturn) { setError('此订单不支持退货，请选择仅退款'); return; }
    busy.current = true; setSubmitting(true); setError('');
    try {
      await applyRefund({ orderId, selection, reason, explanation, images: attachments.getImages(), type });
      completed.current = true;
      if (mounted.current) setSubmitted(true);
    } catch (cause) { if (mounted.current) setError(commerceError(cause)); }
    finally { busy.current = false; if (mounted.current) setSubmitting(false); }
  };
  return { products, reasons, selection, reason, setReason, explanation, setExplanation, attachments, type, setType, loading, submitting, submitted, error, ready, allowReturn: ready && eligibility.allowReturn, choose, submit, retry: () => { if (!busy.current) setRevision((value) => value + 1); } };
}
