import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { CommerceImage } from '../../components/commerce-image';
import { ApiError, getToken } from '../../services/api';
import { bindWechatPhone, getUserProfile, loginByWechat } from '../../services/account';
import type { UserProfile } from '../../services/account';
import './index.scss';

const maskPhone = (phone: string): string => phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
const services = [
  { name: '我的资产', mark: '资产', url: '/pages-extra/assets/index' },
  { name: '优惠券', mark: '券', url: '/pages-extra/coupon/index' },
  { name: '我的收藏', mark: '收藏', url: '/pages-extra/favorites/index' },
  { name: '收货地址', mark: '地址', url: '/pages-extra/address/index' },
  { name: '积分中心', mark: '积分', url: '/pages/integral/index' },
  { name: '我的评价', mark: '评价', url: '/pages-extra/reviews/index' },
  { name: '分销中心', mark: '分销', url: '/pages-extra/distribution/index' },
  { name: '营销活动', mark: '活动', url: '/pages/marketing/index' },
] as const;

export default function UserPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const refresh = async (): Promise<void> => {
    if (!getToken()) { setProfile(null); setFailed(false); return; }
    setLoading(true); setFailed(false);
    try { setProfile(await getUserProfile()); }
    catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') setProfile(null);
      else setFailed(true);
    } finally { setLoading(false); }
  };
  useDidShow(() => { void refresh(); });
  const login = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    try {
      const user = await loginByWechat();
      setProfile(user);
      setFailed(false);
      await Taro.showToast({ title: user ? '登录成功' : '请完成微信授权', icon: user ? 'success' : 'none' });
    } catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '登录失败，请重试', icon: 'none' }); }
    finally { setLoading(false); }
  };
  const bindPhone = async (event: { detail?: { code?: string; encryptedData?: string; iv?: string } }): Promise<void> => {
    if (loading) return;
    setLoading(true);
    try { await bindWechatPhone(event.detail ?? {}); setProfile(await getUserProfile()); await Taro.showToast({ title: '手机号已绑定', icon: 'success' }); }
    catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '绑定失败', icon: 'none' }); }
    finally { setLoading(false); }
  };
  const navigate = (url: string) => { void Taro.navigateTo({ url }); };
  return <View className='page account-page'>
    <View className='account-heading'><Text>我的</Text><Button onClick={() => navigate('/pages-extra/messages/index')}>消息 ›</Button></View>
    <View className='account-profile'>
      <View className='account-avatar'>{profile?.avatar ? <CommerceImage src={profile.avatar} mode='aspectFill' /> : <Text>{profile?.nickname.slice(0, 1) ?? '访客'}</Text>}</View>
      <View className='account-identity'><Text className='account-name'>{profile?.nickname ?? '欢迎来到 CRMEB'}</Text><Text className='account-hint'>{profile ? (profile.phone ? maskPhone(profile.phone) : '微信用户') : '登录后查看订单与专属权益'}</Text></View>
    </View>
    {!profile && <Button className='account-login' loading={loading} {...(loading ? { disabled: true } : {})} onClick={() => void login()}>立即登录</Button>}
    {profile && !profile.phone && <Button className='account-login' loading={loading} {...(loading ? { disabled: true } : {})} openType='getPhoneNumber' onGetPhoneNumber={(event) => void bindPhone(event)}>绑定手机号</Button>}
    {failed && <Button className='account-retry' onClick={() => void refresh()}>个人信息加载失败，点击重试</Button>}
    <View className='card account-orders'>
      <View className='account-section'><Text>我的订单</Text><Button onClick={() => navigate('/pages/order/list')}>查看全部 ›</Button></View>
      <View className='account-order-grid'>{[
        { label: '待付款', status: 'unpaid', mark: '付' },
        { label: '待发货', status: 'paid', mark: '发' },
        { label: '待收货', status: 'shipping', mark: '收' },
      ].map((item) => <Button key={item.status} onClick={() => navigate(`/pages/order/list?status=${item.status}`)}><Text className='account-order-mark'>{item.mark}</Text><Text>{item.label}</Text></Button>)}</View>
    </View>
    <View className='card account-services'><View className='account-section'><Text>我的服务</Text><Text className='account-hint'>{profile ? `${profile.integral ?? 0} 积分` : '便捷管理，轻松购物'}</Text></View>
      <View className='account-service-grid'>{services.map((item) => <Button key={item.name} onClick={() => navigate(item.url)}><Text className='account-service-mark'>{item.mark}</Text><Text>{item.name}</Text></Button>)}</View>
    </View>
    <Button className='account-support' onClick={() => navigate('/pages-extra/customer/index')}><View><Text>联系客服</Text><Text className='account-hint'>购物遇到问题？我们来帮你</Text></View><Text>›</Text></Button>
  </View>;
}
