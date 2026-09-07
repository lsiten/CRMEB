import { useEffect, useRef, useState } from 'react';
import { drawLottery, getLotteryActivity, getReviewLottery, LotteryDrawError, LotterySubscriptionError } from '../services/lottery';
import type { LotteryFactor, LotteryResult } from '../services/lottery';
import { commerceError } from '../services/commerce-contracts';
import { useRemoteResource } from './remote-resource';

type Phase = 'idle' | 'drawing' | 'result' | 'uncertain' | 'subscribe';
export function useReviewLottery() { return useLottery(); }
export function useLottery(selection?: Readonly<{ factor: LotteryFactor; activityId?: string }>) {
  const activity = useRemoteResource(() => selection ? getLotteryActivity(selection.factor, selection.activityId) : getReviewLottery());
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<LotteryResult>();
  const [error, setError] = useState('');
  const [subscriptionImage, setSubscriptionImage] = useState('');
  const currentPhase = useRef<Phase>('idle');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const changePhase = (next: Phase): void => { currentPhase.current = next; if (mounted.current) setPhase(next); };
  const draw = async (): Promise<void> => {
    if (currentPhase.current !== 'idle' || activity.loading || activity.error || !activity.data || activity.data.chances < 1) return;
    changePhase('drawing'); setError(''); setResult(undefined);
    try {
      const prize = await drawLottery(activity.data.id, activity.data.factor);
      if (!mounted.current) return;
      setResult(prize); changePhase('result');
      await activity.reload();
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof LotteryDrawError ? cause.message : commerceError(cause));
      if (cause instanceof LotterySubscriptionError) {
        setSubscriptionImage(cause.image); changePhase('subscribe');
        return;
      }
      changePhase(cause instanceof LotteryDrawError && cause.uncertain ? 'uncertain' : 'idle');
      await activity.reload();
    }
  };
  const dismiss = async (): Promise<void> => {
    if (currentPhase.current === 'drawing') return;
    await activity.reload();
    if (mounted.current) { setResult(undefined); setError(''); setSubscriptionImage(''); changePhase('idle'); }
  };
  return { activity, phase, result, error, subscriptionImage, draw, dismiss };
}
