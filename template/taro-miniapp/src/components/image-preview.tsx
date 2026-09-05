import { Button, Image, View } from '@tarojs/components';
import './components.scss';
export type ImagePreviewProps = Readonly<{ src?: string; visible: boolean; alt?: string; onClose: () => void }>;
export function ImagePreview({ src, visible, alt = '图片预览', onClose }: ImagePreviewProps) {
  if (!visible || !src) return null;
  return <View className='ui-preview' role='dialog' aria-label={alt} onClick={onClose}>
    <Image className='ui-preview__image' src={src} mode='widthFix' aria-label={alt} onClick={(event) => event.stopPropagation()} />
    <Button className='ui-preview__close' aria-label='关闭图片预览' onClick={(event) => { event.stopPropagation(); onClose(); }}>×</Button>
  </View>;
}
