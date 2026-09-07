import { useEffect, useState } from 'react';

export function useLotterySpin(recordId: string, winner: number, count: number, reduced: boolean) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [finished, setFinished] = useState('');
  const eligible = !!recordId && winner >= 0 && winner < count;
  useEffect(() => {
    if (!eligible) { setActiveIndex(-1); setFinished(''); return; }
    if (reduced) { setActiveIndex(winner); setFinished(recordId); return; }
    let step = 0;
    const lastStep = count * 3 + winner;
    setActiveIndex(0); setFinished('');
    let timer: ReturnType<typeof setTimeout>;
    const advance = (): void => {
      step += 1;
      setActiveIndex(step % count);
      if (step >= lastStep) { setFinished(recordId); return; }
      timer = setTimeout(advance, 80 + Math.round(120 * (step / lastStep) ** 2));
    };
    timer = setTimeout(advance, 80);
    return () => clearTimeout(timer);
  }, [recordId, winner, count, reduced, eligible]);
  return { activeIndex, settling: eligible && finished !== recordId };
}
