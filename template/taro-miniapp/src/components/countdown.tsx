import { Text } from '@tarojs/components';
import { useEffect, useRef, useState } from 'react';
import './components.scss';
export type CountdownProps = Readonly<{ seconds: number; onComplete?: () => void }>;
export function Countdown({ seconds, onComplete }: CountdownProps) {
  const normalized = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const [remaining, setRemaining] = useState(normalized);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    setRemaining(Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0);
    completed.current = false;
  }, [seconds]);
  useEffect(() => {
    if (remaining <= 0) {
      if (!completed.current) {
        completed.current = true;
        onCompleteRef.current?.();
      }
      return undefined;
    }
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  return <Text className='ui-countdown'>{minutes}:{secs}</Text>;
}
