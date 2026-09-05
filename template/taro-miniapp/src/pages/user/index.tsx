import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

const UserPage = () => <View className='page'><View className='profile card'><View className='avatar'>👤</View><View><Text className='welcome'>欢迎来到 CRMEB</Text><Text className='hint'>登录后享受更多权益</Text></View><Button className='primary'>立即登录</Button></View><View className='card menu'>{['我的订单', '收货地址', '优惠券', '联系客服'].map((item) => <View className='menuItem' key={item} onClick={() => item === '我的订单' && Taro.navigateTo({ url: '/pages/order/list' })}><Text>{item}</Text><Text>›</Text></View>)}</View></View>;

export default UserPage;
