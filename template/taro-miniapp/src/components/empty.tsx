import { Button, Text, View } from '@tarojs/components';
import './components.scss';
export type EmptyProps = Readonly<{ title?: string; description?: string; actionLabel?: string; onAction?: () => void }>;
export function Empty({ title = '暂无内容', description, actionLabel, onAction }: EmptyProps) { const action = onAction ? { onClick: () => onAction() } : {}; return <View className='ui-empty'><Text className='ui-empty__title'>{title}</Text>{description && <Text className='ui-empty__description'>{description}</Text>}{actionLabel && <Button size='mini' {...action}>{actionLabel}</Button>}</View>; }
