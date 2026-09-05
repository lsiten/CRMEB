// @ts-nocheck
import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { queryPayment, requestPayment } from '../../services/api';
import { track } from '../../services/telemetry';
import './index.scss';

export default function PayPage() { const { params } = useRouter(); const orderId = params.orderId ?? ''; const [status, setStatus] = useState('pending'); const [loading, setLoading] = useState(false);
  const pay = async () => { setLoading(true); try { const result = await requestPayment({ orderId, method: 'wechat' }); if (process.env['TARO_ENV'] === 'h5') { setStatus('failed'); await Taro.showToast({ title: result.payParams ? '请在服务端配置 H5 支付跳转' : 'H5 暂不支持微信支付', icon: 'none' }); return; } if (result.payParams) await Taro.requestPayment(result.payParams as Taro.requestPayment.Option); } catch { track('payment_failed', { properties: { method: 'wechat', phase: 'requestPayment' } }); setStatus('failed'); } finally { setLoading(false); } };
  useEffect(() => { let active = true; let timer: ReturnType<typeof setTimeout> | undefined; const poll = async () => { try { const result = await queryPayment(orderId); if (!active) return; setStatus(result.status); if (result.status === 'pending') timer = setTimeout(() => void poll(), 2000); } catch { if (active) timer = setTimeout(() => void poll(), 3000); } }; if (orderId) void poll(); return () => { active = false; if (timer) clearTimeout(timer); }; }, [orderId]);
  return <View className='page payPage'><Text className='title'>订单支付</Text><View className='card center'><Text className='payStatus'>{status === 'paid' ? '支付成功' : status === 'failed' ? '支付失败' : '等待支付'}</Text><Text className='hint'>{status === 'pending' ? '支付结果确认中，页面会自动刷新' : ''}</Text>{status === 'pending' || status === 'failed' ? <Button className='primaryButton' loading={loading} onClick={() => void pay()}>{status === 'failed' ? '重新支付' : '立即支付'}</Button> : <Button onClick={() => Taro.redirectTo({ url: `/pages/order/detail?orderId=${encodeURIComponent(orderId)}` })}>查看订单</Button>}</View></View>; }
