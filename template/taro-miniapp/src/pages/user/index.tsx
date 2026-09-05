import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { ApiError, getToken } from '../../services/api';
import { bindWechatPhone, getUserProfile, loginByWechat, type UserProfile } from '../../services/account';
import './index.scss';

const maskPhone = (phone: string): string => phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
const menuItems = ['我的订单', '我的资产', '分销中心', '营销活动', '收货地址', '优惠券', '我的收藏', '我的评价', '积分中心', '联系客服'] as const;

const UserPage = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  useDidShow(() => {
    if (!getToken()) { setProfile(null); return; }
    void getUserProfile().then(setProfile).catch((error: unknown) => {
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') setProfile(null);
    });
  });
  const login = async (): Promise<void> => {
    setLoading(true);
    try { setProfile(await loginByWechat()); await Taro.showToast({ title: '登录成功', icon: 'success' }); }
    catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '登录失败', icon: 'none' }); }
    finally { setLoading(false); }
  };
  const openMenu = (item: typeof menuItems[number]): void => {
    if (item === '我的资产') { void Taro.navigateTo({ url: '/pages-extra/assets/index' }); return; }
    if (item === '分销中心') { void Taro.navigateTo({ url: '/pages-extra/distribution/index' }); return; }
    if (item === '营销活动') { void Taro.navigateTo({ url: '/pages/marketing/index' }); return; }
    if (item === '我的订单') { void Taro.navigateTo({ url: '/pages/order/list' }); return; }
    if (item === '收货地址') { void Taro.navigateTo({ url: '/pages-extra/address/index' }); return; }
    if (item === '优惠券') { void Taro.navigateTo({ url: '/pages-extra/coupon/index' }); return; }
    if (item === '我的收藏') { void Taro.navigateTo({ url: '/pages-extra/favorites/index' }); return; }
    if (item === '我的评价') { void Taro.navigateTo({ url: '/pages-extra/reviews/index' }); return; }
    if (item === '积分中心') { void Taro.navigateTo({ url: '/pages/integral/index' }); return; }
    if (item === '联系客服') { void Taro.navigateTo({ url: '/pages-extra/customer/index' }); return; }
    void Taro.showToast({ title: `${item}功能即将上线`, icon: 'none' });
  };
  const bindPhone = async (event: { detail?: { code?: string; encryptedData?: string; iv?: string } }): Promise<void> => {
    try { await bindWechatPhone(event.detail ?? {}); setProfile(await getUserProfile()); await Taro.showToast({ title: '手机号已绑定', icon: 'success' }); }
    catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '绑定失败', icon: 'none' }); }
  };
  return <View className='page'><View className='profile card'><View className='avatar'>{profile?.avatar ? <Text>{profile.avatar}</Text> : <Text>👤</Text>}</View><View><Text className='welcome'>{profile?.nickname ?? '欢迎来到 CRMEB'}</Text><Text className='hint'>{profile ? (profile.phone ? maskPhone(profile.phone) : '微信用户') : '登录后享受更多权益'}</Text></View>{!profile && <Button className='primary' loading={loading} onClick={() => void login()}>立即登录</Button>}{profile && !profile.phone && <Button className='primary' openType='getPhoneNumber' onGetPhoneNumber={(event) => void bindPhone(event)}>绑定手机号</Button>}</View><View className='card menu'>{menuItems.map((item) => <View className='menuItem' key={item} onClick={() => openMenu(item)}><Text>{item}</Text><Text>›</Text></View>)}</View></View>;
};

export default UserPage;
