import { Text, View } from '@tarojs/components';
import './components.scss';
export type LoadingProps = Readonly<{ label?: string }>;
export function Loading({ label = '加载中' }: LoadingProps) { return <View className='ui-loading' aria-label={label}><View className='ui-loading__dot' /><View className='ui-loading__dot' /><View className='ui-loading__dot' /><Text>{label}</Text></View>; }
