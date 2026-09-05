import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import { OptimizedImage } from '../../components';
import Taro, { useDidShow } from '@tarojs/taro';
import { cartTotal, readCart, updateCartQuantity } from '../../services/cart';
import type { CartItem } from '../../services/cart';
import './index.scss';

const CartPage = () => {
  const [items, setItems] = useState<readonly CartItem[]>(readCart());
  const itemKey = (item: Pick<CartItem, 'id' | 'spec'>): string => `${item.id}-${item.spec ?? '默认规格'}`;
  const [selected, setSelected] = useState<readonly string[]>(items.map(itemKey));
  useDidShow(() => {
    const next = readCart();
    setItems(next);
    setSelected(next.map(itemKey));
  });
  const selectedItems = items.filter((item) => selected.includes(itemKey(item)));
  const total = cartTotal(selectedItems);
  const changeQuantity = (item: CartItem, quantity: number) => {
    const next = updateCartQuantity(item.id, quantity, item.spec);
    setItems(next);
    if (quantity === 0) setSelected((keys) => keys.filter((key) => key !== itemKey(item)));
  };
  return <View className='page cart-page'><Text className='title'>购物车</Text>{items.length === 0 ? <View className='card empty'><Text>购物车还是空的</Text><Button className='primary' onClick={() => Taro.switchTab({ url: '/pages/goods/index' })}>去逛逛</Button></View> : <><View className='card cart-list'>{items.map((item) => { const key = itemKey(item); const isSelected = selected.includes(key); return <View className='cart-row' key={key}><Text className={isSelected ? 'check checked' : 'check'} onClick={() => setSelected((keys) => keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key])}>{isSelected ? '✓' : ''}</Text><OptimizedImage className='cart-image' mode='aspectFill' src={item.image} /><View className='cart-info'><Text className='cart-name'>{item.name}{item.spec ? `（${item.spec}）` : ''}</Text><Text className='primary'>¥{item.price.toFixed(2)}</Text><View className='quantity'><Button size='mini' onClick={() => changeQuantity(item, item.quantity - 1)}>−</Button><Text>{item.quantity}</Text><Button size='mini' disabled={typeof item.stock === 'number' && (item.stock === 0 || item.quantity >= item.stock)} onClick={() => changeQuantity(item, item.quantity + 1)}>＋</Button></View></View><Text className='remove' onClick={() => changeQuantity(item, 0)}>删除</Text></View>; })}</View><View className='checkout'><Text>合计：<Text className='primary'>¥{total.toFixed(2)}</Text></Text><Button disabled={selectedItems.length === 0} onClick={() => Taro.navigateTo({ url: '/pages/order/confirm' })}>去结算</Button></View></>}</View>;
};

export default CartPage;
