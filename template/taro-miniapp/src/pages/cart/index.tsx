import { View, Text, Button } from '@tarojs/components';
import { Empty } from '../../components';
import { CommerceImage } from '../../components/commerce-image';
import Taro from '@tarojs/taro';
import { cartTotal } from '../../services/cart';
import type { ServerCartItem } from '../../services/server-cart';
import { useServerCart } from '../../state/server-cart';
import { requireLogin } from '../../services/auth-flow';
import './index.scss';

export default function CartPage() {
  const cart = useServerCart();
  const { items, selected, setSelected } = cart;
  const available = items.filter((item) => item.valid && item.stock !== 0);
  const selectedItems = available.filter((item) => selected.includes(item.cartId));
  const allSelected = available.length > 0 && selectedItems.length === available.length;
  const count = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const changeQuantity = (item: ServerCartItem, quantity: number) => { void cart.changeQuantity(item, quantity); };
  const checkoutUrl = `/pages/order/confirm?cartIds=${encodeURIComponent(selectedItems.map((item) => item.cartId).join(','))}`;
  const remove = async (item: ServerCartItem): Promise<void> => {
    const result = await Taro.showModal({ title: '删除商品', content: `确定将“${item.name}”移出购物车吗？`, confirmText: '删除' });
    if (result.confirm) {
      await cart.changeQuantity(item, 0);
    }
  };
  return <View className='page cart-page'>
    <View className='cart-heading'><Text className='cart-title'>购物车</Text><Text className='cart-caption'>共 {items.reduce((sum, item) => sum + item.quantity, 0)} 件商品</Text></View>
    {cart.error && <View className='card'><Text>{cart.error}</Text><Button onClick={() => void cart.load()}>重试</Button></View>}
    {cart.loading && <View className='card'><Text>正在加载购物车…</Text></View>}
    {!cart.authenticated ? <View className='card cart-empty'><Empty title='登录后查看购物车' description='登录后可同步已添加的商品' actionLabel='去登录' onAction={() => { requireLogin('/pages/cart/index'); }} /></View> : items.length === 0 && !cart.loading && !cart.error ? <View className='card cart-empty'><Empty title='购物车还是空的' description='把喜欢的好物带回家' actionLabel='去逛逛' onAction={() => void Taro.switchTab({ url: '/pages/goods/index' })} /></View> : items.length > 0 && <>
      <Text className='cart-notice'>选好心意好物，一起带回家</Text>
      <View className='cart-list'>{items.map((item) => {
        const key = item.cartId;
        const isSelected = item.valid && item.stock !== 0 && selected.includes(key);
        return <View className='card cart-row' key={key}>
          <Button className={`cart-check ${isSelected ? 'checked' : ''}`} aria-label={`${isSelected ? '取消选择' : '选择'}${item.name}`} {...(!item.valid || item.stock === 0 ? { disabled: true } : {})} onClick={() => setSelected((keys) => keys.includes(key) ? keys.filter((value) => value !== key) : [...keys, key])}>{isSelected ? '✓' : '○'}</Button>
          <CommerceImage className='cart-image' mode='aspectFill' src={item.image} onClick={() => void Taro.navigateTo({ url: `/pages/detail/index?id=${item.id}` })} />
          <View className='cart-info'><Text className='cart-name'>{item.name}</Text><Text className='cart-spec'>{item.spec ?? '默认规格'}{item.stock === 0 ? ' · 已售罄' : ''}</Text>
            <Text className='cart-price'>¥{item.price.toFixed(2)}</Text>
            <View className='cart-actions'><View className='cart-quantity'>
              <Button aria-label={`减少${item.name}数量`} {...(item.quantity <= 1 || item.stock === 0 || Boolean(cart.busyId) || cart.loading ? { disabled: true } : {})} onClick={() => changeQuantity(item, item.quantity - 1)}>−</Button><Text>{item.quantity}</Text>
              <Button aria-label={`增加${item.name}数量`} {...(Boolean(cart.busyId) || cart.loading || !item.valid || typeof item.stock === 'number' && item.quantity >= item.stock ? { disabled: true } : {})} onClick={() => changeQuantity(item, item.quantity + 1)}>＋</Button>
            </View><Button className='cart-remove' {...(cart.busyId || cart.loading ? { disabled: true } : {})} onClick={() => void remove(item)}>删除</Button></View>
          </View>
        </View>;
      })}</View>
      {cart.hasMore && <Button {...(cart.loading ? { disabled: true } : {})} onClick={() => void cart.load(true)}>加载更多商品</Button>}
      <View className='cart-checkout'>
        <Button className='cart-select-all' {...(!available.length ? { disabled: true } : {})} onClick={() => setSelected(allSelected ? [] : available.map((item) => item.cartId))}><Text className={allSelected ? 'cart-selected' : ''}>{allSelected ? '✓' : '○'}</Text> 全选</Button>
        <View className='cart-summary'><Text>合计 <Text className='cart-price'>¥{cartTotal(selectedItems).toFixed(2)}</Text></Text><Text className='cart-caption'>运费以结算页为准</Text></View>
        <Button className='cart-submit' {...(count === 0 || Boolean(cart.busyId) || cart.loading || Boolean(cart.error) ? { disabled: true } : {})} onClick={() => { if (requireLogin(checkoutUrl)) void Taro.navigateTo({ url: checkoutUrl }); }}>去结算 ({count})</Button>
      </View>
    </>}
  </View>;
}
