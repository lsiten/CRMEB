import { Button, Text, View } from '@tarojs/components';
import './components.scss';

export type NavBarProps = Readonly<{ title: string; showBack?: boolean; onBack?: () => void }>;
export function NavBar({ title, showBack = false, onBack }: NavBarProps) {
  const action = onBack ? { onClick: () => onBack() } : {};
  return <View className='ui-navbar'><View className='ui-navbar__action'>{showBack && <Button className='ui-navbar__action' {...action}>‹ 返回</Button>}</View><Text className='ui-navbar__title'>{title}</Text><View className='ui-navbar__spacer' /></View>;
}
