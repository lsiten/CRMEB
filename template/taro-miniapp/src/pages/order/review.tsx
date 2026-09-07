import { Button, Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { ImageAttachments } from '../../components/image-attachments';
import { useOrderReview } from '../../state/order-review';
import './management.scss';

function Rating({ title, value, disabled, onChange }: Readonly<{ title: string; value: number; disabled: boolean; onChange: (value: number) => void }>) {
  return <View><Text className='order-section-title'>{title}</Text><View className='order-actions'>{[1, 2, 3, 4, 5].map((score) => <Button key={score} disabled={disabled} className={score === value ? 'order-selected' : ''} onClick={() => onChange(score)}>{score} 分</Button>)}</View></View>;
}
export default function OrderReviewPage() {
  const state = useOrderReview(useRouter().params['unique'] ?? '');
  const product = state.product.data;
  const returnUrl = product ? `/pages/order/detail?orderId=${encodeURIComponent(product.orderId)}` : '/pages/order/list';
  if (state.result) return <View className='order-management'><View className='order-panel order-empty'><Text className='order-heading'>感谢您的评价</Text><Text>评价已提交，审核与展示以商家设置为准。</Text>{state.result.lotteryAvailable && <><Text>本次评价已获得抽奖机会。</Text><Button onClick={() => Taro.navigateTo({ url: `/pages/marketing/review-lottery?order_id=${encodeURIComponent(product?.orderId ?? '')}` })}>去抽奖</Button></>}<Button className='order-primary' onClick={() => Taro.redirectTo({ url: returnUrl })}>返回订单</Button></View></View>;
  return <View className='order-management'><Text className='order-heading'>发表评价</Text>
    {(state.product.error || state.error) && <View className='order-alert'><Text>{state.product.error || state.error}</Text>{state.product.error && <Button onClick={() => void state.product.reload()}>重新加载</Button>}</View>}
    {state.product.loading && !product ? <View className='order-panel'>正在加载评价商品…</View> : product && <>
      <View className='order-panel'><View className='order-product'><CommerceImage src={product.image} className='order-product-image' /><View className='order-product-body'><Text>{product.name}</Text><Text className='order-muted'>{product.spec}</Text><Text>¥{product.price.toFixed(2)} ×{product.quantity}</Text></View></View></View>
      <View className='order-panel'><Rating title='商品评分' value={state.productScore} disabled={state.submitting} onChange={state.setProductScore} /><Rating title='服务评分' value={state.serviceScore} disabled={state.submitting} onChange={state.setServiceScore} /></View>
      <View className='order-panel'><Text className='order-section-title'>使用感受</Text><Textarea className='order-textarea' value={state.comment} disabled={state.submitting} maxlength={500} placeholder='分享商品的使用感受' onInput={(event) => state.setComment(event.detail.value)} /><Text className='order-muted'>{state.comment.length}/500</Text><ImageAttachments state={state.attachments} limit={8} disabled={state.submitting} /></View>
      <Button className='order-primary' loading={state.submitting} disabled={state.submitting || state.attachments.uploading || state.product.loading || !!state.product.error} onClick={() => void state.submit()}>提交评价</Button>
    </>}
  </View>;
}
