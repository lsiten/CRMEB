import { useState } from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { cartTotal, readCart, updateCartQuantity } from '../../services/cart';
import type { CartItem } from '../../services/cart';
import './index.scss';

const CartPage = () => {
  const [items, setItems] = useState<readonly CartItem[]>(readCart());
  const [selected, setSelected] = useState<readonly number[]>(items.map((item) => item.id));
  const selectedItems = items.filter((item) => selected.includes(item.id));
  const total = cartTotal(selectedItems);
  const changeQuantity = (item: CartItem, quantity: number) => {
    const next = updateCartQuantity(item.id, quantity, item.spec);
    setItems(next);
    if (quantity === 0) setSelected((ids) => ids.filter((id) => id !== item.id));
  };
  return <View className='page cart-page'><Text className='title'>购物车</Text>{items.length === 0 ? <View className='card empty'><Text>购物车还是空的</Text><Button className='primary' onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去逛逛</Button></View> : <><View className='card cart-list'>{items.map((item) => <View className='cart-row' key={`${item.id}-${item.spec ?? '默认规格'}`}><Text className={selected.includes(item.id) ? 'check checked' : 'check'} onClick={() => setSelected((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])}>{selected.includes(item.id) ? '✓' : ''}</Text><Image className='cart-image' mode='aspectFill' src={item.image} /><View className='cart-info'><Text className='cart-name'>{item.name}{item.spec ? `（${item.spec}）` : ''}</Text><Text className='primary'>¥{item.price.toFixed(2)}</Text><View className='quantity'><Button size='mini' onClick={() => changeQuantity(item, item.quantity - 1)}>−</Button><Text>{item.quantity}</Text><Button size='mini' disabled={typeof item.stock === 'number' && (item.stock === 0 || item.quantity >= item.stock)} onClick={() => changeQuantity(item, item.quantity + 1)}>＋</Button></View></View><Text className='remove' onClick={() => changeQuantity(item, 0)}>删除</Text></View>)}</View><View className='checkout'><Text>合计：<Text className='primary'>¥{total.toFixed(2)}</Text></Text><Button disabled={selectedItems.length === 0} onClick={() => Taro.navigateTo({ url: '/pages/order/confirm' })}>去结算</Button></View></>}</View>;
  };

export default CartPage;
