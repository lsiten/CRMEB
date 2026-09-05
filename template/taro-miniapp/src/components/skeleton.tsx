import { View } from '@tarojs/components';
import './components.scss';
export type SkeletonProps = Readonly<{ variant?: 'text' | 'rect'; width?: string }>;
export function Skeleton({ variant = 'text', width }: SkeletonProps) { const style = width ? { style: { width } } : {}; return <View className={`ui-skeleton ui-skeleton--${variant}`} {...style} />; }
