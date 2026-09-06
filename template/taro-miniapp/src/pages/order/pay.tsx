import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { queryPayment, requestPayment } from '../../services/api';
import { track } from '../../services/telemetry';
import { getClipboardFallback, getPaymentPresentation, resolvePaymentStatus, type ServerPaymentStatus } from '../../services/platform';
import './index.scss';

function parseWechatPaymentParams(value: Record<string, unknown>): Taro.requestPayment.Option | undefined {
  const timeStamp = value['timeStamp'];
  const nonceStr = value['nonceStr'];
  const packageValue = value['package'];
  const paySign = value['paySign'];
  if (typeof timeStamp !== 'string' || typeof nonceStr !== 'string' || typeof packageValue !== 'string' || typeof paySign !== 'string') return undefined;
  const signType = value['signType'];
  const validSignType = signType === 'MD5' || signType === 'HMAC-SHA256' ? signType : undefined;
  return { timeStamp, nonceStr, package: packageValue, paySign, ...(validSignType ? { signType: validSignType } : {}) };
}

export default function PayPage() {
  const { params } = useRouter();
  const orderId = params['orderId'] ?? '';
  const [status, setStatus] = useState<ServerPaymentStatus>('pending');
  const [loading, setLoading] = useState(false);
  const [clipboard, setClipboard] = useState(getClipboardFallback(orderId, false));
  const presentation = getPaymentPresentation(status);

  const refreshStatus = async (): Promise<void> => {
    const server = await queryPayment(orderId);
    setStatus(resolvePaymentStatus('ok', server.status));
  };

  const pay = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await requestPayment({ orderId, method: 'wechat' });
      if (process.env.TARO_ENV === 'h5') {
        setStatus('failed');
        await Taro.showToast({ title: result.payParams ? '请在服务端配置 H5 支付跳转' : 'H5 暂不支持微信支付', icon: 'none' });
        return;
      }
      const paymentParams = result.payParams ? parseWechatPaymentParams(result.payParams) : undefined;
      if (paymentParams) await Taro.requestPayment(paymentParams);
      await refreshStatus();
    } catch {
      track('payment_failed', { properties: { method: 'wechat', phase: 'requestPayment', platform: process.env.TARO_ENV ?? 'unknown' } });
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const copyOrderId = async (): Promise<void> => {
    try {
      await Taro.setClipboardData({ data: orderId });
      setClipboard(getClipboardFallback(orderId, true));
    } catch {
      setClipboard(getClipboardFallback(orderId, false));
    }
  };

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async (): Promise<void> => {
      try {
        const result = await queryPayment(orderId);
        if (!active) return;
        const nextStatus = resolvePaymentStatus('ok', result.status);
        setStatus(nextStatus);
        if (nextStatus === 'pending') timer = setTimeout(() => void poll(), 2000);
      } catch {
        if (active) timer = setTimeout(() => void poll(), 3000);
      }
    };
    if (orderId) void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [orderId]);

  return <View className='page payPage'><Text className='title'>订单支付</Text><View className='card center'><Text className='payStatus'>{presentation.label}</Text><Text className='hint'>{status === 'pending' ? '支付结果确认中，页面会自动刷新' : ''}</Text>{presentation.canRetry && <Button className='primaryButton' loading={loading} onClick={() => void pay()}>{status === 'pending' ? '立即支付' : '重新支付'}</Button>}{status === 'paid' && <Button onClick={() => Taro.redirectTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(orderId)}` })}>查看订单</Button>}<Button size='mini' onClick={() => void copyOrderId()}>复制订单号</Button>{!clipboard.copied && <Text className='hint'>无法自动复制，请手动复制：{clipboard.text}</Text>}</View></View>;
}
