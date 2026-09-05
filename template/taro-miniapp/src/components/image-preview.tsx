import { Image, Text, View } from '@tarojs/components';
import './components.scss';
export type ImagePreviewProps = Readonly<{ src?: string; visible: boolean; alt?: string; onClose: () => void }>;
export function ImagePreview({ src, visible, alt = '图片预览', onClose }: ImagePreviewProps) { if (!visible || !src) return null; return <View className='ui-preview' onClick={onClose}><Image className='ui-preview__image' src={src} mode='widthFix' aria-label={alt} /><Text className='ui-preview__close' aria-label='关闭'>×</Text></View>; }
