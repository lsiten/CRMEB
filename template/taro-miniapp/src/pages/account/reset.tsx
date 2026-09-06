import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { isMobilePhone, validatePasswordReset } from '../../services/account-contracts';
import { requestSmsCode, resetPassword } from '../../services/account';
import './account.scss';

export default function ResetPasswordPage() {
  const [phone, setPhone] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
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
    const validation = validatePasswordReset({ phone, captcha, password, confirmation });
    if (validation) { fail(validation); return; }
    setBusy(true); setError('');
    try { await resetPassword(phone.trim(), captcha.trim(), password); await Taro.showToast({ title: '密码已重置，请重新登录', icon: 'success' }); await Taro.navigateBack(); }
    catch (caught) { fail(caught instanceof ApiError ? caught.message : '密码重置失败，请重试'); }
    finally { setBusy(false); }
  };
  return <View className='account-flow'>
    <Text className='account-flow__title'>找回密码</Text><Text className='account-flow__intro'>验证手机号后设置新密码</Text>
    <View className='account-flow__card'>
      <View className='account-field'><Text className='account-field__label'>手机号</Text><Input type='number' maxlength={11} value={phone} onInput={(event) => setPhone(event.detail.value)} placeholder='请输入手机号' /></View>
      <View className='account-field'><Text className='account-field__label'>验证码</Text><View className='account-field__row'><Input maxlength={8} value={captcha} onInput={(event) => setCaptcha(event.detail.value)} placeholder='请输入验证码' /><Button disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown > 0 ? `${cooldown} 秒后重发` : '获取验证码'}</Button></View></View>
      <View className='account-field'><Text className='account-field__label'>新密码</Text><Input password maxlength={32} value={password} onInput={(event) => setPassword(event.detail.value)} placeholder='7-32 位字母或数字' /></View>
      <View className='account-field'><Text className='account-field__label'>确认密码</Text><Input password maxlength={32} value={confirmation} onInput={(event) => setConfirmation(event.detail.value)} placeholder='再次输入新密码' /></View>
      {error && <Text className='account-flow__error' aria-label={`错误：${error}`}>{error}</Text>}
      <Button className='account-flow__button' loading={busy} disabled={busy} onClick={() => void submit()}>确认重置</Button>
    </View>
  </View>;
}
