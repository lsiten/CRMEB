import { useRef, useState } from 'react';
import { Button, Input, Picker, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { cancelRefund, deleteRefund, getRefund, submitRefundExpress } from '../../services/refunds';
import { commerceError } from '../../services/commerce-contracts';
import { useRemoteResource } from '../../state/remote-resource';
import { CommerceImage } from '../../components/commerce-image';
import './management.scss';

export default function RefundDetailPage() {
  const id = useRouter().params['id'] ?? '';
  const resource = useRemoteResource(() => getRefund(id));
  const [company, setCompany] = useState('');
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (locked.current || resource.loading || resource.error) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (cause) { setError(commerceError(cause)); }
    finally { locked.current = false; setBusy(false); }
  };
  const refund = resource.data;
  const cancel = () => run(async () => {
    const result = await Taro.showModal({ title: '撤销售后申请', content: '确认撤销本次售后申请？' });
    if (!result.confirm) return;
    await cancelRefund(id); await Taro.redirectTo({ url: '/pages/order/refunds' });
  });
  const remove = () => run(async () => {
    const result = await Taro.showModal({ title: '删除售后记录', content: '删除后，此售后记录和关联订单将不再显示。确认删除？' });
    if (!result.confirm) return;
    await deleteRefund(id); await Taro.redirectTo({ url: '/pages/order/refunds' });
  });
  const express = () => run(async () => {
    if (!refund || refund.type !== 4) return;
    await submitRefundExpress({ id: refund.internalId, company, number, phone, explanation: refund.explanation, images: refund.images });
    await resource.reload();
  });
  return <View className='order-management'><Text className='order-heading'>售后详情</Text>
    {(resource.error || error) && <View className='order-alert'><Text>{resource.error || error}</Text>{resource.error && <Button disabled={busy} onClick={() => void resource.reload()}>重新加载</Button>}</View>}
    {resource.loading && !resource.data ? <View className='order-panel'>正在加载售后详情…</View> : refund && <>
      <View className='order-panel'><Text className='order-section-title'>{refund.title}</Text><Text>{refund.message}</Text><Text className='order-amount'>¥{refund.amount.toFixed(2)}</Text><Text className='order-muted'>售后单号：{refund.id}</Text><Text className='order-muted'>订单号：{refund.orderId}</Text></View>
      <View className='order-panel'>{refund.products.map((item) => <View className='order-product' key={item.cartId}><CommerceImage src={item.image} className='order-product-image' /><View className='order-product-body'><Text>{item.name}</Text><Text className='order-muted'>{item.spec}</Text><Text>数量：{item.remaining}</Text></View></View>)}</View>
      <View className='order-panel'><Text className='order-section-title'>申请信息</Text><Text>原因：{refund.reason}</Text><Text className='order-muted'>{refund.explanation}</Text><Text className='order-muted'>{refund.createdAt}</Text><View className='order-actions'>{refund.images.map((src) => <CommerceImage key={src} className='order-product-image' src={src} onClick={() => { void Taro.previewImage({ current: src, urls: [...refund.images] }); }} />)}</View></View>
      {[4, 5].includes(refund.type) && <View className='order-panel'><Text className='order-section-title'>退货地址</Text><Text>{refund.returnName} {refund.returnPhone}</Text><Text className='order-muted'>{refund.returnAddress || '商家暂未提供退货地址，请联系商家确认。'}</Text>{refund.returnAddress && <Button onClick={() => Taro.setClipboardData({ data: `${refund.returnName} ${refund.returnPhone} ${refund.returnAddress}` })}>复制退货信息</Button>}</View>}
      {refund.type === 4 && <View className='order-panel'><Text className='order-section-title'>填写退货物流</Text>
        <Picker disabled={busy} mode='selector' range={[...refund.expressOptions]} onChange={(event) => setCompany(refund.expressOptions[Number(event.detail.value)] ?? '')}><View className='order-picker'>{company || '选择快递公司'}</View></Picker>
        <Input className='order-field' value={number} disabled={busy} maxlength={50} placeholder='快递单号' onInput={(event) => setNumber(event.detail.value)} />
        <Input className='order-field' value={phone} disabled={busy} type='number' maxlength={11} placeholder='寄件人手机号' onInput={(event) => setPhone(event.detail.value)} />
        <Button className='order-primary' disabled={busy || !company || !number || !phone} loading={busy} onClick={() => void express()}>提交退货信息</Button>
      </View>}
      {refund.express && <View className='order-panel'><Text>退货物流：{refund.expressName}</Text><Text className='order-muted'>{refund.express}</Text><Button onClick={() => Taro.navigateTo({ url: `/pages/order/logistics?orderId=${encodeURIComponent(refund.id)}&type=refund` })}>查看退货物流</Button></View>}
      <View className='order-actions'>{[1, 2, 4].includes(refund.type) && <Button disabled={busy || !!resource.error} onClick={() => void cancel()}>撤销申请</Button>}{[3, 6].includes(refund.type) && <Button disabled={busy || !!resource.error} onClick={() => void remove()}>删除记录</Button>}</View>
    </>}
  </View>;
}
