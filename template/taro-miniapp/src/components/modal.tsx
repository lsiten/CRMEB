import { Button, Text, View } from '@tarojs/components';
import type { ReactNode } from 'react';
import './components.scss';
export type ModalProps = Readonly<{ visible: boolean; title: string; children: ReactNode; onClose: () => void }>;
export function Modal({ visible, title, children, onClose }: ModalProps) { if (!visible) return null; return <View className='ui-modal__mask' role='presentation' onClick={onClose}><View className='ui-modal' role='dialog' aria-modal='true' aria-label={title} onClick={(event) => event.stopPropagation()}><View className='ui-modal__header'><Text className='ui-modal__title'>{title}</Text><Button className='ui-modal__close' aria-label='关闭弹窗' onClick={onClose}>×</Button></View><View className='ui-modal__body'>{children}</View></View></View>; }
