import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { cartTotal, readCart } from '../../services/cart';
import type { CartItem } from '../../services/cart';
import './index.scss';

const CartPage = () => { const [items] = useState<readonly CartItem[]>(readCart()); const total = cartTotal(items); return <View className='page'><Text className='title'>购物车</Text>{items.length === 0 ? <View className='card empty'><Text>购物车还是空的</Text><Button className='primary' onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去逛逛</Button></View> : <><View className='card'>{items.map((item) => <View className='row' key={item.id}><Text>{item.name}</Text><Text>x{item.quantity}</Text><Text className='primary'>¥{(item.price * item.quantity).toFixed(2)}</Text></View>)}</View><View className='checkout'><Text>合计：<Text className='primary'>¥{total.toFixed(2)}</Text></Text><Button onClick={() => Taro.navigateTo({ url: '/pages/order/confirm' })}>去结算</Button></View></>}</View>; };

export default CartPage;
