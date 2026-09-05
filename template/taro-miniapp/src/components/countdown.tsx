import { Text } from '@tarojs/components';
import { useEffect, useState } from 'react';
import './components.scss';
export type CountdownProps = Readonly<{ seconds: number; onComplete?: () => void }>;
export function Countdown({ seconds, onComplete }: CountdownProps) { const [remaining, setRemaining] = useState(Math.max(0, seconds)); useEffect(() => { if (remaining <= 0) { onComplete?.(); return undefined; } const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [onComplete, remaining]); const minutes = Math.floor(remaining / 60).toString().padStart(2, '0'); const secs = (remaining % 60).toString().padStart(2, '0'); return <Text className='ui-countdown'>{minutes}:{secs}</Text>; }
