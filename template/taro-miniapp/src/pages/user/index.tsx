import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getToken, getUser, login, setToken } from '../../services/api';
import type { User } from '../../services/api';
import './index.scss';

const UserPage = () => { const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(false);
  useEffect(() => { if (getToken()) void getUser().then(setUser).catch(() => setUser(null)); }, []);
  const submit = () => { if (loading) return; setLoading(true); void login().then((value) => { setUser(value); void Taro.showToast({ title: '登录成功', icon: 'success' }); }).catch((error: unknown) => { const message = error instanceof Error ? error.message : '登录失败，请稍后重试'; void Taro.showToast({ title: message, icon: 'none' }); }).finally(() => setLoading(false)); };
  return <View className='page'><View className='profile card'><View className='avatar'>👤</View>{user ? <><Text className='welcome'>{user.nickname}</Text><Button onClick={() => { setToken(null); setUser(null); }}>退出登录</Button></> : <><Text className='welcome'>欢迎来到 CRMEB</Text><Text className='hint'>登录后享受更多权益</Text><Button className='primary' loading={loading} disabled={loading} onClick={submit}>立即登录</Button></>}</View><View className='card menu'>{['我的订单', '收货地址', '优惠券', '联系客服'].map((item) => <View className='menuItem' key={item}><Text>{item}</Text><Text>›</Text></View>)}</View></View>; };

export default UserPage;
