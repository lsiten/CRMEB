import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getToken, loginWithWechat } from '../../services/api';
import './index.scss';

const UserPage = () => {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(false);
  const handleLogin = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await loginWithWechat();
      setTokenState(result.token);
      await Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
      await Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };
  return <View className='page'><View className='profile card'><View className='avatar'>👤</View><View><Text className='welcome'>欢迎来到 CRMEB</Text><Text className='hint'>{token ? '已登录，享受更多权益' : '登录后享受更多权益'}</Text></View>{token ? <Text className='primary'>已登录</Text> : <Button className='primary' loading={loading} onClick={() => void handleLogin()}>立即登录</Button>}</View><View className='card menu'>{['我的订单', '收货地址', '优惠券', '联系客服'].map((item) => <View className='menuItem' key={item}><Text>{item}</Text><Text>›</Text></View>)}</View></View>;
};

export default UserPage;
