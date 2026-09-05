import { Button, Text, View } from '@tarojs/components';
import './components.scss';
export type AddressOption = Readonly<{ id: string; label: string; detail?: string }>;
export type AddressSelectorProps = Readonly<{ options: readonly AddressOption[]; value?: string; onChange: (option: AddressOption) => void }>;
export function AddressSelector({ options, value, onChange }: AddressSelectorProps) { return <View className='ui-address' role='radiogroup' aria-label='收货地址'>{options.map((option) => <Button key={option.id} aria-label={option.label} aria-checked={value === option.id} className={`ui-address__option ${value === option.id ? 'ui-address__option--selected' : ''}`} onClick={() => onChange(option)}><Text>{option.label}</Text>{option.detail && <Text> · {option.detail}</Text>}{value === option.id && <Text className='ui-address__check' aria-hidden='true'>✓</Text>}</Button>)}</View>; }
