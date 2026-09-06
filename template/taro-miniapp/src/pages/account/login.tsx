import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { isMobilePhone, validateLoginInput } from '../../services/account-contracts';
import { loginByPassword, loginBySms, loginByWechat, registerUser, requestSmsCode } from '../../services/account';
import { completeLogin } from '../../services/auth-flow';
import './account.scss';

type LoginMode = 'password' | 'sms' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(router.params['mode'] === 'sms' ? 'sms' : 'password');
  const [account, setAccount] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const showError = (message: string, notify = false) => { setError(message); if (notify) void Taro.showToast({ title: message, icon: 'none' }); };
  const sendCode = async (): Promise<void> => {
    if (!isMobilePhone(phone)) { showError('请输入正确的手机号码'); return; }
    setBusy(true); setError('');
    try { await requestSmsCode(phone.trim(), mode === 'register' ? 'register' : 'login'); setCooldown(60); await Taro.showToast({ title: '验证码已发送', icon: 'success' }); }
    catch (caught) { showError(caught instanceof ApiError ? caught.message : '验证码发送失败，请重试', true); }
    finally { setBusy(false); }
  };
  const submit = async (): Promise<void> => {
    if (!agreed) { showError('请先阅读并同意用户协议与隐私协议'); return; }
    const input = mode === 'password' ? { mode, account, password } as const : mode === 'register' ? { mode, phone, captcha, password } as const : { mode, phone, captcha } as const;
    const validation = validateLoginInput(input);
    if (validation) { showError(validation); return; }
    setBusy(true); setError('');
    try {
      if (mode === 'register') {
        await registerUser(phone.trim(), captcha.trim(), password);
        setMode('password'); setAccount(phone.trim()); setCaptcha('');
        await Taro.showToast({ title: '注册成功，请使用手机号登录', icon: 'success' });
        return;
      }
      const profile = mode === 'password' ? await loginByPassword(account.trim(), password) : await loginBySms(phone.trim(), captcha.trim());
      if (!profile) throw new ApiError('BUSINESS', '登录成功但用户信息暂不可用');
      await Taro.showToast({ title: '登录成功', icon: 'success' });
      await completeLogin(router.params['returnUrl']);
    } catch (caught) { showError(caught instanceof ApiError ? caught.message : '登录失败，请重试', true); }
    finally { setBusy(false); }
  };
  const wechatLogin = async (): Promise<void> => {
    if (!agreed) { showError('请先阅读并同意用户协议与隐私协议'); return; }
    setBusy(true); setError('');
    try {
      const profile = await loginByWechat();
      if (!profile) throw new ApiError('BUSINESS', '请完成微信授权');
      await completeLogin(router.params['returnUrl']);
    } catch (caught) { showError(caught instanceof ApiError ? caught.message : '微信登录失败，请重试', true); }
    finally { setBusy(false); }
  };
  return <View className='account-flow'>
    <Text className='account-flow__title'>登录 CRMEB</Text>
    <Text className='account-flow__intro'>登录后继续购买、领券并管理订单</Text>
    <View className='account-flow__card'>
      <View className='account-flow__tabs'><Button className={mode === 'password' ? 'is-active' : ''} onClick={() => { setMode('password'); setError(''); }}>账号密码</Button><Button className={mode === 'sms' ? 'is-active' : ''} onClick={() => { setMode('sms'); setError(''); }}>短信登录</Button><Button className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setError(''); }}>手机注册</Button></View>
      {mode === 'password' ? <><View className='account-field'><Text className='account-field__label'>账号</Text><Input value={account} maxlength={16} onInput={(event) => setAccount(event.detail.value)} placeholder='请输入账号' /></View><View className='account-field'><Text className='account-field__label'>密码</Text><Input password value={password} maxlength={32} onInput={(event) => setPassword(event.detail.value)} placeholder='请输入密码' /></View></> : <><View className='account-field'><Text className='account-field__label'>手机号</Text><Input type='number' value={phone} maxlength={11} onInput={(event) => setPhone(event.detail.value)} placeholder='请输入手机号' /></View><View className='account-field'><Text className='account-field__label'>验证码</Text><View className='account-field__row'><Input value={captcha} maxlength={8} onInput={(event) => setCaptcha(event.detail.value)} placeholder='请输入验证码' /><Button disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? `${cooldown} 秒后重发` : '获取验证码'}</Button></View></View>{mode === 'register' && <View className='account-field'><Text className='account-field__label'>设置密码</Text><Input password value={password} maxlength={32} onInput={(event) => setPassword(event.detail.value)} placeholder='7-32 位字母或数字' /></View>}</>}
      {error && <Text className='account-flow__error' aria-label={`错误：${error}`}>{error}</Text>}
      <View className='account-flow__agreement'><Button className={`account-flow__check ${agreed ? 'is-active' : ''}`} aria-label={agreed ? '取消同意协议' : '同意协议'} onClick={() => setAgreed((value) => !value)}>{agreed ? '已同意' : '未同意'}</Button><View className='account-flow__agreement-copy'><Text>我已阅读并同意</Text><Button className='account-flow__agreement-link' onClick={() => void Taro.navigateTo({ url: '/pages/account/agreement?type=4' })}>《用户协议》</Button><Text>和</Text><Button className='account-flow__agreement-link' onClick={() => void Taro.navigateTo({ url: '/pages/account/agreement?type=3' })}>《隐私协议》</Button></View></View>
      <Button className='account-flow__button' loading={busy} disabled={busy} onClick={() => void submit()}>{mode === 'register' ? '注册' : '登录'}</Button>
      {process.env.TARO_ENV !== 'h5' && <Button className='account-flow__button account-flow__button--secondary' loading={busy} disabled={busy} onClick={() => void wechatLogin()}>微信授权登录</Button>}
      <Button className='account-flow__link' onClick={() => void Taro.navigateTo({ url: '/pages/account/reset' })}>忘记密码</Button>
    </View>
  </View>;
}
