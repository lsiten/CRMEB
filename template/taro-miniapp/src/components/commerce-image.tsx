import { useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import type { ImageProps } from '@tarojs/components/types/Image';
import { resolveImageUrl } from '../services/assets';
import './commerce-image.scss';

export function CommerceImage({ src, className = '', onClick, ...props }: Readonly<ImageProps>) {
  const [failedSource, setFailedSource] = useState<string>();
  const available = !!src && failedSource !== src;
  return <View className={`commerce-image ${className}`} {...(onClick ? { onClick } : {})}>
    {available ? <Image {...props} className='commerce-image-content' src={resolveImageUrl(src)} lazyLoad onError={() => setFailedSource(src)} /> : <View className='commerce-image-fallback'><Text>暂无图片</Text></View>}
  </View>;
}
