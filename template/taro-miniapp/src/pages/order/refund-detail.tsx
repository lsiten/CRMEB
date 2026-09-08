import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useRefundResource } from '../../state/refund-resource';
import { loginUrl } from '../../services/auth-flow';
import { CommerceImage } from '../../components/commerce-image';
import './management.scss';

export default function RefundDetailPage() {
  const id = useRouter().params['id'] ?? '';
  const resource = useRefundResource(id);
  const refund = resource.items[0];
  return <View className='order-management'><Text className='order-heading'>售后详情</Text>
    {resource.error && <View className='order-alert'><Text>{resource.error}</Text>{resource.needsLogin
      ? <Button onClick={() => Taro.navigateTo({ url: loginUrl(`/pages/order/refund-detail?id=${encodeURIComponent(id)}`) })}>去登录</Button>
      : <Button disabled={resource.loading} onClick={() => void resource.reload()}>重新加载</Button>}</View>}
    <View className='order-actions'><Button disabled={resource.loading || resource.needsLogin || !id} onClick={() => void resource.reload()}>刷新状态</Button><Button onClick={() => Taro.redirectTo({ url: '/pages/order/refunds' })}>返回售后列表</Button></View>
    {resource.loading ? <View className='order-panel'>正在加载售后详情…</View> : refund && <>
      <View className='order-panel'><Text className='order-section-title'>{refund.title}</Text>{refund.message && <Text className='order-muted'>{refund.message}</Text>}{refund.type === 6 && !refund.cancelled && <><Text className='order-muted'>已退金额</Text><Text className='order-amount'>{refund.refundedAmount === null ? '暂未提供' : `¥${refund.refundedAmount.toFixed(2)}`}</Text></>}<Text className='order-muted'>申请退款金额</Text><Text className='order-amount'>¥{refund.amount.toFixed(2)}</Text><Text className='order-muted'>售后单号：{refund.id}</Text><Text className='order-muted'>订单号：{refund.orderId || '暂未提供'}</Text></View>
      <View className='order-panel'><Text className='order-section-title'>售后商品</Text>{!refund.products.length && <Text className='order-muted'>暂无商品明细</Text>}{refund.products.map((item) => <View className='order-product' key={item.cartId}><CommerceImage src={item.image} className='order-product-image' /><View className='order-product-body'><Text>{item.name}</Text><Text className='order-muted'>{item.spec}</Text><Text>数量：{item.quantity}</Text></View></View>)}</View>
      <View className='order-panel'><Text className='order-section-title'>申请信息</Text><Text>原因：{refund.reason || '暂未提供'}</Text><Text className='order-muted'>{refund.explanation}</Text><Text className='order-muted'>{refund.createdAt}</Text><View className='order-actions'>{refund.images.map((src) => <CommerceImage key={src} className='order-product-image' src={src} onClick={() => { if (resource.isValid()) void Taro.previewImage({ current: src, urls: [...refund.images] }); }} />)}</View></View>
      {!refund.cancelled && [4, 5].includes(refund.type) && <View className='order-panel'><Text className='order-section-title'>退货地址</Text><Text>{refund.returnName} {refund.returnPhone}</Text><Text className='order-muted'>{refund.returnAddress || '商家暂未提供退货地址，请联系商家确认。'}</Text></View>}
      {refund.express && <View className='order-panel'><Text className='order-section-title'>退货物流</Text><Text>{refund.expressName || '暂未提供快递公司'}</Text><Text className='order-muted'>单号：{refund.express}</Text></View>}
    </>}
  </View>;
}
