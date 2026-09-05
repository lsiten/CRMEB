import { Text, View } from '@tarojs/components';
import './components.scss';
export type TabItem = Readonly<{ key: string; label: string; disabled?: boolean }>;
export type TabsProps = Readonly<{ items: readonly TabItem[]; value: string; onChange: (key: string) => void }>;
export function Tabs({ items, value, onChange }: TabsProps) { return <View className='ui-tabs'>{items.map((item) => <Text key={item.key} className={`ui-tabs__item ${value === item.key ? 'ui-tabs__item--active' : ''}`} onClick={() => { if (!item.disabled) onChange(item.key); }}>{item.label}</Text>)}</View>; }
