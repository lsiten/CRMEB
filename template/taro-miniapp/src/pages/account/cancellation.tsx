import { Button, RichText, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { Loading, Modal } from '../../components';
import { ApiError } from '../../services/api';
import { cancelAccount, getAgreement } from '../../services/account';
import type { Agreement } from '../../services/account';
import { requireLogin } from '../../services/auth-flow';
import './account.scss';

export default function CancellationPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!requireLogin('/pages/account/cancellation')) return undefined;
    let active = true;
    setFailed(false);
    void getAgreement(5).then((value) => { if (active) setAgreement(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [retry]);
  const cancel = async (): Promise<void> => {
    setBusy(true);
    try { await cancelAccount(); await Taro.showToast({ title: '账号已注销', icon: 'success' }); await Taro.reLaunch({ url: '/pages/index/index' }); }
    catch (caught) { await Taro.showToast({ title: caught instanceof ApiError ? caught.message : '注销失败，请重试', icon: 'none' }); }
    finally { setBusy(false); setConfirming(false); }
  };
  return <View className='account-flow'>
    <Text className='account-flow__title'>{agreement?.title ?? '账号注销'}</Text>
    {!agreement && !failed && <View className='account-flow__card'><Loading label='正在加载注销协议' /></View>}
    {failed && <View className='account-flow__card'><Text className='account-flow__error'>注销协议加载失败，暂不能继续</Text><Button className='account-flow__button' onClick={() => setRetry((value) => value + 1)}>重试</Button></View>}
    {agreement && <><View className='account-flow__card account-agreement'><RichText nodes={agreement.content} /></View><Text className='account-flow__intro'>点击“立即注销”代表已阅读并同意账号注销协议。<Text className='account-nowrap'>注销后无法恢复。</Text></Text><Button className='account-flow__button account-flow__button--danger' onClick={() => setConfirming(true)}>立即注销</Button></>}
    <Modal visible={confirming} title='是否确认注销' onClose={() => setConfirming(false)}><Text>注销后账号与相关权益<Text className='account-nowrap'>无法恢复</Text>，请谨慎操作。</Text><Button className='account-flow__button account-flow__button--danger' loading={busy} disabled={busy} onClick={() => void cancel()}>确认注销</Button></Modal>
  </View>;
}
