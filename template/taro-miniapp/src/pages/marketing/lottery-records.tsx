import { Button, Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { copyText } from '../../services/clipboard';
import { useState } from 'react';
import { PrizeClaim } from '../../components/prize-claim';
import { getLotteryRecords, prizeLabels } from '../../services/lottery';
import { usePagedResource } from '../../state/paged-resource';
import '../order/management.scss';
import './lottery.scss';

export default function LotteryRecordsPage() {
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const records = usePagedResource('lottery-records', getLotteryRecords);
  useReachBottom(() => { if (!records.loading && !records.error) void records.loadMore(); });
  return <View className='order-management lottery-page'><Text className='order-heading'>我的中奖记录</Text>
    {records.items.map((record) => <View className='order-panel' key={record.id}><View className='order-product'><CommerceImage className='order-product-image' src={record.prize.image} /><View className='order-product-body'><Text>{record.prize.name || prizeLabels[record.prize.type]}</Text><Text className='order-muted'>{prizeLabels[record.prize.type]}</Text><Text>{record.prize.type === 4 && record.transferState === 'WAIT_USER_CONFIRM' ? '待微信确认领取' : record.prize.type === 4 && (record.transferState === 'FAIL' || record.transferState === 'CANCELLED') ? '红包已失效' : record.prize.type === 4 && record.transferState && record.transferState !== 'SUCCESS' ? '红包处理中' : record.received ? record.prize.type === 6 ? record.delivered ? '已发货' : '待发货' : '已领取' : '待领取'}</Text></View></View>
      {record.prize.type === 4 && record.transferState === 'WAIT_USER_CONFIRM' && record.transferOrderId && <Button className='order-primary' onClick={() => Taro.navigateTo({ url: `/pages/account/merchant-transfer?type=2&id=${encodeURIComponent(record.transferOrderId)}` })}>确认领取红包</Button>}
      {record.failReason && <Text className='order-muted'>{record.failReason}</Text>}
      {record.receivedAt && <Text className='order-muted'>领取时间：{record.receivedAt}</Text>}
      {record.deliveredAt && <Text className='order-muted'>发货时间：{record.deliveredAt}</Text>}
      {record.expressName && <Text>快递：{record.expressName}</Text>}
      {copyError === record.id && <Text className='order-alert'>复制失败，请长按单号复制</Text>}
      {record.expressNumber && <View className='order-between'><Text>单号：{record.expressNumber}</Text><Button onClick={() => void copyText(record.expressNumber).then(() => { setCopied(record.id); setCopyError(''); }).catch(() => { setCopyError(record.id); })}>{copied === record.id ? '已复制' : '复制单号'}</Button></View>}
      {!record.received && record.prize.type === 6 && <PrizeClaim recordId={record.id} onReceived={() => void records.reload()} />}
    </View>)}
    {records.error && <View className='order-alert'><Text>{records.error}</Text><Button disabled={records.loading} onClick={() => void records.retry()}>重试</Button></View>}
    {records.loading && <View className='order-panel'>正在加载中奖记录…</View>}
    {!records.loading && !records.error && !records.items.length && <View className='order-panel order-empty'>暂无中奖记录</View>}
    {!!records.items.length && !records.error && (records.end ? <Text className='order-muted'>已显示全部中奖记录</Text> : <Button disabled={records.loading} onClick={() => void records.loadMore()}>加载更多</Button>)}
  </View>;
}
