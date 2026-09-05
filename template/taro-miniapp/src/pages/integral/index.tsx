import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { ApiError, request } from '../../services/api';
import './index.scss';

type Bill = Readonly<{ title?: string; mark?: string; number?: number; create_time?: string }>;
type Envelope = Readonly<{ data?: Bill[] }>;

const IntegralPage = () => {
  const [bills, setBills] = useState<readonly Bill[]>([]);
  useDidShow(() => {
    void request<Envelope>('/integral/list', { method: 'GET' }).then((payload) => setBills(Array.isArray(payload.data) ? payload.data : []))
      .catch(async (error: unknown) => { if (error instanceof ApiError) await Taro.showToast({ title: error.message, icon: 'none' }); });
  });
  return <View className='page integralPage'><View className='card'><Text className='title'>积分明细</Text>{bills.length === 0 && <Text className='empty'>暂无积分记录</Text>}{bills.map((bill, index) => <View className='bill' key={`${bill.create_time ?? ''}-${index}`}><Text>{bill.title ?? bill.mark ?? '积分变动'}</Text><Text>{typeof bill.number === 'number' && bill.number > 0 ? `+${bill.number}` : bill.number ?? 0}</Text></View>)}</View></View>;
};

export default IntegralPage;
