import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { ApiError } from '../../services/api';
import { verifyOrder } from '../../services/store';
import './index.scss';

export default function VerifyOrderPage() {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof verifyOrder>> | null>(null);
  const [busy, setBusy] = useState(false);
  const query = async (): Promise<void> => { if (!/^\d{12}$/.test(code)) { await Taro.showToast({ title: '请输入12位核销码', icon: 'none' }); return; } setBusy(true); try { setPreview(await verifyOrder(code)); } catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '核销查询失败', icon: 'none' }); } finally { setBusy(false); } };
  const scan = async (): Promise<void> => { if (process.env['TARO_ENV'] === 'h5') { await Taro.showToast({ title: 'H5 不支持扫码，请手动输入核销码', icon: 'none' }); return; } try { const result = await Taro.scanCode({ scanType: ['qrCode', 'barCode'] }); const matched = (result.result.match(/(?:code=)?(\d{12})/) ?? [])[1]; if (!matched) throw new Error('invalid'); setCode(matched); } catch { await Taro.showToast({ title: '扫码失败，请手动输入核销码', icon: 'none' }); } };
  const confirm = async (): Promise<void> => { if (!preview) return; setBusy(true); try { await verifyOrder(code, true); setPreview(null); setCode(''); await Taro.showToast({ title: '核销成功', icon: 'success' }); } catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '核销失败', icon: 'none' }); } finally { setBusy(false); } };
  return <View className='page verifyPage'><Text className='title'>订单核销</Text><View className='card'><Input type='number' maxlength={12} value={code} onInput={(event) => setCode(event.detail.value)} placeholder='请输入12位核销码' /><View className='verifyActions'><Button className='primaryButton' loading={busy} onClick={() => void query()}>查询订单</Button><Button onClick={() => void scan()}>扫码录入</Button></View></View>{preview && <View className='card'><Text>订单号：{preview.orderId || '—'}</Text><Text className='hint'>当前状态：{preview.status}</Text><View className='verifyActions'><Button className='primaryButton' loading={busy} onClick={() => void confirm()}>确认核销</Button><Button onClick={() => setPreview(null)}>取消</Button></View></View>}</View>;
}
