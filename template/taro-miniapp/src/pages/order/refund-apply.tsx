import { Button, Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useRefundApplication } from '../../state/refund-application';
import { CommerceImage } from '../../components/commerce-image';
import { ImageAttachments } from '../../components/image-attachments';
import './management.scss';

export default function RefundApplyPage() {
  const state = useRefundApplication(Number(useRouter().params['id']));
  if (state.submitted) return <View className='order-management'><View className='order-panel order-empty'><Text className='order-heading'>售后申请已提交</Text><Text>商家审核后会更新处理进度。</Text><Button className='order-primary' onClick={() => Taro.redirectTo({ url: '/pages/order/refunds' })}>查看售后进度</Button></View></View>;
  return <View className='order-management'>
    <Text className='order-heading'>申请售后</Text>
    {state.error && <View className='order-alert'><Text>{state.error}</Text><Button disabled={state.submitting || state.loading} onClick={state.retry}>重新核验</Button></View>}
    {state.loading ? <View className='order-panel'>正在加载可售后商品…</View> : <>
      <View className='order-panel'><Text className='order-section-title'>选择商品与数量</Text>
        {!state.products.length && <Text className='order-muted'>暂无可申请售后的商品</Text>}
        {state.products.map((product) => {
          const quantity = state.selection.find((item) => item.cartId === product.cartId)?.quantity ?? 0;
          return <View className='order-product' key={product.cartId}>
            <CommerceImage src={product.image} className='order-product-image' />
            <View className='order-product-body'><Text>{product.name}</Text><Text className='order-muted'>{product.spec}</Text><Text className='order-muted'>最多可申请 {product.remaining} 件</Text>
              <View className='order-quantity'><Button disabled={state.submitting || quantity === 0} onClick={() => state.choose(product.cartId, quantity - 1)}>−</Button><Text>{quantity}</Text><Button disabled={state.submitting || quantity >= product.remaining} onClick={() => state.choose(product.cartId, quantity + 1)}>＋</Button></View>
            </View>
          </View>;
        })}
      </View>
      <View className='order-panel'><Text className='order-section-title'>售后类型</Text><View className='order-actions'>
        <Button className={state.type === 1 ? 'order-selected' : ''} disabled={state.submitting} onClick={() => state.setType(1)}>仅退款</Button>
        {state.allowReturn && <Button className={state.type === 2 ? 'order-selected' : ''} disabled={state.submitting} onClick={() => state.setType(2)}>退货退款</Button>}
      </View><Text className='order-muted'>退款金额由商家根据实际付款和所选商品核定。</Text></View>
      <View className='order-panel'><Text className='order-section-title'>退款原因</Text><View className='order-reasons'>{state.reasons.map((reason) => <Button key={reason} className={state.reason === reason ? 'order-selected' : ''} disabled={state.submitting} onClick={() => state.setReason(reason)}>{reason}</Button>)}</View>
        {!state.reasons.length && <Text className='order-muted'>暂未获取到退款原因，请重新核验。</Text>}
        <Text className='order-section-title'>问题说明</Text><Textarea className='order-textarea' maxlength={500} disabled={state.submitting} value={state.explanation} placeholder='请描述商品问题或退款原因' onInput={(event) => state.setExplanation(event.detail.value)} />
        <Text className='order-muted'>{state.explanation.length}/500</Text>
        <ImageAttachments state={state.attachments} limit={3} disabled={state.submitting} />
      </View>
      <Button className='order-primary' loading={state.submitting} disabled={state.submitting || state.attachments.uploading || !state.ready} onClick={() => void state.submit()}>提交售后申请</Button>
    </>}
  </View>;
}
