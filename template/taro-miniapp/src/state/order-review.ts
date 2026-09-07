import { useEffect, useRef, useState } from 'react';
import { getReviewProduct, submitOrderReview } from '../services/order-reviews';
import { commerceError } from '../services/commerce-contracts';
import { useImageAttachments } from './image-attachments';
import { useRemoteResource } from './remote-resource';

export function useOrderReview(unique: string) {
  const product = useRemoteResource(() => getReviewProduct(unique));
  const attachments = useImageAttachments(8);
  const [comment, setComment] = useState('');
  const [productScore, setProductScore] = useState(0);
  const [serviceScore, setServiceScore] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Readonly<{ lotteryAvailable: boolean }>>();
  const busy = useRef(false);
  const completed = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async (): Promise<void> => {
    if (busy.current || completed.current) return;
    if (product.loading || product.error || !product.data) { setError('请先加载评价商品'); return; }
    if (attachments.isUploading()) { setError('请等待图片上传完成'); return; }
    busy.current = true; setSubmitting(true); setError('');
    try {
      const next = await submitOrderReview({ unique: product.data.unique, comment, productScore, serviceScore, images: attachments.getImages() });
      completed.current = true;
      if (mounted.current) setResult(next);
    } catch (cause) { if (mounted.current) setError(commerceError(cause)); }
    finally { busy.current = false; if (mounted.current) setSubmitting(false); }
  };
  return { product, attachments, comment, setComment, productScore, setProductScore, serviceScore, setServiceScore, error, submitting, result, submit };
}
