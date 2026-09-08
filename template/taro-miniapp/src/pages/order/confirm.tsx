import { useState } from 'react';
import { Button, Input, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { useCheckout } from '../../state/checkout';
import { getCheckoutCoupons } from '../../services/checkout';
import type { CheckoutCoupon } from '../../services/checkout';
import { commerceError } from '../../services/commerce-contracts';
import { getStores } from '../../services/store';
import type { Store } from '../../services/store';
import { getInvoices, type Invoice } from '../../services/invoices';
import './index.scss';
import './confirm.scss';

export default function ConfirmOrderPage() {
  const params = useRouter().params;
  const query = Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? '')}`).join('&');
  const checkout = useCheckout({ ...(params['cartIds'] ? { cartIds: params['cartIds'] } : {}), ...(params['pinkId'] !== undefined ? { pinkId: params['pinkId'] } : {}), direct: params['new'] === '1', ...(params['selection'] ? { selection: params['selection'] } : {}), returnUrl: `/pages/order/confirm?${query}` });
  const { preferences, setPreferences, session, address, price, error, loading, submitting } = checkout;
  const [stores, setStores] = useState<readonly Store[]>([]);
  const [coupons, setCoupons] = useState<readonly CheckoutCoupon[]>([]);
  const [couponOpen, setCouponOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [invoices, setInvoices] = useState<readonly Invoice[]>([]); const [invoiceOpen, setInvoiceOpen] = useState(false);
  const loadStores = async (): Promise<void> => {
    try { setStores(await getStores()); setStoreOpen(true); }
    catch (cause) { await Taro.showToast({ title: commerceError(cause), icon: 'none' }); }
  };
  const loadInvoices = async (): Promise<void> => { try { setInvoices(await getInvoices()); setInvoiceOpen(true); } catch (cause) { await Taro.showToast({ title: commerceError(cause), icon: 'none' }); } };
  const loadCoupons = async (): Promise<void> => {
    if (!session || !price) return;
    try { setCoupons(await getCheckoutCoupons({ price: price.total, session, shippingType: preferences.shippingType })); setCouponOpen(true); }
    catch (cause) { await Taro.showToast({ title: commerceError(cause), icon: 'none' }); }
  };
  return <View className='page order-confirm-page'>
    <Text className='checkout-title'>确认订单</Text>
    {loading && <View className='card'><Text>正在确认商品与配送信息…</Text></View>}
    {error && <View className='card checkout-error'><Text>{error}</Text><Button onClick={checkout.retry}>重试</Button></View>}
    {session && <>
      <View className='card'>
        <View className='tabs'><Button className={preferences.shippingType === 1 ? 'active' : ''} onClick={() => setPreferences((current) => ({ ...current, shippingType: 1 }))}>快递配送</Button>{session.pickupEnabled && <Button className={preferences.shippingType === 2 ? 'active' : ''} onClick={() => setPreferences((current) => ({ ...current, shippingType: 2 }))}>到店自提</Button>}</View>
        {preferences.shippingType === 1 ? <Button className='order-address' onClick={() => void Taro.navigateTo({ url: '/pages-extra/address/index?select=1' })}>{address ? <><Text className='order-address__identity'>{address.real_name} {address.phone}</Text><Text className='order-address__detail'>{address.province}{address.city}{address.district}{address.detail}</Text></> : '添加收货地址'}</Button> : <>
          <Button onClick={() => void loadStores()}>{stores.find((item) => item.id === preferences.storeId)?.name ?? '选择自提门店'}</Button>
          {storeOpen && <View className='checkout-options'>{stores.length ? stores.map((store) => <Button key={store.id} onClick={() => { setPreferences((current) => ({ ...current, storeId: store.id })); setStoreOpen(false); }}>{store.name} · {store.address}</Button>) : <Text>暂无可用门店</Text>}<Button onClick={() => setStoreOpen(false)}>收起门店</Button></View>}
          <Input className='checkout-input' aria-label='自提联系人' placeholder='自提联系人' value={preferences.recipient ?? ''} onInput={(event) => setPreferences((current) => ({ ...current, recipient: event.detail.value }))} />
          <Input className='checkout-input' type='number' maxlength={11} aria-label='自提联系电话' placeholder='联系电话' value={preferences.phone ?? ''} onInput={(event) => setPreferences((current) => ({ ...current, phone: event.detail.value }))} />
        </>}
      </View>
      <View className='card'>{session.items.map((item) => <View className='checkout-product' key={item.cartId}><CommerceImage className='checkout-image' src={item.image} mode='aspectFill' /><View className='checkout-product-info'><Text>{item.name}</Text><Text className='checkout-muted'>{item.spec} × {item.quantity}</Text><Text>¥{(item.price * item.quantity).toFixed(2)}</Text></View></View>)}</View>
      <View className='card'>
        <Button className='checkout-option' onClick={() => void loadCoupons()}>优惠券 <Text>{preferences.couponId ? coupons.find((item) => item.id === preferences.couponId)?.title ?? '已选择' : '选择优惠券'}</Text></Button>
        {couponOpen && <View className='checkout-options'><Button onClick={() => { setPreferences((current) => ({ ...current, couponId: 0 })); setCouponOpen(false); }}>不使用优惠券</Button>{coupons.map((coupon) => <Button key={coupon.id} onClick={() => { setPreferences((current) => ({ ...current, couponId: coupon.id })); setCouponOpen(false); }}>{coupon.title} · 减 ¥{coupon.amount.toFixed(2)}，满 ¥{coupon.minimum.toFixed(2)}可用</Button>)}{!coupons.length && <Text>暂无可用优惠券</Text>}</View>}
        <Button className='checkout-option' onClick={() => void loadInvoices()}>发票 <Text>{preferences.invoiceId ? invoices.find((item) => Number(item.id) === preferences.invoiceId)?.name ?? '已选择' : '不开发票'}</Text></Button>{invoiceOpen && <View className='checkout-options'><Button onClick={() => { setPreferences((current) => ({ ...current, invoiceId: 0 })); setInvoiceOpen(false); }}>不开发票</Button>{invoices.map((invoice) => <Button key={invoice.id} onClick={() => { setPreferences((current) => ({ ...current, invoiceId: Number(invoice.id) })); setInvoiceOpen(false); }}>{invoice.name} · {invoice.headerType===1?'个人':'企业'}</Button>)}{!invoices.length && <Text>暂无发票抬头</Text>}<Button onClick={() => setInvoiceOpen(false)}>收起发票</Button></View>}
        {session.integralEnabled && <View className='checkout-option'><Text>使用积分（可用 {session.usableIntegral}）</Text><Switch checked={preferences.useIntegral} color='#c92a1d' onChange={(event) => setPreferences((current) => ({ ...current, useIntegral: event.detail.value }))} /></View>}
        <Text>订单备注</Text><Textarea className='checkout-input' aria-label='订单备注' placeholder='如有特殊要求，请在此留言' maxlength={200} value={preferences.mark} onInput={(event) => setPreferences((current) => ({ ...current, mark: event.detail.value }))} />
      </View>
      <View className='card'>{price ? <><View className='row'><Text>商品金额</Text><Text>¥{price.total.toFixed(2)}</Text></View><View className='row'><Text>运费</Text><Text>¥{price.postage.toFixed(2)}</Text></View><View className='row'><Text>优惠券</Text><Text>−¥{price.coupon.toFixed(2)}</Text></View><View className='row'><Text>积分抵扣</Text><Text>−¥{price.integral.toFixed(2)}</Text></View></> : <Text>正在计算订单金额…</Text>}</View>
      <View className='checkout-bottom'><View><Text>实付 </Text><Text className='primary'>{price ? `¥${price.payable.toFixed(2)}` : '计算中'}</Text></View><Button loading={submitting} {...(!price || Boolean(error) || loading || submitting ? { disabled: true } : {})} className='primaryButton' onClick={() => void checkout.submit()}>提交订单</Button></View>
    </>}
  </View>;
}
