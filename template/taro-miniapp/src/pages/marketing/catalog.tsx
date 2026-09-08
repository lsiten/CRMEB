import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { getMarketingPage, getSeckillSchedule, labels } from '../../services/marketing';
import type { CatalogKind } from '../../services/marketing';
import { usePagedResource } from '../../state/paged-resource';
import { useRemoteResource } from '../../state/remote-resource';
import '../order/management.scss';

function CatalogRows({ kind, periodId }: Readonly<{ kind: CatalogKind; periodId?: number }>) {
  const rows = usePagedResource(`${kind}:${periodId ?? ''}`, (page) => getMarketingPage(kind, page, periodId));
  useReachBottom(() => { if (!rows.error) void rows.loadMore(); });
  return <>
    {rows.items.map(({ id, activity }) => <View className='order-panel' key={id}>
      <View className='order-product'>
        <CommerceImage className='order-product-image' src={activity.image ?? ''} mode='aspectFill' />
        <View className='order-product-body'><Text>{activity.title}</Text>
          {activity.price !== undefined && <Text className='order-amount'>¥{activity.price.toFixed(2)}</Text>}
          {activity.stock !== undefined && <Text className='order-muted'>{activity.stock > 0 ? `剩余 ${activity.stock}` : '已售罄'}</Text>}
        </View>
      </View>
      <Button onClick={() => Taro.navigateTo({ url: `/pages/marketing/detail?kind=${kind}&id=${activity.id}${periodId ? `&time_id=${periodId}` : ''}` })}>查看活动</Button>
    </View>)}
    {rows.loading && <View className='order-panel'>正在加载活动…</View>}
    {rows.error && <View className='order-alert' role='alert'><Text>{rows.error}</Text><Button onClick={rows.retry}>重试</Button></View>}
    {!rows.loading && !rows.error && !rows.items.length && <View className='order-panel order-empty'>暂无活动</View>}
    {!!rows.items.length && !rows.error && (rows.end ? <Text className='order-muted'>已显示全部活动</Text> : <Button disabled={rows.loading} onClick={rows.loadMore}>加载更多</Button>)}
  </>;
}

function SeckillCatalog() {
  const schedule = useRemoteResource(getSeckillSchedule);
  const [selectedId, setSelectedId] = useState<number>();
  const data = schedule.data;
  const periodId = data?.periods.some((period) => period.id === selectedId) ? selectedId : data?.selectedId;
  if (schedule.loading) return <View className='order-panel'>正在加载秒杀场次…</View>;
  if (schedule.error) return <View className='order-alert' role='alert'><Text>{schedule.error}</Text><Button onClick={schedule.reload}>重试</Button></View>;
  if (!data?.periods.length || !periodId) return <View className='order-panel order-empty'>暂无秒杀场次</View>;
  return <>
    <View className='order-tabs'>{data.periods.map((period) => <Button key={period.id} className={period.id === periodId ? 'order-selected' : ''} onClick={() => setSelectedId(period.id)}>{period.time} · {period.state}</Button>)}</View>
    <CatalogRows key={periodId} kind='seckill' periodId={periodId} />
  </>;
}

export function CatalogPage({ kind }: Readonly<{ kind: CatalogKind }>) {
  return <View className='order-management'><Text className='order-heading'>{labels[kind]}</Text>
    {kind === 'seckill' ? <SeckillCatalog /> : <CatalogRows key={kind} kind={kind} />}
  </View>;
}
