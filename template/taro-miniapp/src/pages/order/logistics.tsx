import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { getShipment } from '../../services/logistics';
import { copyText } from '../../services/clipboard';
import { useRemoteResource } from '../../state/remote-resource';
import { CommerceImage } from '../../components/commerce-image';
import './management.scss';

export default function LogisticsPage() {
  const params = useRouter().params;
  const id = params['orderId'] ?? params['id'] ?? '';
  const refund = params['type'] === 'refund' || params['type'] === '1';
  const resource = useRemoteResource(() => getShipment(id, refund));
  const [copyMessage, setCopyMessage] = useState('');
  const shipment = resource.data;
  const copy = async () => {
    if (!shipment) return;
    try { await copyText(shipment.number); setCopyMessage('快递单号已复制'); }
    catch (cause) { setCopyMessage(cause instanceof Error ? '复制失败，请长按快递单号复制' : '暂时无法复制，请重试'); }
  };
  return <View className='order-management'><Text className='order-heading'>{refund ? '退货物流' : '物流跟踪'}</Text>
    {resource.error && <View className='order-alert'><Text>{resource.error}</Text><Button disabled={resource.loading} onClick={() => void resource.reload()}>重试</Button></View>}
    {resource.loading && <View className='order-panel'>正在查询物流…</View>}
    {shipment && <>
      {shipment.products.length > 0 && <View className='order-panel'>{shipment.products.map((item, index) => <View className='order-product' key={index}><CommerceImage src={item.image} className='order-product-image' /><View className='order-product-body'><Text>{item.name}</Text><Text>¥{item.price.toFixed(2)}</Text><Text className='order-muted'>数量：{item.quantity}</Text></View></View>)}</View>}
      <View className='order-panel'><Text className='order-section-title'>快递公司：{shipment.company || '暂未提供'}</Text><Text selectable>快递单号：{shipment.number}</Text><View className='order-actions'><Button onClick={() => void copy()}>复制单号</Button><Button disabled={resource.loading} onClick={() => void resource.reload()}>刷新物流</Button></View>{copyMessage && <Text className='order-muted'>{copyMessage}</Text>}</View>
      <View className='order-panel'><Text className='order-section-title'>运输进度</Text>{shipment.events.length ? shipment.events.map((item, index) => <View className='order-logistics-event' key={`${item.time}-${index}`}><Text>{item.description}</Text><Text className='order-muted'>{item.time}</Text></View>) : <Text>暂无物流轨迹，请稍后刷新查看</Text>}</View>
    </>}
  </View>;
}
