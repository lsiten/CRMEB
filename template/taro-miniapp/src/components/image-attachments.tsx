import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { CommerceImage } from './commerce-image';
import type { useImageAttachments } from '../state/image-attachments';
import './image-attachments.scss';

export function ImageAttachments({ state, limit, disabled = false }: Readonly<{ state: ReturnType<typeof useImageAttachments>; limit: number; disabled?: boolean }>) {
  return <View className='image-attachments'>
    <Text className='image-attachments-label'>图片凭证（选填，最多 {limit} 张）</Text>
    <View className='image-attachments-grid'>{state.images.map((url, index) => <View className='image-attachment' key={`${url}-${index}`}>
      <CommerceImage className='image-attachment-preview' src={url} onClick={() => { void Taro.previewImage({ current: url, urls: [...state.images] }); }} />
      <Button className='image-attachment-remove' disabled={disabled || state.uploading} onClick={() => state.remove(index)}>移除第 {index + 1} 张</Button>
    </View>)}</View>
    {state.error && <Text className='image-attachment-error'>{state.error}</Text>}
    {state.images.length < limit && <Button className='image-attachment-add' disabled={disabled || state.uploading} loading={state.uploading} onClick={() => void state.choose()}>{state.uploading ? '正在上传图片…' : '添加图片'}</Button>}
  </View>;
}
