import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { isMobilePhone } from '../../services/account-contracts';
import { bindUserPhone, requestSmsCode } from '../../services/account';
import './account.scss';

export default function PhonePage() {
  const replace = useRouter().params['replace'] === '1';
  const [phone, setPhone] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);
  const fail = (message: string) => { setError(message); void Taro.showToast({ title: message, icon: 'none' }); };
  const send = async (): Promise<void> => {
    if (!isMobilePhone(phone)) { fail('请输入正确的手机号码'); return; }
    setBusy(true); setError('');
    try { await requestSmsCode(phone.trim(), 'reset'); setCooldown(60); await Taro.showToast({ title: '验证码已发送', icon: 'success' }); }
    catch (caught) { fail(caught instanceof ApiError ? caught.message : '验证码发送失败，请重试'); }
    finally { setBusy(false); }
  };
  const submit = async (): Promise<void> => {
    if (!isMobilePhone(phone)) { fail('请输入正确的手机号码'); return; }
    if (!/^[A-Za-z0-9]{4,8}$/.test(captcha.trim())) { fail('请输入正确的验证码'); return; }
    setBusy(true); setError('');
    try { await bindUserPhone(phone.trim(), captcha.trim(), replace); await Taro.showToast({ title: replace ? '手机号已更换' : '手机号已绑定', icon: 'success' }); await Taro.navigateBack(); }
    catch (caught) { fail(caught instanceof ApiError ? caught.message : '手机号操作失败，请重试'); }
    finally { setBusy(false); }
  };
  return <View className='account-flow'>
    <Text className='account-flow__title'>{replace ? '更换手机号' : '绑定手机号'}</Text><Text className='account-flow__intro'>验证码仅用于本次账号安全验证</Text>
    <View className='account-flow__card'>
      <View className='account-field'><Text className='account-field__label'>新手机号</Text><Input type='number' maxlength={11} value={phone} onInput={(event) => setPhone(event.detail.value)} placeholder='请输入手机号' /></View>
      <View className='account-field'><Text className='account-field__label'>验证码</Text><View className='account-field__row'><Input maxlength={8} value={captcha} onInput={(event) => setCaptcha(event.detail.value)} placeholder='请输入验证码' /><Button disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown > 0 ? `${cooldown} 秒后重发` : '获取验证码'}</Button></View></View>
      {error && <Text className='account-flow__error' aria-label={`错误：${error}`}>{error}</Text>}
      <Button className='account-flow__button' loading={busy} disabled={busy} onClick={() => void submit()}>{replace ? '确认更换' : '确认绑定'}</Button>
    </View>
  </View>;
}
