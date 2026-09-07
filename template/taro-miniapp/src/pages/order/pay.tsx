import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { usePayment } from '../../state/payment';
import { getPaymentPresentation } from '../../services/platform';
import './index.scss';
import './pay.scss';

const labels = { wechat: '微信支付', alipay: '支付宝支付', balance: '余额支付', offline: '线下支付' };
export default function PayPage() {
  const { params } = useRouter();
  const payment = usePayment(params['orderId'] ?? '');
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = async (value: string): Promise<void> => {
    try { await Taro.setClipboardData({ data: value }); setCopyFailed(false); }
    catch { setCopyFailed(true); }
  };
  return <View className='page payPage'>
    <Text className='title'>订单支付</Text>
    <View className='card center'>
      <Text className='payStatus'>{payment.loading ? '正在读取订单' : getPaymentPresentation(payment.status).label}</Text>
      {payment.cashier && <Text className='payment-amount'>¥{payment.cashier.amount.toFixed(2)}</Text>}
      <Text className='payment-order' selectable>订单号：{payment.orderId}</Text>
      {payment.status === 'pending' && payment.cashier && <View className='payment-methods'>{payment.cashier.methods.map((method) => <Button key={method} className={method === payment.method ? 'selected' : ''} {...(payment.paying || payment.loading ? { disabled: true } : {})} onClick={() => payment.setMethod(method)}><Text>{labels[method]}{method === 'balance' ? `（¥${payment.cashier?.balance.toFixed(2)}）` : ''}</Text><Text>{method === payment.method ? '●' : '○'}</Text></Button>)}</View>}
      {payment.error && <Text className='payment-error'>{payment.error}</Text>}
      {payment.notice && payment.status !== 'paid' && <Text className='hint'>{payment.notice}</Text>}
      {payment.status === 'pending' && <>
        {payment.cashier?.methods.length === 0 && <Text className='hint'>商家暂未开启支付方式，请联系商家</Text>}
        <Button className='primaryButton' {...(payment.loading || payment.paying || payment.confirming || !payment.method || Boolean(payment.error) ? { disabled: true } : {})} loading={payment.paying} onClick={() => void payment.pay()}>{payment.confirming ? '正在确认支付结果' : payment.method === 'offline' ? '确认线下支付' : '立即支付'}</Button>
        <Button {...(payment.loading || payment.paying ? { disabled: true } : {})} onClick={() => void payment.refresh()}>刷新支付结果</Button>
      </>}
      {payment.externalLink && <View className='payment-link'><Text selectable>{payment.externalLink}</Text><Button onClick={() => void copy(payment.externalLink)}>复制支付链接</Button></View>}
      <Button onClick={() => Taro.redirectTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(payment.orderId)}` })}>查看订单</Button>
      <Button onClick={() => void copy(payment.orderId)}>复制订单号</Button>
      {copyFailed && <Text className='hint'>自动复制失败，请长按上方文字复制</Text>}
    </View>
  </View>;
}
