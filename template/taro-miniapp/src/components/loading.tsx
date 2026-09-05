import { Text, View } from '@tarojs/components';
import './components.scss';
export type LoadingProps = Readonly<{ label?: string }>;
export function Loading({ label = '加载中' }: LoadingProps) { return <View className='ui-loading' role='status' aria-live='polite' aria-label={label}><View className='ui-loading__dot' aria-hidden='true' /><View className='ui-loading__dot' aria-hidden='true' /><View className='ui-loading__dot' aria-hidden='true' /><Text>{label}</Text></View>; }
