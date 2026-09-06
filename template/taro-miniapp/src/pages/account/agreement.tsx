import { Button, RichText, Text, View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { Loading } from '../../components';
import { getAgreement } from '../../services/account';
import type { Agreement } from '../../services/account';
import './account.scss';

export default function AgreementPage() {
  const type = useRouter().params['type'] === '3' ? 3 : 4;
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void getAgreement(type).then((value) => { if (active) setAgreement(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [retry, type]);
  return <View className='account-flow'>
    <Text className='account-flow__title'>{agreement?.title ?? (type === 3 ? '隐私协议' : '用户协议')}</Text>
    {!agreement && !failed && <View className='account-flow__card'><Loading label='正在加载协议' /></View>}
    {failed && <View className='account-flow__card'><Text className='account-flow__error'>协议加载失败，请检查网络后重试</Text><Button className='account-flow__button' onClick={() => setRetry((value) => value + 1)}>重试</Button></View>}
    {agreement && <View className='account-flow__card account-agreement'><RichText nodes={agreement.content} /></View>}
  </View>;
}
