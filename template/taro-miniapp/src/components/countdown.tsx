import { Text } from '@tarojs/components';
import { useEffect, useRef, useState } from 'react';
import './components.scss';
export type CountdownProps = Readonly<{ seconds: number; onComplete?: () => void }>;
export function Countdown({ seconds, onComplete }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, seconds));
  const completed = useRef(false);
  useEffect(() => {
    setRemaining(Math.max(0, seconds));
    completed.current = false;
  }, [seconds]);
  useEffect(() => {
    if (remaining <= 0) {
      if (!completed.current) {
        completed.current = true;
        onComplete?.();
      }
      return undefined;
    }
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [onComplete, remaining]);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  return <Text className='ui-countdown'>{minutes}:{secs}</Text>;
}
