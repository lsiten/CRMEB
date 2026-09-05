import { Button, View } from '@tarojs/components';
import './components.scss';
export type TabItem = Readonly<{ key: string; label: string; disabled?: boolean }>;
export type TabsProps = Readonly<{ items: readonly TabItem[]; value: string; onChange: (key: string) => void }>;
export function Tabs({ items, value, onChange }: TabsProps) { return <View className='ui-tabs' role='tablist'>{items.map((item) => <Button key={item.key} size='mini' {...(item.disabled === undefined ? {} : { disabled: item.disabled })} className={`ui-tabs__item ${value === item.key ? 'ui-tabs__item--active' : ''} ${item.disabled ? 'ui-tabs__item--disabled' : ''}`} aria-label={item.label} aria-selected={value === item.key} aria-controls={`panel-${item.key}`} onClick={() => onChange(item.key)}>{item.label}</Button>)}</View>; }
