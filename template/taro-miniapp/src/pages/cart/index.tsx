import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import { Empty } from '../../components';
import { CommerceImage } from '../../components/commerce-image';
import Taro, { useDidShow } from '@tarojs/taro';
import { cartItemKey, cartTotal, readCart, updateCartQuantity } from '../../services/cart';
import type { CartItem } from '../../services/cart';
import { requireLogin } from '../../services/auth-flow';
import './index.scss';

export default function CartPage() {
  const [items, setItems] = useState<readonly CartItem[]>(readCart);
  const [selected, setSelected] = useState<readonly string[]>(() => readCart().filter((item) => item.stock !== 0).map(cartItemKey));
  useDidShow(() => {
    const next = readCart();
    setItems(next);
    setSelected(next.filter((item) => item.stock !== 0).map(cartItemKey));
  });
  const available = items.filter((item) => item.stock !== 0);
  const selectedItems = available.filter((item) => selected.includes(cartItemKey(item)));
  const allSelected = available.length > 0 && selectedItems.length === available.length;
  const count = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const changeQuantity = (item: CartItem, quantity: number) => setItems(updateCartQuantity(item.id, quantity, item.spec));
  const checkoutUrl = `/pages/order/confirm?selection=${encodeURIComponent(JSON.stringify(selectedItems.map(cartItemKey)))}`;
  const remove = async (item: CartItem): Promise<void> => {
    const result = await Taro.showModal({ title: '删除商品', content: `确定将“${item.name}”移出购物车吗？`, confirmText: '删除' });
    if (result.confirm) {
      changeQuantity(item, 0);
      setSelected((keys) => keys.filter((key) => key !== cartItemKey(item)));
    }
  };
  return <View className='page cart-page'>
    <View className='cart-heading'><Text className='cart-title'>购物车</Text><Text className='cart-caption'>共 {items.reduce((sum, item) => sum + item.quantity, 0)} 件商品</Text></View>
    {items.length === 0 ? <View className='card cart-empty'><Empty title='购物车还是空的' description='把喜欢的好物带回家' actionLabel='去逛逛' onAction={() => void Taro.switchTab({ url: '/pages/goods/index' })} /></View> : <>
      <Text className='cart-notice'>选好心意好物，一起带回家</Text>
      <View className='cart-list'>{items.map((item) => {
        const key = cartItemKey(item);
        const isSelected = item.stock !== 0 && selected.includes(key);
        return <View className='card cart-row' key={key}>
          <Button className={`cart-check ${isSelected ? 'checked' : ''}`} aria-label={`${isSelected ? '取消选择' : '选择'}${item.name}`} {...(item.stock === 0 ? { disabled: true } : {})} onClick={() => setSelected((keys) => keys.includes(key) ? keys.filter((value) => value !== key) : [...keys, key])}>{isSelected ? '✓' : '○'}</Button>
          <CommerceImage className='cart-image' mode='aspectFill' src={item.image} onClick={() => void Taro.navigateTo({ url: `/pages/detail/index?id=${item.id}` })} />
          <View className='cart-info'><Text className='cart-name'>{item.name}</Text><Text className='cart-spec'>{item.spec ?? '默认规格'}{item.stock === 0 ? ' · 已售罄' : ''}</Text>
            <Text className='cart-price'>¥{item.price.toFixed(2)}</Text>
            <View className='cart-actions'><View className='cart-quantity'>
              <Button aria-label={`减少${item.name}数量`} {...(item.quantity <= 1 || item.stock === 0 ? { disabled: true } : {})} onClick={() => changeQuantity(item, item.quantity - 1)}>−</Button><Text>{item.quantity}</Text>
              <Button aria-label={`增加${item.name}数量`} {...(typeof item.stock === 'number' && item.quantity >= item.stock ? { disabled: true } : {})} onClick={() => changeQuantity(item, item.quantity + 1)}>＋</Button>
            </View><Button className='cart-remove' onClick={() => void remove(item)}>删除</Button></View>
          </View>
        </View>;
      })}</View>
      <View className='cart-checkout'>
        <Button className='cart-select-all' {...(!available.length ? { disabled: true } : {})} onClick={() => setSelected(allSelected ? [] : available.map(cartItemKey))}><Text className={allSelected ? 'cart-selected' : ''}>{allSelected ? '✓' : '○'}</Text> 全选</Button>
        <View className='cart-summary'><Text>合计 <Text className='cart-price'>¥{cartTotal(selectedItems).toFixed(2)}</Text></Text><Text className='cart-caption'>运费以结算页为准</Text></View>
        <Button className='cart-submit' {...(count === 0 ? { disabled: true } : {})} onClick={() => { if (requireLogin(checkoutUrl)) void Taro.navigateTo({ url: checkoutUrl }); }}>去结算 ({count})</Button>
      </View>
    </>}
  </View>;
}
