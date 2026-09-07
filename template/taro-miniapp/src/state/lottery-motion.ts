import { useState } from 'react';
import type { LotteryPrize, LotteryResult } from '../services/lottery';
import { useLotterySpin } from './lottery-spin';

export function useLotteryMotion(result: LotteryResult | undefined, prizes: readonly LotteryPrize[]) {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const winner = prizes.findIndex(prize => prize.id === result?.id);
  const spin = useLotterySpin(result?.recordId ?? '', winner, prizes.length, reduced);
  return { ...spin, reduced, toggle: () => setReduced(value => !value) };
}
