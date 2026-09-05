import { Image } from '@tarojs/components';
import type { ImageProps } from '@tarojs/components/types/Image';
import { resolveImageUrl } from '../services/assets';

export type OptimizedImageProps = Readonly<ImageProps>;

/** CDN-aware, lazy image used by list/card surfaces. */
export function OptimizedImage({ src, lazyLoad = true, ...props }: OptimizedImageProps) {
  return <Image {...props} src={resolveImageUrl(src)} lazyLoad={lazyLoad} />;
}
