import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { Loading, Modal } from '../../components';
import { ApiError } from '../../services/api';
import { getUserProfile, logout, updateUserProfile } from '../../services/account';
import type { UserProfile } from '../../services/account';
import { requireLogin } from '../../services/auth-flow';
import './account.scss';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const load = async (): Promise<void> => {
    if (!requireLogin('/pages/account/profile')) return;
    setLoading(true); setFailed(false);
    try {
      const value = await getUserProfile();
      if (!value) throw new ApiError('BUSINESS', '用户信息暂不可用');
      setProfile(value); setNickname(value.nickname); setAvatar(value.avatar);
    } catch (caught) {
      setFailed(true);
      if (caught instanceof ApiError && caught.code === 'UNAUTHORIZED') requireLogin('/pages/account/profile');
    } finally { setLoading(false); }
  };
  useDidShow(() => { void load(); });
  const save = async (): Promise<void> => {
    if (!nickname.trim()) { await Taro.showToast({ title: '昵称不能为空', icon: 'none' }); return; }
    setBusy(true);
    try { await updateUserProfile({ nickname: nickname.trim(), avatar: avatar.trim() }); await Taro.showToast({ title: '资料已保存', icon: 'success' }); await load(); }
    catch (caught) { await Taro.showToast({ title: caught instanceof ApiError ? caught.message : '保存失败，请重试', icon: 'none' }); }
    finally { setBusy(false); }
  };
  const confirmExit = async (): Promise<void> => {
    setBusy(true);
    try { await logout(); await Taro.showToast({ title: '已退出登录', icon: 'success' }); await Taro.switchTab({ url: '/pages/user/index' }); }
    catch (caught) { await Taro.showToast({ title: caught instanceof ApiError ? caught.message : '退出失败，请重试', icon: 'none' }); }
    finally { setBusy(false); setConfirmLogout(false); }
  };
  if (loading) return <View className='account-flow'><View className='account-flow__card'><Loading label='正在加载个人资料' /></View></View>;
  if (failed || !profile) return <View className='account-flow'><View className='account-flow__card'><Text className='account-flow__error'>个人资料加载失败</Text><Button className='account-flow__button' onClick={() => void load()}>重试</Button></View></View>;
  return <View className='account-flow'>
    <Text className='account-flow__title'>个人资料</Text><Text className='account-flow__intro'>维护头像、昵称与账号安全信息</Text>
    <View className='account-flow__card'>
      <View className='account-field'><Text className='account-field__label'>头像地址</Text><Input value={avatar} maxlength={500} onInput={(event) => setAvatar(event.detail.value)} placeholder='请输入头像图片地址' /></View>
      <View className='account-field'><Text className='account-field__label'>昵称</Text><Input type='nickname' value={nickname} maxlength={10} onInput={(event) => setNickname(event.detail.value)} placeholder='请输入昵称' /></View>
      <View className='account-field'><Text className='account-field__label'>手机号</Text><Input value={profile.phone || '尚未绑定'} disabled /></View>
      <View className='account-field'><Text className='account-field__label'>ID 号</Text><Input value={String(profile.uid)} disabled /></View>
      <Button className='account-flow__button' loading={busy} disabled={busy} onClick={() => void save()}>保存修改</Button>
    </View>
    <View className='account-menu'>
      <Button onClick={() => void Taro.navigateTo({ url: `/pages/account/phone?replace=${profile.phone ? '1' : '0'}` })}><Text>{profile.phone ? '更换手机号' : '绑定手机号'}</Text><Text>进入</Text></Button>
      {profile.phone && <Button onClick={() => void Taro.navigateTo({ url: '/pages/account/reset' })}><Text>修改密码</Text><Text>验证手机号后修改</Text></Button>}
      <Button onClick={() => void Taro.navigateTo({ url: '/pages-extra/address/index' })}><Text>地址管理</Text><Text>进入</Text></Button>
      <Button onClick={() => void Taro.navigateTo({ url: '/pages/account/agreement?type=4' })}><Text>用户协议</Text><Text>查看</Text></Button>
      <Button onClick={() => void Taro.navigateTo({ url: '/pages/account/agreement?type=3' })}><Text>隐私协议</Text><Text>查看</Text></Button>
      <Button onClick={() => void Taro.navigateTo({ url: '/pages/account/cancellation' })}><Text>账号注销</Text><Text>注销后无法恢复</Text></Button>
    </View>
    <Button className='account-flow__button account-flow__button--danger' onClick={() => setConfirmLogout(true)}>退出登录</Button>
    <Modal visible={confirmLogout} title='确认退出登录' onClose={() => setConfirmLogout(false)}><Text>退出后需要重新登录才能查看<Text className='account-nowrap'>订单</Text>和账号信息。</Text><Button className='account-flow__button account-flow__button--danger' loading={busy} disabled={busy} onClick={() => void confirmExit()}>确认退出</Button></Modal>
  </View>;
}
